(() => {
  const body = document.body;
  if (!body?.dataset.demo || body.dataset.demo === 'hub') return;

  const existingHomes = [...body.querySelectorAll('a.suite-home')];
  let home = existingHomes[0] ?? body.querySelector('a.back[href]');

  if (!(home instanceof HTMLAnchorElement)) {
    home = document.createElement('a');
  }

  for (const duplicate of existingHomes.slice(1)) duplicate.remove();

  home.href = '../';
  home.classList.remove('back', 'back-link');
  home.classList.add('suite-home');
  home.dataset.suiteNav = 'home';
  home.setAttribute('aria-label', 'Return to the Microtools demo gallery');

  const fullLabel = document.createElement('span');
  fullLabel.className = 'suite-home__label suite-home__label--full';
  fullLabel.textContent = 'All demos';

  const compactLabel = document.createElement('span');
  compactLabel.className = 'suite-home__label suite-home__label--compact';
  compactLabel.textContent = 'Demos';

  home.replaceChildren(fullLabel, compactLabel);
  body.prepend(home);

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

  const scrollerDefinitions = [
    ['.palette', 'Generated color palette'],
    ['.a11y-grid', 'Palette accessibility checks'],
    ['.types-grid', 'Available data field types'],
    ['.reference-grid', 'Regular expression reference cards'],
    ['.counters', 'Rate limit counters'],
  ];
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let scrollerIndex = 0;

  const enhanceScroller = (scroller, label) => {
    if (!(scroller instanceof HTMLElement) || scroller.dataset.suiteScroller === 'true') return;

    scroller.dataset.suiteScroller = 'true';
    scroller.setAttribute('role', 'region');
    if (!scroller.getAttribute('aria-label')) scroller.setAttribute('aria-label', label);

    const cue = document.createElement('span');
    const cueId = `suite-scroll-cue-${body.dataset.demo}-${scrollerIndex++}`;
    cue.id = cueId;
    cue.className = 'suite-scroll-cue';
    cue.textContent = 'Swipe or use arrow keys →';
    cue.hidden = true;
    scroller.insertAdjacentElement('afterend', cue);

    const describedBy = new Set((scroller.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    describedBy.add(cueId);
    scroller.setAttribute('aria-describedby', [...describedBy].join(' '));

    const sync = () => {
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const scrollable = maxScroll > 3;
      const atStart = scroller.scrollLeft <= 3;
      const atEnd = scroller.scrollLeft >= maxScroll - 3;

      scroller.dataset.suiteScrollable = String(scrollable);
      cue.hidden = !scrollable;
      if (scrollable && !scroller.hasAttribute('tabindex')) {
        scroller.tabIndex = 0;
        scroller.dataset.suiteAddedTabindex = 'true';
      } else if (!scrollable && scroller.dataset.suiteAddedTabindex === 'true') {
        scroller.removeAttribute('tabindex');
        delete scroller.dataset.suiteAddedTabindex;
      }

      if (!scrollable) return;
      if (atEnd) cue.textContent = '← Swipe or use arrow keys';
      else if (atStart) cue.textContent = 'Swipe or use arrow keys →';
      else cue.textContent = '← More items →';
    };

    scroller.addEventListener('scroll', sync, { passive: true });
    scroller.addEventListener('keydown', event => {
      if (event.target !== scroller || scroller.dataset.suiteScrollable !== 'true') return;

      const distance = Math.max(140, scroller.clientWidth * 0.72);
      let target = null;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') target = scroller.scrollLeft + distance;
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') target = scroller.scrollLeft - distance;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = scroller.scrollWidth;
      if (target === null) return;

      event.preventDefault();
      scroller.scrollTo({
        left: target,
        behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
      });
    });

    if ('ResizeObserver' in window) new ResizeObserver(sync).observe(scroller);
    else window.addEventListener('resize', sync, { passive: true });
    new MutationObserver(sync).observe(scroller, { childList: true, subtree: true });
    requestAnimationFrame(sync);
  };

  for (const [selector, label] of scrollerDefinitions) {
    document.querySelectorAll(selector).forEach(scroller => enhanceScroller(scroller, label));
  }

  body.dataset.suiteReady = 'true';
})();
