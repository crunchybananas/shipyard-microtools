const elements = {
  type: document.getElementById('type'),
  angle: document.getElementById('angle'),
  angleValue: document.getElementById('angleValue'),
  stopsList: document.getElementById('stopsList'),
  addStop: document.getElementById('addStop'),
  preview: document.getElementById('gradientPreview'),
  cssOutput: document.getElementById('cssOutput'),
  randomize: document.getElementById('randomize'),
  copyCss: document.getElementById('copyCss'),
  copyHex: document.getElementById('copyHex'),
  angleControl: document.getElementById('angleControl'),
};

const MIN_STOPS = 2;
const MAX_STOPS = 8;

let stops = [
  { color: '#7c3aed', position: 0 },
  { color: '#f97316', position: 50 },
  { color: '#06b6d4', position: 100 },
];

function clampStop(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function buildGradient() {
  const type = elements.type.value;
  const angle = elements.angle.value;
  // Stops are emitted in list order (CSS clamps out-of-order positions),
  // so reordering the list is meaningful.
  const stopString = stops
    .map(s => `${s.color} ${clampStop(s.position)}%`)
    .join(', ');

  if (type === 'radial') {
    elements.angleControl.style.opacity = '0.3';
    return `radial-gradient(circle, ${stopString})`;
  }

  elements.angleControl.style.opacity = '1';

  if (type === 'conic') {
    return `conic-gradient(from ${angle}deg, ${stopString})`;
  }

  return `linear-gradient(${angle}deg, ${stopString})`;
}

function render() {
  elements.angleValue.textContent = `${elements.angle.value}°`;
  const gradient = buildGradient();
  elements.preview.style.background = gradient;
  elements.cssOutput.textContent = `background: ${gradient};`;
}

function makeRowButton(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn small';
  button.textContent = label;
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

function createStopRow(stop, index) {
  const row = document.createElement('div');
  row.className = 'stop-row';

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = stop.color;
  colorInput.addEventListener('input', () => {
    stop.color = colorInput.value;
    render();
  });

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = stop.position;

  const positionValue = document.createElement('span');
  positionValue.className = 'stop-pos';
  positionValue.textContent = `${stop.position}%`;

  slider.addEventListener('input', () => {
    stop.position = clampStop(slider.value);
    positionValue.textContent = `${stop.position}%`;
    render();
  });

  const upButton = makeRowButton('↑', 'Move stop up', () => {
    [stops[index - 1], stops[index]] = [stops[index], stops[index - 1]];
    renderStopsList();
  });
  upButton.disabled = index === 0;

  const downButton = makeRowButton('↓', 'Move stop down', () => {
    [stops[index], stops[index + 1]] = [stops[index + 1], stops[index]];
    renderStopsList();
  });
  downButton.disabled = index === stops.length - 1;

  const removeButton = makeRowButton('✕', 'Remove stop', () => {
    stops.splice(index, 1);
    renderStopsList();
  });
  removeButton.disabled = stops.length <= MIN_STOPS;

  row.append(colorInput, slider, positionValue, upButton, downButton, removeButton);
  return row;
}

function renderStopsList() {
  elements.stopsList.textContent = '';
  stops.forEach((stop, index) => {
    elements.stopsList.appendChild(createStopRow(stop, index));
  });
  elements.addStop.disabled = stops.length >= MAX_STOPS;
  render();
}

function addStop() {
  if (stops.length >= MAX_STOPS) return;
  const last = stops[stops.length - 1];
  const previous = stops[stops.length - 2];
  const position = clampStop(Math.round((previous.position + last.position) / 2));
  stops.splice(stops.length - 1, 0, { color: randomColor(), position });
  renderStopsList();
}

function randomColor() {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}

function randomize() {
  const count = MIN_STOPS + Math.floor(Math.random() * 3);
  const positions = [0];
  for (let i = 1; i < count - 1; i += 1) {
    positions.push(Math.floor(Math.random() * 101));
  }
  positions.push(100);
  positions.sort((a, b) => a - b);
  stops = positions.map(position => ({ color: randomColor(), position }));
  elements.angle.value = Math.floor(Math.random() * 360);
  renderStopsList();
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
  copyToClipboard(stops.map(s => s.color).join(', '));
});

elements.randomize.addEventListener('click', randomize);
elements.addStop.addEventListener('click', addStop);
elements.type.addEventListener('input', render);
elements.angle.addEventListener('input', render);

renderStopsList();
