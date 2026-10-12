import fs from 'node:fs/promises';
const content = await fs.readFile(new URL('./firestore.rules', import.meta.url), 'utf8');
const response = await fetch('http://127.0.0.1:8085/emulator/v1/projects/demo-island-coop:securityRules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }) });
if (!response.ok) throw new Error(await response.text());
console.log('Loaded co-op rules into the isolated emulator.');
