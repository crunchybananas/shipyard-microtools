// Proof Insights - Personal Analytics Dashboard

// Sample Data
const sampleProofs = [
  { id: '1', url: 'https://github.com/user/auth-service', title: 'Auth Service', type: 'github', timestamp: new Date('2024-01-15T10:30:00'), skills: ['backend', 'security'] },
  { id: '2', url: 'https://github.com/user/dashboard-ui', title: 'Dashboard UI', type: 'github', timestamp: new Date('2024-01-18T14:20:00'), skills: ['frontend', 'design'] },
  { id: '3', url: 'https://myapp.vercel.app', title: 'Live Demo', type: 'url', timestamp: new Date('2024-01-20T09:00:00'), skills: ['frontend', 'devops'] },
  { id: '4', url: 'https://imgur.com/screenshot1', title: 'Mobile Design', type: 'screenshot', timestamp: new Date('2024-01-22T16:45:00'), skills: ['design', 'mobile'] },
  { id: '5', url: 'https://github.com/user/api-gateway', title: 'API Gateway', type: 'github', timestamp: new Date('2024-01-25T11:15:00'), skills: ['backend', 'architecture'] },
  { id: '6', url: 'https://loom.com/demo1', title: 'Feature Walkthrough', type: 'demo', timestamp: new Date('2024-01-28T13:30:00'), skills: ['communication', 'frontend'] },
  { id: '7', url: 'https://github.com/user/ml-pipeline', title: 'ML Pipeline', type: 'github', timestamp: new Date('2024-02-01T08:20:00'), skills: ['data', 'backend'] },
  { id: '8', url: 'https://figma.com/design1', title: 'App Redesign', type: 'screenshot', timestamp: new Date('2024-02-05T15:00:00'), skills: ['design', 'ux'] },
  { id: '9', url: 'https://github.com/user/testing-suite', title: 'Testing Suite', type: 'github', timestamp: new Date('2024-02-08T10:45:00'), skills: ['testing', 'backend'] },
  { id: '10', url: 'https://deployed-app.com', title: 'Production Deploy', type: 'url', timestamp: new Date('2024-02-10T17:30:00'), skills: ['devops', 'architecture'] },
];

// State
let proofs = [];

// DOM Elements
const tabs = document.getElementById('tabs');
const totalProofsEl = document.getElementById('totalProofs');
const skillAreasEl = document.getElementById('skillAreas');
const insightsCountEl = document.getElementById('insightsCount');
const proofTypesEl = document.getElementById('proofTypes');
const insightsListEl = document.getElementById('insightsList');
const skillBreakdownEl = document.getElementById('skillBreakdown');
const heatmapEl = document.getElementById('heatmap');
const radarCanvas = document.getElementById('radarCanvas');
const portfolioPreviewEl = document.getElementById('portfolioPreview');
const importTextEl = document.getElementById('importText');

// Tab switching
tabs.addEventListener('click', (e) => {
  if (e.target.classList.contains('tab')) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    e.target.classList.add('active');
    const tabId = e.target.dataset.tab;
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'skills') drawRadarChart();
    if (tabId === 'portfolio') updatePortfolio();
  }
});

// Button handlers
document.getElementById('loadSampleBtn').addEventListener('click', () => {
  proofs = [...sampleProofs];
  updateAll();
});

document.getElementById('importBtn').addEventListener('click', () => {
  const text = importTextEl.value.trim();
  if (!text) return;
  
  const lines = text.split('\n').filter(l => l.trim());
  lines.forEach(line => {
    const [url, title] = line.split(',').map(s => s.trim());
    if (url) {
      proofs.push({
        id: Date.now().toString() + Math.random(),
        url,
        title: title || 'Imported Proof',
        type: detectProofType(url),
        timestamp: new Date(),
        skills: detectSkills(url)
      });
    }
  });
  
  importTextEl.value = '';
  updateAll();
});

document.getElementById('copyPortfolioBtn').addEventListener('click', async () => {
  const markdown = generatePortfolioMarkdown();
  await navigator.clipboard.writeText(markdown);
  alert('Portfolio copied to clipboard!');
});

// Helper functions
function detectProofType(url) {
  if (url.includes('github.com')) return 'github';
  if (url.includes('loom.com') || url.includes('youtube.com')) return 'demo';
  if (url.includes('imgur.com') || url.includes('screenshot') || url.includes('figma.com')) return 'screenshot';
  return 'url';
}

function detectSkills(url) {
  const skills = [];
  if (url.includes('github')) skills.push('backend');
  if (url.includes('ui') || url.includes('frontend')) skills.push('frontend');
  if (url.includes('design') || url.includes('figma')) skills.push('design');
  if (skills.length === 0) skills.push('general');
  return skills;
}

// Calculate stats
function getProofTypeCounts() {
  const counts = { github: 0, url: 0, screenshot: 0, demo: 0 };
  proofs.forEach(p => counts[p.type] = (counts[p.type] || 0) + 1);
  return counts;
}

function getSkillScores() {
  const skillCounts = {};
  proofs.forEach(p => {
    p.skills.forEach(s => {
      skillCounts[s] = (skillCounts[s] || 0) + 1;
    });
  });
  
  const maxCount = Math.max(...Object.values(skillCounts), 1);
  return Object.entries(skillCounts).map(([name, count]) => ({
    name,
    score: Math.round((count / maxCount) * 100),
    proofCount: count
  })).sort((a, b) => b.score - a.score);
}

function getInsights() {
  const insights = [];
  const counts = getProofTypeCounts();
  const skills = getSkillScores();
  
  if (proofs.length >= 5) {
    insights.push({ icon: '🏆', title: 'Active Builder', description: `You've shipped ${proofs.length} proofs! Keep up the momentum.` });
  }
  
  if (counts.github > counts.url + counts.screenshot + counts.demo) {
    insights.push({ icon: '🐙', title: 'GitHub Champion', description: 'Most of your proofs come from GitHub. Consider adding demos for variety.' });
  }
  
  if (skills.length >= 3) {
    insights.push({ icon: '🎯', title: 'Multi-skilled', description: `You've demonstrated skills in ${skills.length} different areas.` });
  }
  
  if (counts.demo === 0 && proofs.length > 3) {
    insights.push({ icon: '💡', title: 'Add a Demo', description: 'Video demos can make your work more compelling to attestors.' });
  }
  
  if (skills[0]?.name) {
    insights.push({ icon: '⭐', title: `${skills[0].name} Expert`, description: `Your strongest area with ${skills[0].proofCount} proofs.` });
  }
  
  return insights;
}

function getTimePatterns() {
  const patterns = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = proofs.filter(p => {
        const d = new Date(p.timestamp);
        return d.getDay() === day && d.getHours() === hour;
      }).length;
      patterns.push({ day, hour, count });
    }
  }
  return patterns;
}

// Update functions
function updateAll() {
  updateOverview();
  updateSkills();
  updateHeatmap();
}

function updateOverview() {
  totalProofsEl.textContent = proofs.length;
  skillAreasEl.textContent = getSkillScores().length;
  
  const insights = getInsights();
  insightsCountEl.textContent = insights.length;
  
  // Proof types
  const counts = getProofTypeCounts();
  const total = proofs.length || 1;
  const icons = { github: '🐙', url: '🔗', screenshot: '📸', demo: '🎬' };
  
  proofTypesEl.innerHTML = Object.entries(counts).map(([type, count]) => `
    <div class="proof-type-row">
      <div class="proof-type-icon ${type}">${icons[type]}</div>
      <div class="proof-type-info">
        <div class="proof-type-name">${type}</div>
        <div class="proof-type-bar">
          <div class="proof-type-fill ${type}" style="width: ${(count / total) * 100}%"></div>
        </div>
      </div>
      <div class="proof-type-count">${count}</div>
    </div>
  `).join('');
  
  // Insights
  insightsListEl.innerHTML = insights.map(i => `
    <div class="insight">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-text">
        <div class="insight-title">${i.title}</div>
        <div class="insight-desc">${i.description}</div>
      </div>
    </div>
  `).join('') || '<p style="color: var(--muted);">Add some proofs to see insights.</p>';
}

function updateSkills() {
  const skills = getSkillScores();
  
  skillBreakdownEl.innerHTML = skills.map(s => `
    <div class="proof-type-row">
      <div class="proof-type-info">
        <div class="proof-type-name">${s.name}</div>
        <div class="proof-type-bar">
          <div class="proof-type-fill github" style="width: ${s.score}%"></div>
        </div>
      </div>
      <div class="proof-type-count">${s.proofCount}</div>
    </div>
  `).join('') || '<p style="color: var(--muted);">No skills data yet.</p>';
}

function drawRadarChart() {
  const ctx = radarCanvas.getContext('2d');
  const skills = getSkillScores().slice(0, 6); // Max 6 skills for radar
  
  const width = radarCanvas.width;
  const height = radarCanvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 40;
  
  ctx.clearRect(0, 0, width, height);
  
  if (skills.length < 3) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Add more proofs to see radar', centerX, centerY);
    return;
  }
  
  const angleStep = (Math.PI * 2) / skills.length;
  
  // Draw grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  
  for (let r = 30; r <= maxRadius; r += 30) {
    ctx.beginPath();
    for (let i = 0; i <= skills.length; i++) {
      const angle = angleStep * i - Math.PI / 2;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  
  // Draw spokes
  skills.forEach((_, i) => {
    const angle = angleStep * i - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * maxRadius, centerY + Math.sin(angle) * maxRadius);
    ctx.stroke();
  });
  
  // Draw data polygon
  ctx.beginPath();
  ctx.fillStyle = 'rgba(34, 211, 238, 0.3)';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  
  skills.forEach((skill, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const radius = (skill.score / 100) * maxRadius;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Draw labels
  ctx.fillStyle = '#f8fafc';
  ctx.font = '11px system-ui';
  ctx.textAlign = 'center';
  
  skills.forEach((skill, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const labelRadius = maxRadius + 20;
    const x = centerX + Math.cos(angle) * labelRadius;
    const y = centerY + Math.sin(angle) * labelRadius;
    ctx.fillText(skill.name, x, y + 4);
  });
}

function updateHeatmap() {
  const patterns = getTimePatterns();
  const maxCount = Math.max(...patterns.map(p => p.count), 1);
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  let html = '';
  
  for (let day = 0; day < 7; day++) {
    html += `<div class="heatmap-row">
      <div class="heatmap-label">${dayLabels[day]}</div>
      <div class="heatmap-cells">`;
    
    for (let hour = 0; hour < 24; hour++) {
      const pattern = patterns.find(p => p.day === day && p.hour === hour);
      const count = pattern?.count || 0;
      const level = count === 0 ? 0 : Math.ceil((count / maxCount) * 5);
      html += `<div class="heatmap-cell level-${level}" title="${hour}:00 - ${count} proofs"></div>`;
    }
    
    html += `</div></div>`;
  }
  
  html += `<div class="heatmap-hours">
    <div class="heatmap-hour">0h</div>
    <div class="heatmap-hour" style="margin-left: 66px;">6h</div>
    <div class="heatmap-hour" style="margin-left: 66px;">12h</div>
    <div class="heatmap-hour" style="margin-left: 66px;">18h</div>
  </div>`;
  
  heatmapEl.innerHTML = html;
}

function generatePortfolioMarkdown() {
  const skills = getSkillScores();
  const counts = getProofTypeCounts();
  
  let md = `# My Proof Portfolio\n\n`;
  md += `Generated on ${new Date().toLocaleDateString()}\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total Proofs:** ${proofs.length}\n`;
  md += `- **Skill Areas:** ${skills.length}\n`;
  md += `- **GitHub Proofs:** ${counts.github}\n`;
  md += `- **Live URLs:** ${counts.url}\n`;
  md += `- **Screenshots:** ${counts.screenshot}\n`;
  md += `- **Demos:** ${counts.demo}\n\n`;
  
  md += `## Skills\n\n`;
  skills.forEach(s => {
    md += `- **${s.name}:** ${s.proofCount} proofs (${s.score}%)\n`;
  });
  md += '\n';
  
  md += `## Proofs\n\n`;
  proofs.forEach(p => {
    md += `### ${p.title}\n`;
    md += `- URL: ${p.url}\n`;
    md += `- Type: ${p.type}\n`;
    md += `- Date: ${new Date(p.timestamp).toLocaleDateString()}\n`;
    md += `- Skills: ${p.skills.join(', ')}\n\n`;
  });
  
  return md;
}

function updatePortfolio() {
  portfolioPreviewEl.textContent = generatePortfolioMarkdown();
}

// Initialize
updateAll();
