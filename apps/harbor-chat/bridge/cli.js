#!/usr/bin/env node

/**
 * Harbor Chat Bridge CLI
 *
 * Quick way to post messages from the command line or scripts.
 *
 * Usage:
 *   # Post a text message
 *   node cli.js --workspace WORKSPACE_ID --channel general --agent "CI Bot" --message "Build passed!"
 *
 *   # Post a PR review
 *   node cli.js --workspace WORKSPACE_ID --type pr-review --pr-url "https://github.com/org/repo/pull/42" --pr-title "Fix auth" --verdict APPROVE
 *
 *   # Post an alert
 *   node cli.js --workspace WORKSPACE_ID --type alert --level warning --title "CPU at 90%" --description "Production server db-1"
 *
 *   # Post a task
 *   node cli.js --workspace WORKSPACE_ID --type task --title "Fix flaky test" --assignee "Cory"
 *
 *   # List workspaces (to find your workspace ID)
 *   node cli.js --list-workspaces
 *
 * Environment:
 *   HARBOR_SERVICE_ACCOUNT  Path to service account JSON (or set --sa flag)
 *   GOOGLE_APPLICATION_CREDENTIALS  Alternative: ADC path
 */

import { HarborBridge } from './harbor-bridge.js';

const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

async function main() {
  const saPath =
    getArg('sa') ||
    process.env.HARBOR_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    '';

  const bridge = new HarborBridge({
    serviceAccountPath: saPath || undefined,
  });

  // List workspaces
  if (hasFlag('list-workspaces')) {
    const workspaces = await bridge.listWorkspaces();
    console.log('\nWorkspaces:');
    for (const ws of workspaces) {
      console.log(`  ${ws.id}  ${ws.name} (${ws.memberIds?.length || 0} members)`);
    }
    process.exit(0);
  }

  const workspaceId = getArg('workspace') || getArg('ws');
  if (!workspaceId) {
    console.error('Error: --workspace WORKSPACE_ID is required');
    console.error('Run with --list-workspaces to find your workspace ID');
    process.exit(1);
  }

  const type = getArg('type', 'text');
  const channel = getArg('channel', 'agent-activity');
  const agent = getArg('agent', 'Bridge');

  // Ensure bot user exists
  await bridge.ensureBotUser(agent, `Posted via harbor-chat-bridge CLI`);

  switch (type) {
    case 'text': {
      const message = getArg('message') || getArg('m') || args.filter(a => !a.startsWith('--')).join(' ');
      if (!message) {
        console.error('Error: --message "text" is required');
        process.exit(1);
      }
      const id = await bridge.postMessage({
        workspaceId,
        channelName: channel,
        agentName: agent,
        content: message,
      });
      console.log(`Message posted: ${id}`);
      break;
    }

    case 'pr-review': {
      const id = await bridge.postPRReview({
        workspaceId,
        channelName: channel || 'pr-reviews',
        agentName: agent || 'Reviewer',
        prUrl: getArg('pr-url'),
        prTitle: getArg('pr-title', 'Pull Request'),
        verdict: getArg('verdict', 'COMMENT'),
        summary: getArg('summary'),
        filesChanged: parseInt(getArg('files', '0')) || undefined,
        additions: parseInt(getArg('additions', '0')) || undefined,
        deletions: parseInt(getArg('deletions', '0')) || undefined,
      });
      console.log(`PR review posted: ${id}`);
      break;
    }

    case 'deploy': {
      const id = await bridge.postDeploy({
        workspaceId,
        channelName: channel || 'deploys',
        agentName: agent || 'Deploy Bot',
        env: getArg('env', 'production'),
        status: getArg('status', 'success'),
        commit: getArg('commit'),
        url: getArg('url'),
      });
      console.log(`Deploy status posted: ${id}`);
      break;
    }

    case 'alert': {
      const id = await bridge.postAlert({
        workspaceId,
        channelName: channel || 'alerts',
        agentName: agent || 'Alert Bot',
        level: getArg('level', 'info'),
        title: getArg('title', 'Alert'),
        description: getArg('description'),
      });
      console.log(`Alert posted: ${id}`);
      break;
    }

    case 'task': {
      const id = await bridge.postTask({
        workspaceId,
        channelName: channel || 'tasks',
        agentName: agent || 'Planner',
        title: getArg('title', 'New Task'),
        description: getArg('description'),
        assignee: getArg('assignee'),
        status: getArg('status', 'todo'),
      });
      console.log(`Task posted: ${id}`);
      break;
    }

    case 'agent-update': {
      const id = await bridge.postAgentUpdate({
        workspaceId,
        channelName: channel || 'agent-activity',
        agentName: agent,
        title: getArg('title'),
        description: getArg('description'),
        url: getArg('url'),
      });
      console.log(`Agent update posted: ${id}`);
      break;
    }

    default:
      console.error(`Unknown type: ${type}`);
      process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
