import type { MessageType, MessageMetadata } from "./types";

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  icon: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/task",
    description: "Create a task card",
    usage: "/task Buy groceries @assignee",
    icon: "✅",
  },
  {
    name: "/pr",
    description: "Share a pull request",
    usage: "/pr https://github.com/org/repo/pull/123",
    icon: "🔀",
  },
  {
    name: "/deploy",
    description: "Post a deploy status",
    usage: "/deploy production success abc1234",
    icon: "🚀",
  },
  {
    name: "/alert",
    description: "Post an alert",
    usage: "/alert warning Database CPU at 90%",
    icon: "⚠️",
  },
  {
    name: "/agent",
    description: "Post as an agent update",
    usage: "/agent Completed code review for PR #42",
    icon: "🤖",
  },
  {
    name: "/code",
    description: "Share a code snippet",
    usage: "/code ts const x = 1;",
    icon: "💻",
  },
];

export interface ParsedCommand {
  messageType: MessageType;
  content: string;
  metadata: MessageMetadata;
}

/**
 * Parse a slash command from a message string.
 * Returns null if the message is not a command.
 */
export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();

  // /task [title] [@assignee]
  if (trimmed.startsWith("/task ")) {
    const rest = trimmed.slice(6).trim();
    const assigneeMatch = rest.match(/@(\w+)/);
    const title = rest.replace(/@\w+/, "").trim();
    return {
      messageType: "task",
      content: title,
      metadata: {
        taskTitle: title,
        taskStatus: "todo",
        taskAssignee: assigneeMatch?.[1],
      },
    };
  }

  // /pr [url] [optional title]
  if (trimmed.startsWith("/pr ")) {
    const rest = trimmed.slice(4).trim();
    const urlMatch = rest.match(/^(https?:\/\/\S+)/);
    const url = urlMatch?.[1] ?? "";
    const title = rest.replace(url, "").trim() || "Pull Request";
    // Try to extract PR number from GitHub URL
    const prMatch = url.match(/\/pull\/(\d+)/);
    const prTitle = prMatch ? `PR #${prMatch[1]}: ${title}` : title;
    return {
      messageType: "code-review",
      content: prTitle,
      metadata: {
        prUrl: url,
        prTitle,
        prStatus: "open",
      },
    };
  }

  // /deploy [env] [status] [commit]
  if (trimmed.startsWith("/deploy ")) {
    const parts = trimmed.slice(8).trim().split(/\s+/);
    const env = parts[0] ?? "production";
    const status = (parts[1] ?? "pending") as MessageMetadata["deployStatus"];
    const commit = parts[2] ?? "";
    return {
      messageType: "deploy",
      content: `Deploy to ${env}: ${status}`,
      metadata: {
        deployEnv: env,
        deployStatus: status,
        deployCommit: commit,
      },
    };
  }

  // /alert [level] [message]
  if (trimmed.startsWith("/alert ")) {
    const rest = trimmed.slice(7).trim();
    const levelMatch = rest.match(/^(info|warning|error|critical)\s+/);
    const level = (levelMatch?.[1] ?? "info") as MessageMetadata["alertLevel"];
    const message = levelMatch ? rest.slice(levelMatch[0].length) : rest;
    return {
      messageType: "alert",
      content: message,
      metadata: {
        alertLevel: level,
        title: message,
      },
    };
  }

  // /agent [message]
  if (trimmed.startsWith("/agent ")) {
    const rest = trimmed.slice(7).trim();
    return {
      messageType: "agent-update",
      content: rest,
      metadata: {
        title: rest,
      },
    };
  }

  // /code [lang] [code]
  if (trimmed.startsWith("/code ")) {
    const rest = trimmed.slice(6);
    const langMatch = rest.match(/^(\w+)\s+/);
    const lang = langMatch?.[1] ?? "";
    const code = langMatch ? rest.slice(langMatch[0].length) : rest;
    return {
      messageType: "text",
      content: "```" + lang + "\n" + code + "\n```",
      metadata: {},
    };
  }

  return null;
}

/**
 * Check if a partial input matches any slash command (for autocomplete).
 */
export function matchSlashCommands(input: string): SlashCommand[] {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.startsWith("/")) return [];
  return SLASH_COMMANDS.filter((cmd) =>
    cmd.name.startsWith(trimmed.split(" ")[0] ?? ""),
  );
}
