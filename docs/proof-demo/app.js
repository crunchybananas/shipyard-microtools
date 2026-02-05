const steps = [
  {
    title: 'Ready to analyze',
    copy: 'Load the demo to show the starting point.',
    meta: 'State 1 of 3'
  },
  {
    title: 'Feature toggled',
    copy: 'Switch the main toggle to reveal the core value.',
    meta: 'State 2 of 3'
  },
  {
    title: 'Outcome delivered',
    copy: 'Show the final output and explain why it matters.',
    meta: 'State 3 of 3'
  }
];

let currentIndex = 0;

const demoTitle = document.getElementById('demoTitle');
const demoCopy = document.getElementById('demoCopy');
const demoMeta = document.getElementById('demoMeta');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

const copyBtn = document.getElementById('copyUrl');
const proofUrl = document.getElementById('proofUrl');
const status = document.getElementById('copyStatus');

function renderStep() {
  const step = steps[currentIndex];
  demoTitle.textContent = step.title;
  demoCopy.textContent = step.copy;
  demoMeta.textContent = step.meta;
}

prevBtn.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + steps.length) % steps.length;
  renderStep();
});

nextBtn.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % steps.length;
  renderStep();
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(proofUrl.value);
    status.textContent = 'Copied! Share this demo URL as your proof.';
  } catch (err) {
    status.textContent = 'Copy failed. Select and copy manually.';
  }
});

renderStep();
