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
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// UUID v7 (time-ordered): 48-bit unix ms timestamp, version 7, variant 10, 74 random bits
function generateUUID7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const now = Date.now();
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version nibble = 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant bits = 10

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ULID (Crockford base32: 48-bit timestamp + 80-bit randomness, 26 chars)
function generateULID() {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let time = Date.now();
  let timePart = '';
  for (let i = 0; i < 10; i++) {
    timePart = alphabet[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  let randomPart = '';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    randomPart += alphabet[bytes[i] % 32];
  }
  return timePart + randomPart;
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
  ulid: generateULID,
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
