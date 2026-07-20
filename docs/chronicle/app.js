// Chronicle - AI Work Journal

// Sample Data
const sampleProofs = [
  { id: '1', url: 'https://github.com/user/auth-service', title: 'Built Auth Service', type: 'github', timestamp: new Date('2024-01-15T10:30:00') },
  { id: '2', url: 'https://github.com/user/dashboard-ui', title: 'Dashboard UI Components', type: 'github', timestamp: new Date('2024-01-18T14:20:00') },
  { id: '3', url: 'https://myapp.vercel.app', title: 'Deployed to Production', type: 'url', timestamp: new Date('2024-01-20T09:00:00') },
  { id: '4', url: 'https://imgur.com/mobile-design', title: 'Mobile Responsive Design', type: 'screenshot', timestamp: new Date('2024-01-22T16:45:00') },
  { id: '5', url: 'https://loom.com/feature-demo', title: 'Feature Demo Video', type: 'demo', timestamp: new Date('2024-01-25T11:15:00') },
];

// State
const STORAGE_KEY = 'chronicle-proofs';
let proofs = loadProofs();
let selectedTemplate = 'weekly';
let currentStory = '';

// DOM Elements
const proofUrlEl = document.getElementById('proofUrl');
const proofTitleEl = document.getElementById('proofTitle');
const proofCountEl = document.getElementById('proofCount');
const timelineEl = document.getElementById('timeline');
const emptyTimelineEl = document.getElementById('emptyTimeline');
const templatesEl = document.getElementById('templates');
const templateLabelEl = document.getElementById('templateLabel');
const importFileEl = document.getElementById('importFile');
const storyCardEl = document.getElementById('storyCard');
const storyOutputEl = document.getElementById('storyOutput');

// Event Listeners
document.getElementById('addProofBtn').addEventListener('click', addProof);
document.getElementById('loadSampleBtn').addEventListener('click', loadSample);
document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
document.getElementById('importJsonBtn').addEventListener('click', () => importFileEl.click());
importFileEl.addEventListener('change', importJson);
document.getElementById('generateBtn').addEventListener('click', generateStory);
document.getElementById('copyStoryBtn').addEventListener('click', copyStory);
document.getElementById('exportMdBtn').addEventListener('click', exportMarkdown);

proofUrlEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addProof();
});

templatesEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('template-btn')) {
    document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    selectedTemplate = e.target.dataset.template;
    templateLabelEl.textContent = selectedTemplate;
  }
});

// Functions
function isValidProof(raw) {
  return raw && typeof raw === 'object' && typeof raw.url === 'string' && raw.url.trim() !== '';
}

function normalizeProof(raw, index) {
  const validTypes = ['github', 'url', 'screenshot', 'demo'];
  return {
    id: typeof raw.id === 'string' && /^[\w.-]+$/.test(raw.id) ? raw.id : Date.now().toString() + index,
    url: raw.url,
    title: typeof raw.title === 'string' && raw.title ? raw.title : extractTitleFromUrl(raw.url),
    type: validTypes.includes(raw.type) ? raw.type : detectProofType(raw.url),
    timestamp: isNaN(new Date(raw.timestamp)) ? new Date().toISOString() : raw.timestamp
  };
}

function loadProofs() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored.filter(isValidProof).map(normalizeProof) : [];
  } catch {
    return [];
  }
}

function saveProofs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
  } catch {
    // Storage unavailable (private mode, quota) - proofs stay in memory only
  }
}

function detectProofType(url) {
  if (url.includes('github.com')) return 'github';
  if (url.includes('loom.com') || url.includes('youtube.com') || url.includes('vimeo.com')) return 'demo';
  if (url.includes('imgur.com') || url.includes('screenshot') || url.includes('figma.com') || url.includes('.png') || url.includes('.jpg')) return 'screenshot';
  return 'url';
}

function addProof() {
  const url = proofUrlEl.value.trim();
  if (!url) return;
  
  const title = proofTitleEl.value.trim() || extractTitleFromUrl(url);
  
  proofs.push({
    id: Date.now().toString(),
    url,
    title,
    type: detectProofType(url),
    timestamp: new Date()
  });
  
  proofUrlEl.value = '';
  proofTitleEl.value = '';
  saveProofs();
  renderTimeline();
}

function extractTitleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.split('/').filter(Boolean);
    if (path.length > 0) {
      return path[path.length - 1].replace(/-/g, ' ').replace(/_/g, ' ');
    }
    return parsed.hostname;
  } catch {
    return 'Proof';
  }
}

function removeProof(id) {
  proofs = proofs.filter(p => p.id !== id);
  saveProofs();
  renderTimeline();
}

function loadSample() {
  proofs = sampleProofs.map(p => ({ ...p, id: Date.now().toString() + Math.random() }));
  saveProofs();
  renderTimeline();
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function renderTimeline() {
  proofCountEl.textContent = proofs.length;
  
  if (proofs.length === 0) {
    emptyTimelineEl.style.display = 'block';
    timelineEl.innerHTML = '';
    timelineEl.appendChild(emptyTimelineEl);
    return;
  }
  
  const sorted = [...proofs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const icons = { github: '🐙', url: '🔗', screenshot: '📸', demo: '🎬' };
  
  timelineEl.innerHTML = sorted.map(proof => `
    <div class="timeline-item" data-id="${proof.id}">
      <div class="timeline-dot">${icons[proof.type]}</div>
      <div class="timeline-content">
        <div class="timeline-date">${formatDate(proof.timestamp)}</div>
        <div class="timeline-title">
          <span class="timeline-type ${proof.type}">${proof.type}</span>
          ${escapeHtml(proof.title)}
        </div>
        <a href="${safeUrl(proof.url)}" target="_blank" rel="noopener" class="timeline-url">${escapeHtml(proof.url)}</a>
      </div>
      <button class="timeline-remove" onclick="removeProof('${proof.id}')" title="Remove">×</button>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const scheme = url.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
  return /^(javascript|data|vbscript):/.test(scheme) ? '#' : escapeHtml(url);
}

function generateStory() {
  if (proofs.length === 0) {
    alert('Add some proofs first to generate a story.');
    return;
  }

  currentStory = generateNarrative(selectedTemplate);

  storyCardEl.style.display = 'block';
  storyOutputEl.textContent = currentStory;
}

function generateNarrative(template) {
  const sorted = [...proofs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const types = { github: 0, url: 0, screenshot: 0, demo: 0 };
  sorted.forEach(p => types[p.type]++);
  
  const firstDate = formatDate(sorted[0].timestamp);
  const lastDate = formatDate(sorted[sorted.length - 1].timestamp);
  
  switch (template) {
    case 'weekly':
      return generateWeeklySummary(sorted, types, firstDate, lastDate);
    case 'case-study':
      return generateCaseStudy(sorted, types);
    case 'retrospective':
      return generateRetrospective(sorted, types, firstDate, lastDate);
    case 'pitch':
      return generatePitch(sorted, types);
    default:
      return generateWeeklySummary(sorted, types, firstDate, lastDate);
  }
}

function generateWeeklySummary(proofs, types, firstDate, lastDate) {
  return `# Weekly Summary

**Period:** ${firstDate} - ${lastDate}
**Total Proofs:** ${proofs.length}

## Highlights

This week was productive! Here's what got shipped:

${proofs.map((p, i) => `${i + 1}. **${p.title}** (${p.type})
   - Completed on ${formatDate(p.timestamp)}
   - [View Proof](${p.url})`).join('\n\n')}

## Breakdown by Type

- 🐙 GitHub Commits: ${types.github}
- 🔗 Live URLs: ${types.url}
- 📸 Screenshots: ${types.screenshot}
- 🎬 Demos: ${types.demo}

## Key Takeaways

- Shipped ${proofs.length} pieces of verifiable work
- ${types.github > 0 ? 'Strong code contribution activity' : 'Consider adding more code-based proofs'}
- ${types.demo > 0 ? 'Great demo coverage for stakeholders' : 'Adding demos could improve visibility'}

Keep shipping! 🚀`;
}

function generateCaseStudy(proofs, types) {
  const mainProof = proofs[0];
  return `# Case Study: ${mainProof.title}

## Overview

This case study documents the development and delivery of ${mainProof.title}, showcasing the complete journey from concept to completion.

## The Challenge

Building ${mainProof.title} required careful planning and execution. The goal was to deliver a high-quality solution that demonstrates real value.

## The Process

### Phase 1: Foundation
${proofs.slice(0, Math.ceil(proofs.length / 2)).map(p => `- ${p.title} (${formatDate(p.timestamp)})`).join('\n')}

### Phase 2: Refinement
${proofs.slice(Math.ceil(proofs.length / 2)).map(p => `- ${p.title} (${formatDate(p.timestamp)})`).join('\n')}

## Evidence of Work

${proofs.map(p => `- **${p.title}**: [${p.type} proof](${p.url})`).join('\n')}

## Results

- ${proofs.length} documented milestones
- ${types.github} code commits tracked
- ${types.demo + types.screenshot} visual demonstrations

## Conclusion

This project demonstrates a methodical approach to development with clear, verifiable progress at each stage.`;
}

function generateRetrospective(proofs, types, firstDate, lastDate) {
  return `# Retrospective: ${firstDate} to ${lastDate}

## What Went Well ✅

- Shipped ${proofs.length} verifiable proofs
- Maintained consistent progress throughout the period
${types.github > 0 ? '- Strong technical output with code contributions' : ''}
${types.demo > 0 ? '- Created compelling demos for stakeholders' : ''}

## Accomplishments

${proofs.map(p => `### ${p.title}
- Type: ${p.type}
- Date: ${formatDate(p.timestamp)}
- Evidence: ${p.url}`).join('\n\n')}

## What Could Be Improved 🔄

${types.demo === 0 ? '- Add video demos to better showcase work' : ''}
${types.screenshot === 0 ? '- Include more visual documentation' : ''}
${proofs.length < 5 ? '- Increase proof frequency for better progress tracking' : ''}
- Continue documenting work as it happens

## Action Items for Next Period

1. Maintain current proof cadence
2. ${types.demo === 0 ? 'Record at least one demo video' : 'Continue creating engaging demos'}
3. Share progress with the community

## Metrics

| Metric | Value |
|--------|-------|
| Total Proofs | ${proofs.length} |
| Code Proofs | ${types.github} |
| Visual Proofs | ${types.screenshot + types.demo} |
| Deployments | ${types.url} |`;
}

function generatePitch(proofs, types) {
  const latestProof = proofs[proofs.length - 1];
  return `# Ship Pitch: ${latestProof.title}

## 🚀 The Ship

**${latestProof.title}** is ready for attestation.

## 📋 Evidence Summary

This ship is backed by **${proofs.length} verified proofs**:

${proofs.map(p => `- [${p.type.toUpperCase()}] ${p.title}`).join('\n')}

## 💪 Why This Ship Matters

This represents real work, documented and verifiable:

1. **Code Quality** - ${types.github} GitHub contributions showing technical depth
2. **Visual Proof** - ${types.screenshot + types.demo} screenshots/demos for transparency
3. **Live Evidence** - ${types.url} deployed URLs you can verify right now

## 🔗 Proof Links

${proofs.map(p => `- ${p.title}: ${p.url}`).join('\n')}

## 🎯 Request

Looking for attestations from builders who value:
- Consistent, documented progress
- Real, verifiable output
- Quality over quantity

**Ready to attest? Every proof tells a story of work shipped.** 🛳️`;
}

async function copyStory() {
  if (currentStory) {
    await navigator.clipboard.writeText(currentStory);
    alert('Story copied to clipboard!');
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMarkdown() {
  if (!currentStory) return;

  downloadFile(currentStory, `chronicle-${selectedTemplate}-${new Date().toISOString().split('T')[0]}.md`, 'text/markdown');
}

function exportJson() {
  if (proofs.length === 0) {
    alert('No proofs to export.');
    return;
  }

  downloadFile(JSON.stringify(proofs, null, 2), `chronicle-proofs-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
}

function importJson() {
  const file = importFileEl.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('Expected a JSON array of proofs');

      const imported = data.filter(isValidProof).map(normalizeProof);
      if (imported.length === 0) {
        alert('No valid proofs found in that file.');
        return;
      }

      proofs = imported;
      saveProofs();
      renderTimeline();
    } catch {
      alert('Could not import: not a valid Chronicle JSON export.');
    }
  };
  reader.readAsText(file);
  importFileEl.value = '';
}

// Make removeProof available globally
window.removeProof = removeProof;

// Initialize
renderTimeline();
