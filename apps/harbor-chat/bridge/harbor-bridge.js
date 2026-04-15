/**
 * Harbor Chat Bridge
 *
 * Allows external agents (Peel, CI/CD, scripts) to post messages
 * to Harbor Chat channels via Firebase Admin SDK.
 *
 * Usage:
 *   import { HarborBridge } from './harbor-bridge.js';
 *
 *   const bridge = new HarborBridge({
 *     serviceAccountPath: './service-account.json', // or inline credentials
 *     projectId: 'harbor-7f970',
 *   });
 *
 *   await bridge.postMessage({
 *     workspaceId: 'abc123',
 *     channelName: 'pr-reviews',
 *     agentName: 'Reviewer',
 *     content: 'PR #42 looks good!',
 *   });
 */

import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export class HarborBridge {
  /**
   * Create a HarborBridge instance.
   *
   * @param {object} config
   * @param {string} [config.serviceAccountPath] - Path to service account JSON file
   * @param {object} [config.serviceAccount] - Inline service account credentials
   * @param {string} [config.projectId] - Firebase project ID (default: harbor-7f970)
   */
  constructor(config = {}) {
    const {
      serviceAccountPath,
      serviceAccount,
      projectId = 'harbor-7f970',
    } = config;

    if (getApps().length === 0) {
      const appConfig = { projectId };
      if (serviceAccountPath) {
        const sa = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
        appConfig.credential = cert(sa);
      } else if (serviceAccount) {
        appConfig.credential = cert(serviceAccount);
      }
      initializeApp(appConfig);
    }

    this.db = getFirestore();
    this.projectId = projectId;
  }

  // ==========================================
  // Agent Identity
  // ==========================================

  /**
   * Ensure a bot user profile exists in Firestore.
   * Call once per agent name at startup.
   */
  async ensureBotUser(agentName, description = '') {
    const botId = this._botId(agentName);
    const ref = this.db.doc(`users/${botId}`);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        displayName: agentName,
        email: `${botId}@harbor.bot`,
        avatarUrl: '',
        status: 'online',
        statusMessage: description || `Peel agent`,
        isBot: true,
        botConfig: {
          description,
          createdBy: 'peel-bridge',
        },
      });
    }

    return botId;
  }

  // ==========================================
  // Channel Discovery
  // ==========================================

  /**
   * Find a channel by name in a workspace.
   * Returns the channel ID or null.
   */
  async findChannel(workspaceId, channelName) {
    const snap = await this.db
      .collection('channels')
      .where('workspaceId', '==', workspaceId)
      .where('name', '==', channelName)
      .limit(1)
      .get();

    return snap.empty ? null : snap.docs[0].id;
  }

  /**
   * Find or create a channel in a workspace.
   */
  async ensureChannel(workspaceId, channelName, description = '') {
    let channelId = await this.findChannel(workspaceId, channelName);
    if (channelId) return channelId;

    const ref = await this.db.collection('channels').add({
      workspaceId,
      name: channelName,
      description,
      kind: 'channel',
      memberIds: [],
      isPrivate: false,
      createdAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
    });

    return ref.id;
  }

  /**
   * List all workspaces (useful for finding workspace IDs).
   */
  async listWorkspaces() {
    const snap = await this.db.collection('workspaces').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ==========================================
  // Post Messages
  // ==========================================

  /**
   * Post a plain text message to a channel.
   */
  async postMessage({
    workspaceId,
    channelId,
    channelName,
    agentName,
    content,
    messageType = 'text',
    metadata = {},
  }) {
    const botId = this._botId(agentName);

    // Resolve channel
    const resolvedChannelId =
      channelId || (await this.ensureChannel(workspaceId, channelName));

    // Write message
    const ref = await this.db
      .collection(`channels/${resolvedChannelId}/messages`)
      .add({
        authorId: botId,
        content,
        timestamp: FieldValue.serverTimestamp(),
        replyCount: 0,
        reactions: {},
        attachments: [],
        encrypted: false,
        messageType,
        metadata,
      });

    // Update channel lastMessageAt
    await this.db.doc(`channels/${resolvedChannelId}`).update({
      lastMessageAt: FieldValue.serverTimestamp(),
    });

    return ref.id;
  }

  // ==========================================
  // Structured Message Helpers
  // ==========================================

  /**
   * Post a PR review result.
   */
  async postPRReview({
    workspaceId,
    channelName = 'pr-reviews',
    agentName = 'Reviewer',
    prUrl,
    prTitle,
    verdict,
    summary,
    filesChanged,
    additions,
    deletions,
  }) {
    return this.postMessage({
      workspaceId,
      channelName,
      agentName,
      content: summary || `${verdict}: ${prTitle}`,
      messageType: 'code-review',
      metadata: {
        prUrl,
        prTitle,
        prStatus: verdict === 'APPROVE' ? 'merged' : 'open',
        filesChanged,
        additions,
        deletions,
      },
    });
  }

  /**
   * Post a deploy status.
   */
  async postDeploy({
    workspaceId,
    channelName = 'deploys',
    agentName = 'Deploy Bot',
    env,
    status,
    commit,
    url,
  }) {
    return this.postMessage({
      workspaceId,
      channelName,
      agentName,
      content: `Deploy to ${env}: ${status}`,
      messageType: 'deploy',
      metadata: {
        deployEnv: env,
        deployStatus: status,
        deployCommit: commit,
        deployUrl: url,
      },
    });
  }

  /**
   * Post an alert.
   */
  async postAlert({
    workspaceId,
    channelName = 'alerts',
    agentName = 'Alert Bot',
    level = 'info',
    title,
    description,
  }) {
    return this.postMessage({
      workspaceId,
      channelName,
      agentName,
      content: title,
      messageType: 'alert',
      metadata: {
        alertLevel: level,
        title,
        description,
      },
    });
  }

  /**
   * Post a task card.
   */
  async postTask({
    workspaceId,
    channelName = 'tasks',
    agentName = 'Planner',
    title,
    description,
    assignee,
    status = 'todo',
  }) {
    return this.postMessage({
      workspaceId,
      channelName,
      agentName,
      content: title,
      messageType: 'task',
      metadata: {
        taskTitle: title,
        taskStatus: status,
        taskAssignee: assignee,
        description,
      },
    });
  }

  /**
   * Post an agent update (freeform agent status).
   */
  async postAgentUpdate({
    workspaceId,
    channelName = 'agent-activity',
    agentName,
    title,
    description,
    url,
  }) {
    return this.postMessage({
      workspaceId,
      channelName,
      agentName,
      content: title,
      messageType: 'agent-update',
      metadata: {
        title,
        description,
        url,
      },
    });
  }

  /**
   * Post a chain completion result from Peel.
   */
  async postChainResult({
    workspaceId,
    channelName = 'agent-activity',
    chainName,
    agentResults = [],
    duration,
    success,
  }) {
    const status = success ? '✅' : '❌';
    const resultSummary = agentResults
      .map((r) => `**${r.agentName}** (${r.model}): ${r.output?.substring(0, 100)}...`)
      .join('\n');

    return this.postMessage({
      workspaceId,
      channelName,
      agentName: 'Chain Runner',
      content: `${status} Chain **${chainName}** completed in ${duration}\n\n${resultSummary}`,
      messageType: 'agent-update',
      metadata: {
        title: `${status} ${chainName}`,
        description: `Completed in ${duration} with ${agentResults.length} agents`,
      },
    });
  }

  // ==========================================
  // Internals
  // ==========================================

  _botId(agentName) {
    return `bot-${agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }
}
