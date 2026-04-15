export interface User {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  status: "online" | "away" | "dnd" | "offline";
  statusMessage: string;
  publicKey?: string;
  isBot?: boolean;
  botConfig?: BotConfig;
}

export interface BotConfig {
  description: string;
  webhookToken?: string;
  createdBy: string;
  allowedChannels?: string[];
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  kind: "channel" | "dm" | "group";
  memberIds: string[];
  isPrivate: boolean;
  createdAt: number;
  lastMessageAt: number;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  timestamp: number;
  editedAt?: number;
  threadId?: string;
  replyCount: number;
  reactions: Record<string, string[]>;
  attachments: Attachment[];
  encrypted: boolean;
  // Structured message types for agent-native messaging
  messageType?: MessageType;
  metadata?: MessageMetadata;
  pinned?: boolean;
  deleted?: boolean;
}

export type MessageType =
  | "text"
  | "task"
  | "code-review"
  | "deploy"
  | "pr-summary"
  | "alert"
  | "agent-update";

export interface MessageMetadata {
  // Task card
  taskTitle?: string;
  taskStatus?: "todo" | "in-progress" | "done" | "blocked";
  taskAssignee?: string;

  // Code review
  prUrl?: string;
  prTitle?: string;
  prStatus?: "open" | "merged" | "closed";
  filesChanged?: number;
  additions?: number;
  deletions?: number;

  // Deploy
  deployEnv?: string;
  deployStatus?: "pending" | "running" | "success" | "failed";
  deployUrl?: string;
  deployCommit?: string;

  // Alert
  alertLevel?: "info" | "warning" | "error" | "critical";

  // Generic
  title?: string;
  description?: string;
  url?: string;
  imageUrl?: string;
}

export interface Thread {
  id: string;
  channelId: string;
  rootMessageId: string;
  participantIds: string[];
  lastReplyAt: number;
  replyCount: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface TypingIndicator {
  userId: string;
  channelId: string;
  timestamp: number;
}

export interface CallSession {
  id: string;
  channelId: string;
  initiatorId: string;
  participantIds: string[];
  kind: "audio" | "video";
  startedAt: number;
  active: boolean;
}
