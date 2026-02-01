// Ship Roast Bot - Analyze proof URLs and give honest feedback
// Works entirely client-side with heuristic analysis

const proofUrlInput = document.getElementById('proofUrl');
const shipTitleInput = document.getElementById('shipTitle');
const shipDescInput = document.getElementById('shipDescription');
const roastBtn = document.getElementById('roastBtn');
const resultsDiv = document.getElementById('results');

roastBtn.addEventListener('click', analyzeShip);

async function analyzeShip() {
  const proofUrl = proofUrlInput.value.trim();
  const title = shipTitleInput.value.trim();
  const description = shipDescInput.value.trim();

  if (!proofUrl) {
    alert('Please enter a proof URL');
    return;
  }

  // Show loading state
  roastBtn.disabled = true;
  roastBtn.querySelector('.btn-text').style.display = 'none';
  roastBtn.querySelector('.btn-loading').style.display = 'inline';

  try {
    const analysis = await performAnalysis(proofUrl, title, description);
    displayResults(analysis);
  } catch (error) {
    console.error('Analysis failed:', error);
    alert('Analysis failed. Please check the URL and try again.');
  } finally {
    roastBtn.disabled = false;
    roastBtn.querySelector('.btn-text').style.display = 'inline';
    roastBtn.querySelector('.btn-loading').style.display = 'none';
  }
}

async function performAnalysis(url, title, description) {
  const analysis = {
    proof: { score: 0, feedback: [] },
    readme: { score: 0, feedback: [] },
    demo: { score: 0, feedback: [] },
    originality: { score: 0, feedback: [] },
    suggestions: [],
    overall: 0,
    verdict: '',
    attestVerdict: 'unsure',
    attestReason: ''
  };

  // Parse URL type
  const urlLower = url.toLowerCase();
  const isGitHub = urlLower.includes('github.com');
  const isGitLab = urlLower.includes('gitlab.com');
  const isNpm = urlLower.includes('npmjs.com');
  const isDemo = urlLower.includes('vercel.app') || 
                 urlLower.includes('netlify.app') || 
                 urlLower.includes('github.io') ||
                 urlLower.includes('herokuapp.com');

  // === PROOF URL ANALYSIS ===
  let proofScore = 5;
  
  if (isGitHub || isGitLab) {
    proofScore += 2;
    analysis.proof.feedback.push({ text: 'Git repository URL ✓', type: 'good' });
    
    // Check if it's a proper repo URL (not just github.com)
    const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (repoMatch) {
      proofScore += 1;
      analysis.proof.feedback.push({ text: `Valid repo: ${repoMatch[1]}/${repoMatch[2]}`, type: 'good' });
    } else {
      proofScore -= 2;
      analysis.proof.feedback.push({ text: 'URL doesn\'t point to a specific repo', type: 'bad' });
    }
  } else if (isDemo) {
    proofScore += 1;
    analysis.proof.feedback.push({ text: 'Live demo URL', type: 'good' });
    analysis.suggestions.push('Consider also linking to source code repo');
  } else if (isNpm) {
    proofScore += 2;
    analysis.proof.feedback.push({ text: 'NPM package URL', type: 'good' });
  } else if (url.startsWith('https://')) {
    analysis.proof.feedback.push({ text: 'HTTPS URL ✓', type: 'good' });
  } else if (url.startsWith('http://')) {
    proofScore -= 2;
    analysis.proof.feedback.push({ text: 'No HTTPS - security concern', type: 'bad' });
    analysis.suggestions.push('Use HTTPS for your proof URL');
  }

  // Check for common bad patterns
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    proofScore = 1;
    analysis.proof.feedback.push({ text: 'Localhost URL - not publicly accessible!', type: 'bad' });
    analysis.suggestions.push('Deploy your project to a public URL');
  }

  analysis.proof.score = Math.max(1, Math.min(10, proofScore));

  // === README ANALYSIS (based on heuristics) ===
  let readmeScore = 5;

  if (isGitHub) {
    readmeScore += 1;
    analysis.readme.feedback.push({ text: 'GitHub repos usually have READMEs', type: 'good' });
    
    // Heuristic checks based on URL patterns
    if (url.includes('/blob/') || url.includes('/tree/')) {
      analysis.readme.feedback.push({ text: 'Links to specific path - good for context', type: 'good' });
      readmeScore += 1;
    }
  }

  if (description && description.length > 50) {
    readmeScore += 2;
    analysis.readme.feedback.push({ text: 'Good description length', type: 'good' });
  } else if (description && description.length > 0) {
    readmeScore += 1;
    analysis.readme.feedback.push({ text: 'Description is short', type: 'warn' });
    analysis.suggestions.push('Expand your description to explain what the project does');
  } else {
    readmeScore -= 1;
    analysis.readme.feedback.push({ text: 'No description provided', type: 'bad' });
    analysis.suggestions.push('Add a clear description of what your ship does');
  }

  if (title && title.length > 3) {
    readmeScore += 1;
    analysis.readme.feedback.push({ text: 'Has a title', type: 'good' });
  }

  analysis.readme.score = Math.max(1, Math.min(10, readmeScore));

  // === DEMO PRESENCE ===
  let demoScore = 4;

  if (isDemo) {
    demoScore = 9;
    analysis.demo.feedback.push({ text: 'Live demo available!', type: 'good' });
  } else if (isGitHub) {
    demoScore = 5;
    analysis.demo.feedback.push({ text: 'No live demo detected', type: 'warn' });
    analysis.suggestions.push('Add a live demo link (Vercel, Netlify, GitHub Pages)');
    
    if (url.includes('github.io')) {
      demoScore = 8;
      analysis.demo.feedback.push({ text: 'GitHub Pages demo', type: 'good' });
    }
  }

  // Check description for demo mentions
  const descLower = (description || '').toLowerCase();
  if (descLower.includes('demo') || descLower.includes('try it') || descLower.includes('live')) {
    demoScore += 1;
    analysis.demo.feedback.push({ text: 'Description mentions demo/live version', type: 'good' });
  }

  analysis.demo.score = Math.max(1, Math.min(10, demoScore));

  // === ORIGINALITY ===
  let origScore = 5;

  // Generic title detection
  const titleLower = (title || '').toLowerCase();
  const genericTitles = ['test', 'demo', 'example', 'hello world', 'my project', 'untitled', 'new project'];
  if (genericTitles.some(g => titleLower.includes(g))) {
    origScore -= 2;
    analysis.originality.feedback.push({ text: 'Generic title - be more specific', type: 'bad' });
    analysis.suggestions.push('Choose a unique, descriptive name for your ship');
  } else if (title && title.length > 5) {
    origScore += 1;
    analysis.originality.feedback.push({ text: 'Unique title', type: 'good' });
  }

  // Check for common low-effort patterns
  if (urlLower.includes('todo') || urlLower.includes('calculator') || urlLower.includes('weather-app')) {
    origScore -= 2;
    analysis.originality.feedback.push({ text: 'Common tutorial project detected', type: 'warn' });
    analysis.suggestions.push('Add unique features to stand out from tutorial projects');
  }

  // Bonus for Shipyard-specific tools
  if (titleLower.includes('shipyard') || descLower.includes('shipyard') || urlLower.includes('shipyard')) {
    origScore += 2;
    analysis.originality.feedback.push({ text: 'Shipyard ecosystem tool - bonus points!', type: 'good' });
  }

  analysis.originality.score = Math.max(1, Math.min(10, origScore));

  // === OVERALL SCORE ===
  const weights = { proof: 0.3, readme: 0.25, demo: 0.25, originality: 0.2 };
  analysis.overall = Math.round(
    analysis.proof.score * weights.proof +
    analysis.readme.score * weights.readme +
    analysis.demo.score * weights.demo +
    analysis.originality.score * weights.originality
  );

  // === VERDICT ===
  if (analysis.overall >= 8) {
    analysis.verdict = "🚀 Ship it! This looks ready for attestation. You've put in solid work.";
    analysis.attestVerdict = 'valid';
    analysis.attestReason = 'Clear proof, good documentation, demonstrates effort.';
  } else if (analysis.overall >= 6) {
    analysis.verdict = "👍 Pretty good! A few tweaks and this will be solid. Check the suggestions below.";
    analysis.attestVerdict = 'valid';
    analysis.attestReason = 'Meets the bar, though there\'s room for improvement.';
  } else if (analysis.overall >= 4) {
    analysis.verdict = "🤔 Needs work. The proof is there but it's not compelling yet. Improve before submitting.";
    analysis.attestVerdict = 'unsure';
    analysis.attestReason = 'Not enough evidence this is a quality ship.';
  } else {
    analysis.verdict = "😬 Not ready. This needs significant improvements before it's ship-worthy. Don't submit yet.";
    analysis.attestVerdict = 'invalid';
    analysis.attestReason = 'Missing critical elements like accessible proof or clear documentation.';
  }

  // Add some roast flavor
  if (analysis.overall <= 3) {
    analysis.suggestions.unshift("☕ Take a step back and ask: would YOU attest this?");
  }

  return analysis;
}

function displayResults(analysis) {
  resultsDiv.classList.remove('hidden');

  // Overall score
  document.getElementById('overallScore').textContent = analysis.overall;

  // Verdict
  const verdictCard = document.getElementById('verdictCard');
  verdictCard.className = 'verdict-card';
  if (analysis.overall >= 8) verdictCard.classList.add('excellent');
  else if (analysis.overall >= 6) verdictCard.classList.add('good');
  else if (analysis.overall >= 4) verdictCard.classList.add('fair');
  else verdictCard.classList.add('poor');
  document.getElementById('verdictText').textContent = analysis.verdict;

  // Category scores
  displayCategory('proof', analysis.proof);
  displayCategory('readme', analysis.readme);
  displayCategory('demo', analysis.demo);
  displayCategory('originality', analysis.originality);

  // Suggestions
  const suggestionsList = document.getElementById('suggestionsList');
  suggestionsList.innerHTML = '';
  if (analysis.suggestions.length === 0) {
    suggestionsList.innerHTML = '<li>✨ No major issues found!</li>';
  } else {
    analysis.suggestions.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      suggestionsList.appendChild(li);
    });
  }

  // Attest prediction
  const attestBadge = document.getElementById('attestVerdict');
  attestBadge.className = 'attest-badge ' + analysis.attestVerdict;
  attestBadge.textContent = analysis.attestVerdict.toUpperCase();
  document.getElementById('attestReason').textContent = analysis.attestReason;

  // Scroll to results
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function displayCategory(name, data) {
  document.getElementById(`${name}Score`).textContent = `${data.score}/10`;
  
  const feedbackList = document.getElementById(`${name}Feedback`);
  feedbackList.innerHTML = '';
  
  data.feedback.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.text;
    li.className = item.type;
    feedbackList.appendChild(li);
  });

  if (data.feedback.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No specific feedback';
    feedbackList.appendChild(li);
  }
}
