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

let currentDataUrl = '';

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
    textInput.value = decodeURIComponent(escape(atob(b64)));
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
