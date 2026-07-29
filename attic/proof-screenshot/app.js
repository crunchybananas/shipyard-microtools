const copyBtn = document.getElementById('copyUrl');
const proofUrl = document.getElementById('proofUrl');
const status = document.getElementById('copyStatus');
const toggleBtn = document.getElementById('toggleAnnotations');
const proofImage = document.getElementById('proofImage');

let showAnnotations = true;

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(proofUrl.value);
    status.textContent = 'Copied! Share this screenshot URL as your proof.';
  } catch (err) {
    status.textContent = 'Copy failed. Select and copy manually.';
  }
});

toggleBtn.addEventListener('click', () => {
  showAnnotations = !showAnnotations;
  proofImage.src = showAnnotations ? 'proof-shot.svg' : 'proof-shot-clean.svg';
  toggleBtn.textContent = showAnnotations ? 'Toggle annotations' : 'Show annotations';
});
