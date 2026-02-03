// UUID Generator
// Generate UUIDs, ULIDs, and random IDs

const status = document.getElementById('status');

function showStatus(message) {
  status.textContent = message;
  status.className = 'status success';
  setTimeout(() => status.classList.add('hidden'), 2000);
}

// UUID v4 (random)
function generateUUID4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// UUID v7 (time-ordered)
function generateUUID7() {
  const now = Date.now();
  const timestamp = now.toString(16).padStart(12, '0');
  const random = Array.from({ length: 4 }, () => 
    Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')
  ).join('');
  
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${random.slice(0, 3)}-${(0x8 | (Math.random() * 4 | 0)).toString(16)}${random.slice(4, 7)}-${random.slice(7, 19)}`;
}

// Nano ID (URL-safe, 21 chars)
function generateNanoID(size = 21) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = '';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

// Short ID (8 chars alphanumeric)
function generateShortID() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

const generators = {
  uuid4: generateUUID4,
  uuid7: generateUUID7,
  nanoid: generateNanoID,
  shortid: generateShortID
};

// Generate all on load
function generateAll() {
  Object.keys(generators).forEach(type => {
    document.getElementById(type).value = generators[type]();
  });
}

// Regenerate buttons
document.querySelectorAll('.regen-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    document.getElementById(type).value = generators[type]();
  });
});

// Copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    navigator.clipboard.writeText(input.value).then(() => {
      showStatus('✓ Copied to clipboard');
    });
  });
});

// Bulk generation
const bulkType = document.getElementById('bulkType');
const bulkCount = document.getElementById('bulkCount');
const bulkOutput = document.getElementById('bulkOutput');
const bulkGenBtn = document.getElementById('bulkGenBtn');
const copyBulkBtn = document.getElementById('copyBulkBtn');

bulkGenBtn.addEventListener('click', () => {
  const type = bulkType.value;
  const count = Math.min(100, Math.max(1, parseInt(bulkCount.value) || 10));
  const ids = Array.from({ length: count }, () => generators[type]());
  bulkOutput.value = ids.join('\n');
});

copyBulkBtn.addEventListener('click', () => {
  if (!bulkOutput.value) {
    return;
  }
  navigator.clipboard.writeText(bulkOutput.value).then(() => {
    showStatus('✓ Copied all IDs');
  });
});

// Initialize
generateAll();
