const copyBtn = document.getElementById('copyUrl');
const proofUrl = document.getElementById('proofUrl');
const status = document.getElementById('copyStatus');

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(proofUrl.value);
    status.textContent = 'Copied! Share this URL as your proof.';
  } catch (err) {
    status.textContent = 'Copy failed. Select and copy manually.';
  }
});
