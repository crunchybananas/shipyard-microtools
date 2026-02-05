const copyBtn = document.getElementById('copyUrl');
const proofUrl = document.getElementById('proofUrl');
const status = document.getElementById('copyStatus');
const checklist = document.getElementById('checklist');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const storageKey = 'proofGithubChecklist';

function updateProgress() {
  const boxes = checklist.querySelectorAll('input[type="checkbox"]');
  const total = boxes.length;
  const checked = [...boxes].filter(b => b.checked).length;
  const percent = Math.round((checked / total) * 100);
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}% complete`;
  const state = {};
  boxes.forEach(box => {
    state[box.dataset.key] = box.checked;
  });
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadChecklist() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;
  const state = JSON.parse(saved);
  checklist.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.checked = Boolean(state[box.dataset.key]);
  });
  updateProgress();
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(proofUrl.value);
    status.textContent = 'Copied! Share this repo URL as your proof.';
  } catch (err) {
    status.textContent = 'Copy failed. Select and copy manually.';
  }
});

checklist.addEventListener('change', updateProgress);

loadChecklist();
updateProgress();
