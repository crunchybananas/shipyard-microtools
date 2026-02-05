// Ship Forecast - Predictive Project Health

// Sample Data
const sampleShips = [
  {
    id: '1',
    name: 'Auth Service',
    description: 'User authentication and authorization system',
    estimatedProofs: 12,
    proofs: [
      { date: new Date('2024-01-08'), type: 'github' },
      { date: new Date('2024-01-10'), type: 'github' },
      { date: new Date('2024-01-15'), type: 'url' },
      { date: new Date('2024-01-18'), type: 'github' },
      { date: new Date('2024-01-22'), type: 'demo' },
      { date: new Date('2024-01-25'), type: 'github' },
      { date: new Date('2024-01-28'), type: 'screenshot' },
      { date: new Date('2024-02-01'), type: 'github' },
    ],
    startDate: new Date('2024-01-08')
  },
  {
    id: '2',
    name: 'Dashboard UI',
    description: 'Admin dashboard with analytics',
    estimatedProofs: 10,
    proofs: [
      { date: new Date('2024-01-12'), type: 'github' },
      { date: new Date('2024-01-20'), type: 'screenshot' },
      { date: new Date('2024-01-28'), type: 'github' },
    ],
    startDate: new Date('2024-01-12')
  },
  {
    id: '3',
    name: 'API Gateway',
    description: 'Central API routing and rate limiting',
    estimatedProofs: 8,
    proofs: [
      { date: new Date('2024-01-05'), type: 'github' },
      { date: new Date('2024-01-08'), type: 'github' },
      { date: new Date('2024-01-10'), type: 'url' },
      { date: new Date('2024-01-12'), type: 'github' },
      { date: new Date('2024-01-15'), type: 'github' },
      { date: new Date('2024-01-18'), type: 'demo' },
      { date: new Date('2024-01-20'), type: 'github' },
      { date: new Date('2024-01-22'), type: 'url' },
    ],
    startDate: new Date('2024-01-05')
  },
  {
    id: '4',
    name: 'Mobile App',
    description: 'React Native mobile application',
    estimatedProofs: 15,
    proofs: [
      { date: new Date('2024-01-02'), type: 'github' },
      { date: new Date('2024-01-05'), type: 'screenshot' },
    ],
    startDate: new Date('2024-01-02')
  }
];

// State
let ships = [...sampleShips];
let selectedShipId = ships[0]?.id;

// DOM Elements
const tabs = document.getElementById('tabs');
const alertBanner = document.getElementById('alertBanner');
const alertTitle = document.getElementById('alertTitle');
const alertMessage = document.getElementById('alertMessage');

// Tab switching
tabs.addEventListener('click', (e) => {
  if (e.target.classList.contains('tab')) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    e.target.classList.add('active');
    const tabId = e.target.dataset.tab;
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'overview') drawVelocityChart();
    if (tabId === 'burndown') drawBurndownChart();
  }
});

// Calculations
function calculateForecast(ship) {
  const proofCount = ship.proofs.length;
  const progress = Math.round((proofCount / ship.estimatedProofs) * 100);
  
  // Calculate velocity (proofs per week)
  const now = new Date();
  const daysSinceStart = Math.max(1, Math.ceil((now - ship.startDate) / (1000 * 60 * 60 * 24)));
  const weeksSinceStart = daysSinceStart / 7;
  const velocity = weeksSinceStart > 0 ? (proofCount / weeksSinceStart).toFixed(1) : 0;
  
  // Calculate trend based on recent activity
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now - 28 * 24 * 60 * 60 * 1000);
  const recentProofs = ship.proofs.filter(p => p.date >= twoWeeksAgo).length;
  const olderProofs = ship.proofs.filter(p => p.date >= fourWeeksAgo && p.date < twoWeeksAgo).length;
  
  let trend = 'flat';
  if (recentProofs > olderProofs) trend = 'up';
  else if (recentProofs < olderProofs) trend = 'down';
  
  // Calculate status
  const lastProof = ship.proofs.length > 0 ? Math.max(...ship.proofs.map(p => p.date)) : ship.startDate;
  const daysSinceLastProof = Math.ceil((now - lastProof) / (1000 * 60 * 60 * 24));
  
  let status = 'healthy';
  if (daysSinceLastProof > 14) status = 'stalled';
  else if (daysSinceLastProof > 7 || velocity < 1) status = 'at-risk';
  
  // Predict completion
  let predictedCompletion = null;
  const remainingProofs = ship.estimatedProofs - proofCount;
  if (velocity > 0 && remainingProofs > 0) {
    const weeksRemaining = remainingProofs / velocity;
    predictedCompletion = new Date(now.getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000);
  } else if (proofCount >= ship.estimatedProofs) {
    predictedCompletion = new Date(); // Complete!
  }
  
  return {
    ship,
    progress,
    velocity: parseFloat(velocity),
    trend,
    status,
    predictedCompletion,
    daysStalled: daysSinceLastProof
  };
}

function getForecasts() {
  return ships.map(calculateForecast);
}

function getStalledShips() {
  return getForecasts().filter(f => f.status === 'stalled');
}

function getWeeklyVelocityData() {
  const weeks = [];
  const now = new Date();
  
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now - (i * 7 + 7) * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    
    let count = 0;
    ships.forEach(ship => {
      ship.proofs.forEach(p => {
        if (p.date >= weekStart && p.date < weekEnd) count++;
      });
    });
    
    const weekLabel = `W${8 - i}`;
    weeks.push({ week: weekLabel, count });
  }
  
  return weeks;
}

// Update functions
function updateAll() {
  updateStats();
  updateAlerts();
  updateShipList();
  updateShipSelector();
  updateComparison();
  drawVelocityChart();
}

function updateStats() {
  const forecasts = getForecasts();
  
  document.getElementById('activeShips').textContent = ships.length;
  document.getElementById('healthyCount').textContent = forecasts.filter(f => f.status === 'healthy').length;
  document.getElementById('atRiskCount').textContent = forecasts.filter(f => f.status === 'at-risk').length;
  document.getElementById('stalledCount').textContent = forecasts.filter(f => f.status === 'stalled').length;
  
  // Calculate average velocity
  const totalProofs = ships.reduce((sum, s) => sum + s.proofs.length, 0);
  const avgVelocity = forecasts.length > 0 
    ? (forecasts.reduce((sum, f) => sum + f.velocity, 0) / forecasts.length).toFixed(1)
    : 0;
  
  document.getElementById('avgVelocity').textContent = avgVelocity;
  document.getElementById('totalProofs').textContent = totalProofs;
  document.getElementById('shipsWithEta').textContent = forecasts.filter(f => f.predictedCompletion).length;
}

function updateAlerts() {
  const stalled = getStalledShips();
  
  if (stalled.length > 0) {
    alertBanner.style.display = 'flex';
    alertTitle.textContent = `${stalled.length} Stalled Ship${stalled.length > 1 ? 's' : ''}`;
    alertMessage.textContent = stalled.map(f => `${f.ship.name} (${f.daysStalled} days)`).join(', ');
  } else {
    alertBanner.style.display = 'none';
  }
}

function updateShipList() {
  const forecasts = getForecasts();
  const shipListEl = document.getElementById('shipList');
  
  shipListEl.innerHTML = forecasts.map(f => `
    <div class="ship-card" data-id="${f.ship.id}">
      <div class="ship-info">
        <h4>${f.ship.name}</h4>
        <div class="ship-meta">${f.ship.description}</div>
        <div class="progress-bar">
          <div class="progress-fill ${f.status}" style="width: ${f.progress}%"></div>
        </div>
      </div>
      <div class="ship-metrics">
        <div class="metric">
          <span class="metric-value">${f.ship.proofs.length}/${f.ship.estimatedProofs}</span>
          <span class="metric-label">Proofs</span>
        </div>
        <div class="metric">
          <span class="metric-value">${f.velocity}</span>
          <span class="metric-label">Per Week</span>
        </div>
        <div class="metric">
          <span class="trend ${f.trend}">${f.trend === 'up' ? '↑' : f.trend === 'down' ? '↓' : '→'}</span>
          <span class="metric-label">Trend</span>
        </div>
      </div>
      <div class="ship-status">
        <span class="status-badge ${f.status}">${f.status}</span>
        <div class="eta">${f.predictedCompletion ? 'ETA: ' + formatDate(f.predictedCompletion) : 'No ETA'}</div>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  shipListEl.querySelectorAll('.ship-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedShipId = card.dataset.id;
      document.querySelector('[data-tab="burndown"]').click();
    });
  });
}

function updateShipSelector() {
  const selectorEl = document.getElementById('shipSelector');
  
  selectorEl.innerHTML = ships.map(ship => `
    <button type="button" class="${ship.id === selectedShipId ? 'active' : ''}" data-id="${ship.id}">
      ${ship.name}
    </button>
  `).join('');
  
  selectorEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedShipId = btn.dataset.id;
      selectorEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateBurndownStats();
      drawBurndownChart();
    });
  });
}

function updateBurndownStats() {
  const ship = ships.find(s => s.id === selectedShipId);
  if (!ship) return;
  
  const forecast = calculateForecast(ship);
  
  document.getElementById('selectedShipName').textContent = ship.name;
  document.getElementById('progressPercent').textContent = forecast.progress + '%';
  document.getElementById('etaDate').textContent = forecast.predictedCompletion ? formatDate(forecast.predictedCompletion) : 'TBD';
  document.getElementById('shipVelocity').textContent = forecast.velocity;
  document.getElementById('trendIcon').textContent = forecast.trend === 'up' ? '↑' : forecast.trend === 'down' ? '↓' : '→';
  document.getElementById('trendLabel').textContent = forecast.trend.charAt(0).toUpperCase() + forecast.trend.slice(1);
}

function updateComparison() {
  const forecasts = getForecasts();
  const tableEl = document.getElementById('comparisonTable');
  
  tableEl.innerHTML = forecasts.map(f => `
    <tr>
      <td><strong>${f.ship.name}</strong></td>
      <td>
        <span class="mini-progress">
          <span class="mini-progress-fill ${f.status}" style="width: ${f.progress}%"></span>
        </span>
        ${f.progress}%
      </td>
      <td>${f.velocity}/wk</td>
      <td>${f.predictedCompletion ? formatDate(f.predictedCompletion) : '—'}</td>
      <td><span class="status-badge ${f.status}">${f.status}</span></td>
    </tr>
  `).join('');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Charts
function drawVelocityChart() {
  const canvas = document.getElementById('velocityChart');
  const ctx = canvas.getContext('2d');
  const data = getWeeklyVelocityData();
  
  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;
  const barWidth = (width - padding * 2) / data.length - 10;
  const maxValue = Math.max(...data.map(d => d.count), 1);
  
  ctx.clearRect(0, 0, width, height);
  
  // Draw bars
  data.forEach((d, i) => {
    const barHeight = ((d.count / maxValue) * (height - padding * 2));
    const x = padding + i * (barWidth + 10);
    const y = height - padding - barHeight;
    
    // Bar gradient
    const gradient = ctx.createLinearGradient(x, y, x, height - padding);
    gradient.addColorStop(0, '#22d3ee');
    gradient.addColorStop(1, '#7c3aed');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 4);
    ctx.fill();
    
    // Value label
    ctx.fillStyle = '#f8fafc';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(d.count, x + barWidth / 2, y - 8);
    
    // Week label
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(d.week, x + barWidth / 2, height - 15);
  });
}

function drawBurndownChart() {
  const canvas = document.getElementById('burndownChart');
  const ctx = canvas.getContext('2d');
  const ship = ships.find(s => s.id === selectedShipId);
  
  if (!ship) return;
  
  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;
  
  ctx.clearRect(0, 0, width, height);
  
  // Calculate data points
  const sortedProofs = [...ship.proofs].sort((a, b) => a.date - b.date);
  const totalEstimated = ship.estimatedProofs;
  
  // Build actual data
  const actualData = [{ x: 0, y: totalEstimated }];
  let remaining = totalEstimated;
  
  const startDate = ship.startDate;
  const now = new Date();
  const totalDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
  
  sortedProofs.forEach(proof => {
    const daysSinceStart = Math.ceil((proof.date - startDate) / (1000 * 60 * 60 * 24));
    remaining--;
    actualData.push({ x: daysSinceStart, y: remaining });
  });
  
  // Build ideal line
  const idealData = [
    { x: 0, y: totalEstimated },
    { x: totalDays * 1.5, y: 0 }
  ];
  
  // Scaling
  const maxX = Math.max(totalDays * 1.5, ...actualData.map(d => d.x));
  const maxY = totalEstimated;
  
  const scaleX = (x) => padding + (x / maxX) * (width - padding * 2);
  const scaleY = (y) => height - padding - (y / maxY) * (height - padding * 2);
  
  // Draw grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  
  // Horizontal grid lines
  for (let i = 0; i <= 4; i++) {
    const y = scaleY((maxY / 4) * i);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
  
  // Draw ideal line (dashed)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  idealData.forEach((p, i) => {
    if (i === 0) ctx.moveTo(scaleX(p.x), scaleY(p.y));
    else ctx.lineTo(scaleX(p.x), scaleY(p.y));
  });
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw actual line
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  actualData.forEach((p, i) => {
    if (i === 0) ctx.moveTo(scaleX(p.x), scaleY(p.y));
    else ctx.lineTo(scaleX(p.x), scaleY(p.y));
  });
  ctx.stroke();
  
  // Draw dots on actual line
  ctx.fillStyle = '#22d3ee';
  actualData.forEach(p => {
    ctx.beginPath();
    ctx.arc(scaleX(p.x), scaleY(p.y), 4, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Draw projected line
  const forecast = calculateForecast(ship);
  if (forecast.predictedCompletion && actualData.length > 1) {
    const lastPoint = actualData[actualData.length - 1];
    const predictedDays = Math.ceil((forecast.predictedCompletion - startDate) / (1000 * 60 * 60 * 24));
    
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(scaleX(lastPoint.x), scaleY(lastPoint.y));
    ctx.lineTo(scaleX(predictedDays), scaleY(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Axis labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Days', width / 2, height - 5);
  
  ctx.save();
  ctx.translate(12, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Remaining Proofs', 0, 0);
  ctx.restore();
  
  updateBurndownStats();
}

// Initialize
updateAll();
