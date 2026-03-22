import Service, { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type AuthService from "atelier/services/auth-service";
import {
  createOrg as fsCreateOrg,
  deleteOrg as fsDeleteOrg,
  updateOrg as fsUpdateOrg,
  listUserOrgs,
  getOrgMembers as fsGetOrgMembers,
  removeMember as fsRemoveMember,
  addMember as fsAddMember,
  createInvite as fsCreateInvite,
  getInvites as fsGetInvites,
  acceptInvite as fsAcceptInvite,
  checkPendingInvites as fsCheckPendingInvites,
  deleteInvite as fsDeleteInvite,
  type FirestoreOrg,
  type FirestoreOrgMember,
  type FirestoreInvite,
} from "atelier/utils/firestore-adapter";

export interface Org {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Workspace {
  type: "personal" | "org";
  orgId?: string;
}

export default class OrgService extends Service {
  @service declare authService: AuthService;

  @tracked organizations: Org[] = [];
  @tracked activeWorkspace: Workspace = { type: "personal" };
  @tracked isLoading: boolean = false;
  @tracked members: FirestoreOrgMember[] = [];
  @tracked invites: FirestoreInvite[] = [];

  get isPersonalWorkspace(): boolean {
    return this.activeWorkspace.type === "personal";
  }

  get activeOrgId(): string | null {
    return this.activeWorkspace.type === "org" ? (this.activeWorkspace.orgId ?? null) : null;
  }

  get activeOrg(): Org | null {
    if (!this.activeOrgId) return null;
    return this.organizations.find((o) => o.id === this.activeOrgId) ?? null;
  }

  async loadOrganizations(): Promise<void> {
    if (!this.authService.isAuthenticated || !this.authService.uid) return;

    this.isLoading = true;
    try {
      const orgs = await listUserOrgs(this.authService.uid);
      this.organizations = orgs;
    } catch (e) {
      console.error("Failed to load organizations:", e);
      this.organizations = [];
    } finally {
      this.isLoading = false;
    }
  }

  async createOrganization(name: string): Promise<string | null> {
    if (!this.authService.isAuthenticated || !this.authService.uid || !this.authService.email) return null;

    this.isLoading = true;
    try {
      const orgId = await fsCreateOrg(this.authService.uid, name, this.authService.email);
      const newOrg: Org = {
        id: orgId,
        name,
        ownerId: this.authService.uid,
        createdAt: new Date().toISOString(),
      };
      this.organizations = [...this.organizations, newOrg];
      return orgId;
    } catch (e) {
      console.error("Failed to create organization:", e);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteOrganization(orgId: string): Promise<void> {
    try {
      await fsDeleteOrg(orgId);
      this.organizations = this.organizations.filter((o) => o.id !== orgId);
      if (this.activeOrgId === orgId) {
        this.activeWorkspace = { type: "personal" };
      }
    } catch (e) {
      console.error("Failed to delete organization:", e);
    }
  }

  async updateOrganization(orgId: string, name: string): Promise<void> {
    try {
      await fsUpdateOrg(orgId, { name });
      this.organizations = this.organizations.map((o) =>
        o.id === orgId ? { ...o, name } : o,
      );
    } catch (e) {
      console.error("Failed to update organization:", e);
    }
  }

  switchWorkspace(type: "personal" | "org", orgId?: string): void {
    this.activeWorkspace = type === "org" && orgId ? { type: "org", orgId } : { type: "personal" };
  }

  // ---- Members ----

  async getMembers(orgId: string): Promise<FirestoreOrgMember[]> {
    try {
      const members = await fsGetOrgMembers(orgId);
      this.members = members;
      return members;
    } catch (e) {
      console.error("Failed to get members:", e);
      return [];
    }
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    try {
      await fsRemoveMember(orgId, userId);
      this.members = this.members.filter((m) => m.userId !== userId);
    } catch (e) {
      console.error("Failed to remove member:", e);
    }
  }

  // ---- Invites ----

  async inviteMember(orgId: string, email: string, role: "editor" | "viewer"): Promise<void> {
    if (!this.authService.uid) return;
    try {
      const inviteId = await fsCreateInvite(orgId, email, role, this.authService.uid);
      const newInvite: FirestoreInvite = {
        id: inviteId,
        email,
        role,
        invitedBy: this.authService.uid,
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      this.invites = [newInvite, ...this.invites];
    } catch (e) {
      console.error("Failed to invite member:", e);
    }
  }

  async getInvites(orgId: string): Promise<FirestoreInvite[]> {
    try {
      const invites = await fsGetInvites(orgId);
      this.invites = invites;
      return invites;
    } catch (e) {
      console.error("Failed to get invites:", e);
      return [];
    }
  }

  async acceptInvite(orgId: string, inviteId: string): Promise<void> {
    if (!this.authService.uid || !this.authService.email) return;
    try {
      await fsAcceptInvite(orgId, inviteId, this.authService.uid, this.authService.email);
      // Reload organizations
      await this.loadOrganizations();
    } catch (e) {
      console.error("Failed to accept invite:", e);
    }
  }

  async checkPendingInvites(): Promise<void> {
    if (!this.authService.isAuthenticated || !this.authService.email || !this.authService.uid) return;
    try {
      const pending = await fsCheckPendingInvites(this.authService.email);
      for (const invite of pending) {
        await fsAcceptInvite(invite.orgId, invite.inviteId, this.authService.uid, this.authService.email);
      }
      if (pending.length > 0) {
        await this.loadOrganizations();
      }
    } catch (e) {
      console.error("Failed to check pending invites:", e);
    }
  }

  async deleteInvite(orgId: string, inviteId: string): Promise<void> {
    try {
      await fsDeleteInvite(orgId, inviteId);
      this.invites = this.invites.filter((i) => i.id !== inviteId);
    } catch (e) {
      console.error("Failed to delete invite:", e);
    }
  }

  isOrgOwner(orgId: string): boolean {
    if (!this.authService.uid) return false;
    const org = this.organizations.find((o) => o.id === orgId);
    return org?.ownerId === this.authService.uid;
  }
}
