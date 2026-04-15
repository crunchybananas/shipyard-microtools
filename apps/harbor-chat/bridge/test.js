/**
 * Test the Harbor Chat Bridge.
 *
 * Before running:
 *   1. cd bridge && npm install
 *   2. Set HARBOR_SERVICE_ACCOUNT=/path/to/service-account.json
 *      Or: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   3. node test.js
 *
 * To get a service account key:
 *   1. Go to https://console.firebase.google.com/project/harbor-7f970/settings/serviceaccounts/adminsdk
 *   2. Click "Generate new private key"
 *   3. Save the JSON file as ./service-account.json
 */

import { HarborBridge } from './harbor-bridge.js';

const SA_PATH = process.env.HARBOR_SERVICE_ACCOUNT || './service-account.json';

async function test() {
  console.log('Initializing bridge...');
  const bridge = new HarborBridge({
    serviceAccountPath: SA_PATH,
  });

  // List workspaces to find the right one
  console.log('\nListing workspaces...');
  const workspaces = await bridge.listWorkspaces();
  for (const ws of workspaces) {
    console.log(`  ${ws.id}: ${ws.name}`);
  }

  if (workspaces.length === 0) {
    console.log('No workspaces found. Sign in to Harbor Chat first to create one.');
    process.exit(1);
  }

  const ws = workspaces[0];
  console.log(`\nUsing workspace: ${ws.name} (${ws.id})`);

  // Ensure bot users
  console.log('\nCreating bot users...');
  await bridge.ensureBotUser('Reviewer', 'Reviews PRs and code changes');
  await bridge.ensureBotUser('Planner', 'Plans and assigns tasks');
  await bridge.ensureBotUser('Deploy Bot', 'Monitors deployments');
  await bridge.ensureBotUser('Alert Bot', 'Monitors system health');
  await bridge.ensureBotUser('Chain Runner', 'Executes agent chains');
  console.log('  Bot users created.');

  // Test 1: Plain message
  console.log('\nTest 1: Posting a plain message...');
  const msg1 = await bridge.postMessage({
    workspaceId: ws.id,
    channelName: 'agent-activity',
    agentName: 'Chain Runner',
    content: '🚀 Harbor Chat Bridge is online! Peel agents can now post here.',
  });
  console.log(`  Message posted: ${msg1}`);

  // Test 2: PR Review
  console.log('\nTest 2: Posting a PR review...');
  const msg2 = await bridge.postPRReview({
    workspaceId: ws.id,
    agentName: 'Reviewer',
    prUrl: 'https://github.com/crunchybananas/harbor-chat/pull/1',
    prTitle: 'Add real-time messaging',
    verdict: 'APPROVE',
    summary: 'Code looks clean. Good separation of concerns between the Firestore adapter and services.',
    filesChanged: 12,
    additions: 847,
    deletions: 23,
  });
  console.log(`  PR review posted: ${msg2}`);

  // Test 3: Deploy status
  console.log('\nTest 3: Posting a deploy status...');
  const msg3 = await bridge.postDeploy({
    workspaceId: ws.id,
    agentName: 'Deploy Bot',
    env: 'production',
    status: 'success',
    commit: 'abc1234',
    url: 'https://harbor-7f970.web.app',
  });
  console.log(`  Deploy posted: ${msg3}`);

  // Test 4: Alert
  console.log('\nTest 4: Posting an alert...');
  const msg4 = await bridge.postAlert({
    workspaceId: ws.id,
    agentName: 'Alert Bot',
    level: 'warning',
    title: 'Firestore read quota at 80%',
    description: 'Consider optimizing queries or increasing quota before hitting the limit.',
  });
  console.log(`  Alert posted: ${msg4}`);

  // Test 5: Task
  console.log('\nTest 5: Posting a task...');
  const msg5 = await bridge.postTask({
    workspaceId: ws.id,
    agentName: 'Planner',
    title: 'Set up Nodemailer for invite emails',
    description: 'Cloud Function + Nodemailer to send invite emails when invites are created.',
    assignee: 'Cory',
  });
  console.log(`  Task posted: ${msg5}`);

  // Test 6: Chain result
  console.log('\nTest 6: Posting a chain result...');
  const msg6 = await bridge.postChainResult({
    workspaceId: ws.id,
    chainName: 'PR Review Chain',
    duration: '2m 34s',
    success: true,
    agentResults: [
      { agentName: 'Planner', model: 'claude-opus', output: 'Identified 3 files to review: auth.ts, firestore-adapter.ts, workspace-store.ts' },
      { agentName: 'Reviewer', model: 'claude-opus', output: 'APPROVE - Code quality is high, good error handling, clean separation of concerns' },
    ],
  });
  console.log(`  Chain result posted: ${msg6}`);

  console.log('\n✅ All tests passed! Check Harbor Chat to see the messages.');
  process.exit(0);
}

test().catch((err) => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
