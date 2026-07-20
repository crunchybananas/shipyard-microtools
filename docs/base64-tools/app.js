// Base64 Tools
// Encode and decode text, files, and images

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const status = document.getElementById('status');

// Text elements
const textInput = document.getElementById('textInput');
const base64Input = document.getElementById('base64Input');
const encodeTextBtn = document.getElementById('encodeTextBtn');
const decodeTextBtn = document.getElementById('decodeTextBtn');

// File elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const previewImg = document.getElementById('previewImg');
const fileName = document.getElementById('fileName');
const fileBase64Output = document.getElementById('fileBase64Output');
const copyBase64Btn = document.getElementById('copyBase64Btn');
const copyDataUrlBtn = document.getElementById('copyDataUrlBtn');

// Download elements
const downloadBase64Input = document.getElementById('downloadBase64Input');
const downloadFileName = document.getElementById('downloadFileName');
const downloadFileBtn = document.getElementById('downloadFileBtn');

let currentDataUrl = '';

// Normalize base64url (e.g. JWT segments) to standard Base64: swap -_ for +/
// and restore padding. Plain Base64 passes through unchanged, so atob stays
// strict about invalid characters.
function normalizeBase64(input) {
  let b64 = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const remainder = b64.length % 4;
  if (remainder === 2) b64 += '==';
  else if (remainder === 3) b64 += '=';
  return b64;
}

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}

// Tabs
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
  });
});

// Text encoding/decoding
encodeTextBtn.addEventListener('click', () => {
  const text = textInput.value;
  if (!text) {
    showStatus('Enter some text to encode', 'error');
    return;
  }
  try {
    base64Input.value = btoa(unescape(encodeURIComponent(text)));
    showStatus('✓ Encoded successfully', 'success');
  } catch (e) {
    showStatus(`Encoding failed: ${e.message}`, 'error');
  }
});

decodeTextBtn.addEventListener('click', () => {
  const b64 = base64Input.value.trim();
  if (!b64) {
    showStatus('Enter some Base64 to decode', 'error');
    return;
  }
  try {
    textInput.value = decodeURIComponent(escape(atob(normalizeBase64(b64))));
    showStatus('✓ Decoded successfully', 'success');
  } catch (e) {
    showStatus(`Decoding failed: Invalid Base64`, 'error');
  }
});

// File handling
function handleFile(file) {
  if (!file) return;
  
  fileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    currentDataUrl = e.target.result;
    const base64Only = currentDataUrl.split(',')[1];
    fileBase64Output.value = base64Only;
    
    if (file.type.startsWith('image/')) {
      previewImg.src = currentDataUrl;
      previewImg.style.display = 'block';
    } else {
      previewImg.style.display = 'none';
    }
    
    filePreview.classList.remove('hidden');
    showStatus('✓ File loaded', 'success');
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});

copyBase64Btn.addEventListener('click', () => {
  const text = fileBase64Output.value;
  if (!text) {
    showStatus('Nothing to copy', 'error');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    showStatus('✓ Base64 copied', 'success');
  });
});

copyDataUrlBtn.addEventListener('click', () => {
  if (!currentDataUrl) {
    showStatus('Nothing to copy', 'error');
    return;
  }
  navigator.clipboard.writeText(currentDataUrl).then(() => {
    showStatus('✓ Data URL copied', 'success');
  });
});

// Base64 → file download
const MIME_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  pdf: 'application/pdf', json: 'application/json', zip: 'application/zip',
  txt: 'text/plain', md: 'text/plain', csv: 'text/csv',
  html: 'text/html', css: 'text/css', js: 'text/javascript',
  mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm'
};

function guessMimeType(name, bytes) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (Object.prototype.hasOwnProperty.call(MIME_TYPES, ext)) return MIME_TYPES[ext];
  // Fall back to sniffing common magic bytes
  if (bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) return 'application/zip';
  }
  return 'application/octet-stream';
}

downloadFileBtn.addEventListener('click', () => {
  let b64 = downloadBase64Input.value.trim();
  if (!b64) {
    showStatus('Paste some Base64 to download', 'error');
    return;
  }
  // Accept a full data URL and strip its prefix
  if (b64.startsWith('data:') && b64.includes(',')) {
    b64 = b64.split(',')[1];
  }
  let binary;
  try {
    binary = atob(normalizeBase64(b64));
  } catch (e) {
    showStatus('Download failed: Invalid Base64', 'error');
    return;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const name = downloadFileName.value.trim() || 'download.bin';
  const blob = new Blob([bytes], { type: guessMimeType(name, bytes) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showStatus(`✓ Downloaded ${name}`, 'success');
});
