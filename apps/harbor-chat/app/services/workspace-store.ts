import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type { User, Workspace, Channel } from "harbor-chat/harbor-chat/types";
import type AuthService from "./auth-service";
import {
  listWorkspacesForUser,
  listChannelsForWorkspace,
  getUsersForWorkspace,
  getOrCreateUserProfile,
  updateUserStatus as fsUpdateUserStatus,
  createWorkspace,
  createChannel,
  listPendingInvitesForEmail,
  acceptInvite,
  seedBotUser,
} from "harbor-chat/utils/firestore-adapter";

/**
 * Manages workspace-level data: workspaces, channels, users, and membership.
 *
 * Loads from Firestore when authenticated. Falls back to empty state
 * (no mock data when Firebase is configured — mock is only for local dev
 * without Firebase).
 */
export default class WorkspaceStoreService extends Service {
  @service declare authService: AuthService;

  @tracked users: User[] = [];
  @tracked workspaces: Workspace[] = [];
  @tracked channels: Channel[] = [];
  @tracked isLoaded = false;
  @tracked useMock = false;

  @tracked currentUserId = "";

  private _initPromise: Promise<void> | null = null;

  get currentUser(): User | undefined {
    return this.users.find((u) => u.id === this.currentUserId);
  }

  /**
   * Initialize data from Firestore. Safe to call multiple times —
   * first call loads, subsequent calls are no-ops unless force=true.
   */
  async initialize(force = false): Promise<void> {
    if (this.isLoaded && !force) {
      return;
    }

    // Prevent concurrent initialization
    if (this._initPromise && !force) {
      return this._initPromise;
    }

    this._initPromise = this._doInitialize();
    await this._initPromise;
    this._initPromise = null;
  }

  /**
   * Reload workspace data (e.g. after accepting an invite).
   */
  async reload(): Promise<void> {
    await this.initialize(true);
  }

  private async _doInitialize(): Promise<void> {
    try {
      await this.authService.authReady;

      if (!this.authService.isAuthenticated || !this.authService.uid) {
        return;
      }

      this.currentUserId = this.authService.uid;

      // Ensure user profile exists in Firestore
      const profile = await getOrCreateUserProfile(this.authService.uid, {
        displayName: this.authService.displayName ?? "Anonymous",
        email: this.authService.email ?? "",
        avatarUrl: this.authService.photoURL ?? "",
      });

      // Auto-accept any pending invites for this user's email
      if (this.authService.email) {
        const pendingInvites = await listPendingInvitesForEmail(
          this.authService.email,
        );
        for (const invite of pendingInvites) {
          await acceptInvite(
            invite.id,
            invite.workspaceId,
            this.authService.uid,
          );
        }
      }

      let workspaces = await listWorkspacesForUser(this.authService.uid);

      // First-run: seed a default workspace with channels
      if (workspaces.length === 0) {
        await this._seedDefaultWorkspace(
          this.authService.uid,
          profile.displayName,
        );
        workspaces = await listWorkspacesForUser(this.authService.uid);
      }

      this.workspaces = workspaces;

      // Seed Claude bot user into the first workspace
      if (workspaces[0]) {
        try {
          await seedBotUser(workspaces[0].id);
        } catch {
          // Non-critical — bot seeding can fail silently
        }
      }

      // Reload workspaces to pick up new bot member
      workspaces = await listWorkspacesForUser(this.authService.uid);
      this.workspaces = workspaces;

      const allChannels: Channel[] = [];
      const allUserIds = new Set<string>();
      for (const ws of workspaces) {
        const channels = await listChannelsForWorkspace(ws.id);
        allChannels.push(...channels);
        ws.memberIds.forEach((id) => allUserIds.add(id));
      }
      this.channels = allChannels;

      const users = await getUsersForWorkspace([...allUserIds]);
      this.users = users;
      this.useMock = false;

      // Set online and start presence listeners
      this._setupPresence();
    } catch (e) {
      console.error("Harbor Chat: Firebase init failed, using empty state", e);
    }

    this.isLoaded = true;
  }

  private _presenceSetup = false;

  private _setupPresence(): void {
    if (this._presenceSetup) return;
    this._presenceSetup = true;

    // Set online
    fsUpdateUserStatus(this.currentUserId, "online");

    // Focus/blur for away detection
    window.addEventListener("focus", this._onFocus);
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("beforeunload", this._onUnload);
  }

  private _onFocus = () => {
    fsUpdateUserStatus(this.currentUserId, "online");
    this.users = this.users.map((u) =>
      u.id === this.currentUserId ? { ...u, status: "online" as const } : u,
    );
  };

  private _onBlur = () => {
    fsUpdateUserStatus(this.currentUserId, "away");
    this.users = this.users.map((u) =>
      u.id === this.currentUserId ? { ...u, status: "away" as const } : u,
    );
  };

  private _onUnload = () => {
    // Use sendBeacon pattern for reliability on page close
    fsUpdateUserStatus(this.currentUserId, "offline");
  };

  willDestroy(): void {
    super.willDestroy();
    window.removeEventListener("focus", this._onFocus);
    window.removeEventListener("blur", this._onBlur);
    window.removeEventListener("beforeunload", this._onUnload);
  }

  private _fetchingUserIds = new Set<string>();

  getUserById(id: string): User | undefined {
    const user = this.users.find((u) => u.id === id);
    if (!user && id && !this.useMock && !this._fetchingUserIds.has(id)) {
      // Trigger an async fetch for this unknown user
      this._fetchingUserIds.add(id);
      this._fetchMissingUser(id);
    }
    return user;
  }

  private async _fetchMissingUser(id: string): Promise<void> {
    try {
      const users = await getUsersForWorkspace([id]);
      if (users.length > 0) {
        this.users = [...this.users, ...users];
      }
    } catch {
      // ignore
    } finally {
      this._fetchingUserIds.delete(id);
    }
  }

  getWorkspaceById(id: string): Workspace | undefined {
    return this.workspaces.find((w) => w.id === id);
  }

  getChannelById(id: string): Channel | undefined {
    return this.channels.find((c) => c.id === id);
  }

  channelsForWorkspace(workspaceId: string): Channel[] {
    return this.channels
      .filter((c) => c.workspaceId === workspaceId && c.kind === "channel")
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  dmsForWorkspace(workspaceId: string): Channel[] {
    return this.channels
      .filter(
        (c) =>
          c.workspaceId === workspaceId &&
          (c.kind === "dm" || c.kind === "group"),
      )
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  membersForWorkspace(workspaceId: string): User[] {
    const ws = this.getWorkspaceById(workspaceId);
    if (!ws) return [];
    return this.users.filter((u) => ws.memberIds.includes(u.id));
  }

  getDmDisplayName(channel: Channel): string {
    const otherIds = channel.memberIds.filter(
      (id) => id !== this.currentUserId,
    );
    return otherIds
      .map((id) => this.getUserById(id)?.displayName ?? "Unknown")
      .join(", ");
  }

  updateStatus = async (status: User["status"], statusMessage?: string) => {
    this.users = this.users.map((u) =>
      u.id === this.currentUserId
        ? {
            ...u,
            status,
            statusMessage: statusMessage ?? u.statusMessage,
          }
        : u,
    );

    if (!this.useMock) {
      await fsUpdateUserStatus(this.currentUserId, status, statusMessage);
    }
  };

  private async _seedDefaultWorkspace(
    userId: string,
    displayName: string,
  ): Promise<void> {
    const wsName = displayName ? `${displayName}'s Team` : "My Team";
    const workspaceId = await createWorkspace({
      name: wsName,
      icon: "⚓",
      ownerId: userId,
      memberIds: [userId],
    });

    const defaultChannels = [
      {
        name: "general",
        description: "Company-wide announcements and discussion",
        isPrivate: false,
      },
      {
        name: "engineering",
        description: "Engineering discussion",
        isPrivate: false,
      },
      {
        name: "random",
        description: "Non-work banter and water cooler conversation",
        isPrivate: false,
      },
    ];

    for (const ch of defaultChannels) {
      await createChannel({
        workspaceId,
        name: ch.name,
        description: ch.description,
        kind: "channel",
        memberIds: [userId],
        isPrivate: ch.isPrivate,
      });
    }
  }
}
