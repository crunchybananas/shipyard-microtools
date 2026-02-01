const elements = {
  type: document.getElementById('type'),
  angle: document.getElementById('angle'),
  angleValue: document.getElementById('angleValue'),
  color1: document.getElementById('color1'),
  color2: document.getElementById('color2'),
  color3: document.getElementById('color3'),
  stop1: document.getElementById('stop1'),
  stop2: document.getElementById('stop2'),
  stop3: document.getElementById('stop3'),
  stop1Value: document.getElementById('stop1Value'),
  stop2Value: document.getElementById('stop2Value'),
  stop3Value: document.getElementById('stop3Value'),
  enableColor3: document.getElementById('enableColor3'),
  preview: document.getElementById('gradientPreview'),
  cssOutput: document.getElementById('cssOutput'),
  randomize: document.getElementById('randomize'),
  copyCss: document.getElementById('copyCss'),
  copyHex: document.getElementById('copyHex'),
  angleControl: document.getElementById('angleControl'),
};

function clampStop(value) {
  return Math.min(100, Math.max(0, Number(value)));
}

function updateStops() {
  elements.stop1Value.textContent = `${elements.stop1.value}%`;
  elements.stop2Value.textContent = `${elements.stop2.value}%`;
  elements.stop3Value.textContent = `${elements.stop3.value}%`;
}

function buildGradient() {
  const type = elements.type.value;
  const angle = elements.angle.value;
  const stops = [
    { color: elements.color1.value, stop: clampStop(elements.stop1.value) },
    { color: elements.color2.value, stop: clampStop(elements.stop2.value) },
  ];

  if (elements.enableColor3.checked) {
    stops.push({ color: elements.color3.value, stop: clampStop(elements.stop3.value) });
  }

  const sorted = stops.sort((a, b) => a.stop - b.stop);
  const stopString = sorted.map(s => `${s.color} ${s.stop}%`).join(', ');

  if (type === 'radial') {
    elements.angleControl.style.opacity = '0.3';
    return `radial-gradient(circle, ${stopString})`;
  }

  elements.angleControl.style.opacity = '1';
  return `linear-gradient(${angle}deg, ${stopString})`;
}

function render() {
  elements.angleValue.textContent = `${elements.angle.value}°`;
  updateStops();
  const gradient = buildGradient();
  elements.preview.style.background = gradient;
  elements.cssOutput.textContent = `background: ${gradient};`;
}

function randomColor() {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}

function randomize() {
  elements.color1.value = randomColor();
  elements.color2.value = randomColor();
  elements.color3.value = randomColor();
  elements.stop1.value = 0;
  elements.stop2.value = 100;
  elements.stop3.value = 50;
  elements.enableColor3.checked = Math.random() > 0.3;
  elements.angle.value = Math.floor(Math.random() * 360);
  render();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  });
}

elements.copyCss.addEventListener('click', () => {
  copyToClipboard(elements.cssOutput.textContent.trim());
});

elements.copyHex.addEventListener('click', () => {
  const colors = [elements.color1.value, elements.color2.value];
  if (elements.enableColor3.checked) {
    colors.push(elements.color3.value);
  }
  copyToClipboard(colors.join(', '));
});

elements.randomize.addEventListener('click', randomize);

Object.values(elements).forEach(element => {
  if (!element || !element.addEventListener) return;
  element.addEventListener('input', render);
});

document.addEventListener('DOMContentLoaded', render);
render();
