document.addEventListener('DOMContentLoaded', () => {
  const shipTitle = document.getElementById('shipTitle');
  const shipStatus = document.getElementById('shipStatus');
  const attestations = document.getElementById('attestations');
  const proofUrl = document.getElementById('proofUrl');
  const generateBtn = document.getElementById('generateBtn');
  const preview = document.getElementById('preview');
  const badgePreview = document.getElementById('badgePreview');
  const markdownCode = document.getElementById('markdownCode');
  const htmlCode = document.getElementById('htmlCode');
  const urlCode = document.getElementById('urlCode');
  const styleButtons = document.querySelectorAll('.style-btn');

  let selectedStyle = 'flat';

  // Style button selection
  styleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      styleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStyle = btn.dataset.style;
    });
  });

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.target;
      const code = document.getElementById(targetId).textContent;

      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '📋 Copy';
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        btn.textContent = '❌ Failed';
        setTimeout(() => {
          btn.textContent = '📋 Copy';
        }, 2000);
      }
    });
  });

  generateBtn.addEventListener('click', generateBadge);

  function generateBadge() {
    const title = shipTitle.value.trim() || 'My Ship';
    const status = shipStatus.value;
    const attestCount = parseInt(attestations.value, 10);
    const link = proofUrl.value.trim();

    // Determine badge text and color based on status
    let badgeText = '';
    let color = '';

    switch (status) {
      case 'verified':
        badgeText = 'Verified';
        color = '22c55e'; // green
        break;
      case 'rejected':
        badgeText = 'Rejected';
        color = 'ef4444'; // red
        break;
      case 'pending':
      default:
        badgeText = `Pending_(${attestCount}%2F3)`;
        color = attestCount >= 2 ? 'eab308' : '94a3b8'; // yellow if close, gray otherwise
        break;
    }

    // Encode title for URL
    const encodedTitle = encodeURIComponent(title).replace(/-/g, '--').replace(/_/g, '__');

    // Build Shields.io URL
    const baseUrl = 'https://img.shields.io/badge';
    const badgeUrl = `${baseUrl}/Shipyard:_${encodedTitle}-${badgeText}-${color}?style=${selectedStyle}`;

    // Display badge preview
    const img = document.createElement('img');
    img.src = badgeUrl;
    img.alt = `Shipyard: ${title}`;
    img.onerror = () => {
      badgePreview.innerHTML = '<p style="color: #ef4444;">Failed to load badge preview</p>';
    };

    badgePreview.innerHTML = '';
    badgePreview.appendChild(img);

    // Generate embed codes
    const altText = `Shipyard: ${title}`;

    if (link) {
      markdownCode.textContent = `[![${altText}](${badgeUrl})](${link})`;
      htmlCode.textContent = `<a href="${link}"><img src="${badgeUrl}" alt="${altText}" /></a>`;
    } else {
      markdownCode.textContent = `![${altText}](${badgeUrl})`;
      htmlCode.textContent = `<img src="${badgeUrl}" alt="${altText}" />`;
    }

    urlCode.textContent = badgeUrl;

    // Show preview section
    preview.classList.remove('hidden');

    // Smooth scroll to preview
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Live update attestation range label
  attestations.addEventListener('input', () => {
    const labels = document.querySelectorAll('.range-labels span');
    labels.forEach((label, i) => {
      if (i === parseInt(attestations.value, 10)) {
        label.style.fontWeight = 'bold';
        label.style.color = '#818cf8';
      } else {
        label.style.fontWeight = 'normal';
        label.style.color = '#94a3b8';
      }
    });
  });

  // Initialize range label
  attestations.dispatchEvent(new Event('input'));
});
