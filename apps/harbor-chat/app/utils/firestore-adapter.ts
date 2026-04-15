import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Workspace,
  Channel,
  Message,
  Thread,
  User,
} from "harbor-chat/harbor-chat/types";

// ==========================================
// Timestamp helpers
// ==========================================

function timestampToMs(ts: Timestamp | null | undefined): number {
  if (!ts || !(ts instanceof Timestamp)) return Date.now();
  return ts.toDate().getTime();
}

function now() {
  return serverTimestamp();
}

// ==========================================
// Users / Profiles
// ==========================================

export async function getOrCreateUserProfile(
  uid: string,
  defaults: Partial<User>,
): Promise<User> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as User;
  }
  const profile: Omit<User, "id"> = {
    displayName: defaults.displayName ?? "Anonymous",
    email: defaults.email ?? "",
    avatarUrl: defaults.avatarUrl ?? "",
    status: "online",
    statusMessage: "",
    ...defaults,
  };
  await setDoc(ref, profile);
  return { id: uid, ...profile };
}

export async function updateUserStatus(
  uid: string,
  status: User["status"],
  statusMessage?: string,
): Promise<void> {
  const ref = doc(db, "users", uid);
  const updates: Record<string, unknown> = { status };
  if (statusMessage !== undefined) updates.statusMessage = statusMessage;
  await updateDoc(ref, updates);
}

export async function getUsersForWorkspace(
  memberIds: string[],
): Promise<User[]> {
  if (memberIds.length === 0) return [];
  // Firestore 'in' queries limited to 30 items
  const users: User[] = [];
  for (let i = 0; i < memberIds.length; i += 30) {
    const batch = memberIds.slice(i, i + 30);
    const q = query(collection(db, "users"), where("__name__", "in", batch));
    const snap = await getDocs(q);
    snap.forEach((d) => users.push({ id: d.id, ...d.data() } as User));
  }
  return users;
}

// ==========================================
// Bot Users
// ==========================================

const CLAUDE_BOT_ID = "bot-claude";

export async function seedBotUser(workspaceId: string): Promise<void> {
  const botRef = doc(db, "users", CLAUDE_BOT_ID);
  const botSnap = await getDoc(botRef);

  if (!botSnap.exists()) {
    await setDoc(botRef, {
      displayName: "Claude",
      email: "claude@harbor.bot",
      avatarUrl: "",
      status: "online",
      statusMessage: "Ready to assist",
      isBot: true,
      botConfig: {
        description: "AI assistant — posts updates, reviews code, and coordinates tasks",
        createdBy: "system",
      },
    });
  }

  // Ensure bot is a member of the workspace
  const wsRef = doc(db, "workspaces", workspaceId);
  await updateDoc(wsRef, { memberIds: arrayUnion(CLAUDE_BOT_ID) });

  // Add bot to all public channels
  const channelsQ = query(
    collection(db, "channels"),
    where("workspaceId", "==", workspaceId),
    where("isPrivate", "==", false),
  );
  const channels = await getDocs(channelsQ);
  for (const ch of channels.docs) {
    await updateDoc(doc(db, "channels", ch.id), {
      memberIds: arrayUnion(CLAUDE_BOT_ID),
    });
  }
}

export function getBotUserId(): string {
  return CLAUDE_BOT_ID;
}

// ==========================================
// Workspaces
// ==========================================

export async function listWorkspacesForUser(
  userId: string,
): Promise<Workspace[]> {
  const q = query(
    collection(db, "workspaces"),
    where("memberIds", "array-contains", userId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
        createdAt: timestampToMs(d.data().createdAt as Timestamp),
      }) as Workspace,
  );
}

export async function createWorkspace(
  data: Omit<Workspace, "id" | "createdAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "workspaces"), {
    ...data,
    createdAt: now(),
  });
  return ref.id;
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const ref = doc(db, "workspaces", workspaceId);
  await updateDoc(ref, { memberIds: arrayUnion(userId) });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const ref = doc(db, "workspaces", workspaceId);
  await updateDoc(ref, { memberIds: arrayRemove(userId) });
}

// ==========================================
// Channels
// ==========================================

export async function listChannelsForWorkspace(
  workspaceId: string,
): Promise<Channel[]> {
  const q = query(
    collection(db, "channels"),
    where("workspaceId", "==", workspaceId),
    orderBy("lastMessageAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
        createdAt: timestampToMs(d.data().createdAt as Timestamp),
        lastMessageAt: timestampToMs(d.data().lastMessageAt as Timestamp),
      }) as Channel,
  );
}

export async function createChannel(
  data: Omit<Channel, "id" | "createdAt" | "lastMessageAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "channels"), {
    ...data,
    createdAt: now(),
    lastMessageAt: now(),
  });
  return ref.id;
}

export async function getChannel(channelId: string): Promise<Channel | null> {
  const snap = await getDoc(doc(db, "channels", channelId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    createdAt: timestampToMs(snap.data().createdAt as Timestamp),
    lastMessageAt: timestampToMs(snap.data().lastMessageAt as Timestamp),
  } as Channel;
}

// ==========================================
// Messages (real-time)
// ==========================================

/**
 * Subscribe to messages in a channel, ordered by timestamp.
 * Returns an unsubscribe function.
 *
 * This is the core real-time pattern — onSnapshot fires
 * immediately with cached data, then again on server updates.
 */
export function subscribeToMessages(
  channelId: string,
  onMessages: (messages: Message[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "channels", channelId, "messages"),
    orderBy("timestamp", "asc"),
    limit(200),
  );
  return onSnapshot(q, (snap) => {
    const messages: Message[] = snap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
          channelId,
          timestamp: timestampToMs(d.data().timestamp as Timestamp),
          editedAt: d.data().editedAt
            ? timestampToMs(d.data().editedAt as Timestamp)
            : undefined,
        }) as Message,
    );
    onMessages(messages);
  });
}

export async function sendMessage(
  channelId: string,
  data: {
    authorId: string;
    content: string;
    encrypted: boolean;
    threadId?: string;
    messageType?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const ref = await addDoc(
    collection(db, "channels", channelId, "messages"),
    {
      ...data,
      timestamp: now(),
      replyCount: 0,
      reactions: {},
      attachments: [],
    },
  );
  // Update channel lastMessageAt
  await updateDoc(doc(db, "channels", channelId), {
    lastMessageAt: now(),
  });
  return ref.id;
}

export async function toggleReaction(
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string,
  add: boolean,
): Promise<void> {
  const ref = doc(db, "channels", channelId, "messages", messageId);
  await updateDoc(ref, {
    [`reactions.${emoji}`]: add ? arrayUnion(userId) : arrayRemove(userId),
  });
}

// ==========================================
// Threads
// ==========================================

export function subscribeToThreadMessages(
  channelId: string,
  threadId: string,
  onMessages: (messages: Message[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "channels", channelId, "threads", threadId, "messages"),
    orderBy("timestamp", "asc"),
  );
  return onSnapshot(q, (snap) => {
    const messages: Message[] = snap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
          channelId,
          threadId,
          timestamp: timestampToMs(d.data().timestamp as Timestamp),
        }) as Message,
    );
    onMessages(messages);
  });
}

export async function sendThreadReply(
  channelId: string,
  threadId: string,
  data: { authorId: string; content: string; encrypted: boolean },
): Promise<string> {
  const ref = await addDoc(
    collection(db, "channels", channelId, "threads", threadId, "messages"),
    {
      ...data,
      timestamp: now(),
      replyCount: 0,
      reactions: {},
      attachments: [],
    },
  );
  // Increment reply count on the thread doc
  const threadRef = doc(db, "channels", channelId, "threads", threadId);
  const threadSnap = await getDoc(threadRef);
  if (threadSnap.exists()) {
    await updateDoc(threadRef, {
      replyCount: (threadSnap.data().replyCount ?? 0) + 1,
      lastReplyAt: now(),
    });
  }
  return ref.id;
}

export async function getOrCreateThread(
  channelId: string,
  rootMessageId: string,
  creatorId: string,
): Promise<string> {
  // Check if thread already exists for this root message
  const q = query(
    collection(db, "channels", channelId, "threads"),
    where("rootMessageId", "==", rootMessageId),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0]!.id;
  }

  const ref = await addDoc(
    collection(db, "channels", channelId, "threads"),
    {
      rootMessageId,
      participantIds: [creatorId],
      lastReplyAt: now(),
      replyCount: 0,
    },
  );
  return ref.id;
}

// ==========================================
// Presence (for typing indicators)
// ==========================================

/**
 * Set typing indicator. Uses a dedicated subcollection
 * with TTL — Firebase RTDB would be better for this in
 * production, but Firestore works for the POC.
 */
export async function setTyping(
  channelId: string,
  userId: string,
  isTyping: boolean,
): Promise<void> {
  const ref = doc(db, "channels", channelId, "typing", userId);
  if (isTyping) {
    await setDoc(ref, { userId, timestamp: now() });
  } else {
    await deleteDoc(ref);
  }
}

export function subscribeToTyping(
  channelId: string,
  onTyping: (userIds: string[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "channels", channelId, "typing"),
    (snap) => {
      const fiveSecondsAgo = Date.now() - 5000;
      const userIds = snap.docs
        .filter((d) => {
          const ts = d.data().timestamp;
          return ts && timestampToMs(ts as Timestamp) > fiveSecondsAgo;
        })
        .map((d) => d.data().userId as string);
      onTyping(userIds);
    },
  );
}

// ==========================================
// Unread tracking
// ==========================================

export async function updateLastRead(
  channelId: string,
  userId: string,
): Promise<void> {
  const ref = doc(db, "channels", channelId, "read", userId);
  await setDoc(ref, { lastReadAt: now() });
}

export async function getUnreadCounts(
  channelIds: string[],
  userId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const channelId of channelIds) {
    try {
      // Get last read timestamp
      const readRef = doc(db, "channels", channelId, "read", userId);
      const readSnap = await getDoc(readRef);
      let lastRead: Timestamp | null = null;
      if (readSnap.exists()) {
        lastRead = readSnap.data().lastReadAt as Timestamp;
      }

      if (lastRead) {
        // Count messages after last read
        const q = query(
          collection(db, "channels", channelId, "messages"),
          where("timestamp", ">", lastRead),
          where("authorId", "!=", userId),
        );
        const snap = await getDocs(q);
        if (snap.size > 0) {
          counts[channelId] = snap.size;
        }
      }
    } catch {
      // Skip channels that error (e.g. missing indexes)
    }
  }
  return counts;
}

// ==========================================
// Message editing and deletion
// ==========================================

export async function editMessage(
  channelId: string,
  messageId: string,
  newContent: string,
): Promise<void> {
  const ref = doc(db, "channels", channelId, "messages", messageId);
  await updateDoc(ref, {
    content: newContent,
    editedAt: now(),
  });
}

export async function deleteMessage(
  channelId: string,
  messageId: string,
): Promise<void> {
  const ref = doc(db, "channels", channelId, "messages", messageId);
  await updateDoc(ref, {
    content: "",
    deleted: true,
  });
}

export async function pinMessage(
  channelId: string,
  messageId: string,
  pinned: boolean,
): Promise<void> {
  const ref = doc(db, "channels", channelId, "messages", messageId);
  await updateDoc(ref, { pinned, pinnedAt: pinned ? now() : null });
}

// ==========================================
// Invites
// ==========================================

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  invitedBy: string;
  invitedByName: string;
  createdAt: number;
  status: "pending" | "accepted" | "declined";
}

export async function getInviteById(
  inviteId: string,
): Promise<WorkspaceInvite | null> {
  const snap = await getDoc(doc(db, "invites", inviteId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    createdAt: timestampToMs(snap.data().createdAt as Timestamp),
  } as WorkspaceInvite;
}

/**
 * Create an invite without requiring an email — for link-based invites.
 * If email is empty string, the invite is "open" and can be accepted by anyone.
 */
export async function createLinkInvite(data: {
  workspaceId: string;
  workspaceName: string;
  invitedBy: string;
  invitedByName: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "invites"), {
    ...data,
    email: "",
    createdAt: now(),
    status: "pending",
  });
  return ref.id;
}

export async function createInvite(data: {
  workspaceId: string;
  workspaceName: string;
  email: string;
  invitedBy: string;
  invitedByName: string;
}): Promise<string> {
  // Check if already invited
  const q = query(
    collection(db, "invites"),
    where("workspaceId", "==", data.workspaceId),
    where("email", "==", data.email.toLowerCase()),
    where("status", "==", "pending"),
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error("This person already has a pending invite.");
  }

  const ref = await addDoc(collection(db, "invites"), {
    ...data,
    email: data.email.toLowerCase(),
    createdAt: now(),
    status: "pending",
  });
  return ref.id;
}

export async function listInvitesForWorkspace(
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  const q = query(
    collection(db, "invites"),
    where("workspaceId", "==", workspaceId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
        createdAt: timestampToMs(d.data().createdAt as Timestamp),
      }) as WorkspaceInvite,
  );
}

export async function listPendingInvitesForEmail(
  email: string,
): Promise<WorkspaceInvite[]> {
  const q = query(
    collection(db, "invites"),
    where("email", "==", email.toLowerCase()),
    where("status", "==", "pending"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
        createdAt: timestampToMs(d.data().createdAt as Timestamp),
      }) as WorkspaceInvite,
  );
}

export async function acceptInvite(
  inviteId: string,
  workspaceId: string,
  userId: string,
): Promise<void> {
  // Mark invite as accepted
  await updateDoc(doc(db, "invites", inviteId), { status: "accepted" });

  // Add user to workspace members
  const wsRef = doc(db, "workspaces", workspaceId);
  await updateDoc(wsRef, { memberIds: arrayUnion(userId) });

  // Add user to all non-private channels in the workspace
  const channelsQ = query(
    collection(db, "channels"),
    where("workspaceId", "==", workspaceId),
    where("isPrivate", "==", false),
  );
  const channels = await getDocs(channelsQ);
  for (const ch of channels.docs) {
    await updateDoc(doc(db, "channels", ch.id), {
      memberIds: arrayUnion(userId),
    });
  }
}
