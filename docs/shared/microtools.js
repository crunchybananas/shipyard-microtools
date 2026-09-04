(() => {
  const body = document.body;
  if (!body?.dataset.demo || body.dataset.demo === 'hub') return;

  let home = document.querySelector('.back');
  if (home instanceof HTMLAnchorElement) {
    home.textContent = 'All demos';
    home.classList.add('suite-home', 'suite-home--existing');
    body.append(home);
  } else {
    home = document.createElement('a');
    home.href = '../';
    home.className = 'suite-home';
    home.textContent = 'All demos';
    home.setAttribute('aria-label', 'Return to the Microtools demo gallery');
    body.append(home);
  }

  const theme = getComputedStyle(body).getPropertyValue('--suite-theme').trim();
  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color');
    document.head.append(themeMeta);
  }
  if (theme) themeMeta.setAttribute('content', theme);

  document.querySelectorAll('input, textarea, select').forEach(control => {
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby') || control.labels?.length) return;
    const field = control.closest('.control, .control-group, .input-section, .field-input, .node-field, .bulk-controls, .mini-control, .adsr-knob');
    const label = field?.querySelector('label');
    const name = label?.textContent?.replace(/\s+/g, ' ').trim() || control.getAttribute('placeholder');
    if (name) control.setAttribute('aria-label', name);
  });

  document.querySelectorAll('.status, #toast, [id$="Status"]').forEach(status => {
    if (!status.hasAttribute('role')) status.setAttribute('role', 'status');
    if (!status.hasAttribute('aria-live')) status.setAttribute('aria-live', 'polite');
  });

  document.querySelectorAll('canvas').forEach(canvas => {
    if (!canvas.getAttribute('aria-label')) canvas.setAttribute('aria-label', `${document.title} interactive canvas`);
  });

  body.dataset.suiteReady = 'true';
})();
