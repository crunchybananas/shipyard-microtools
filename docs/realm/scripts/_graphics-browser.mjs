import {chromium, webkit} from '@playwright/test';

// Keep graphics checks identical across installed Chrome and Playwright WebKit.
// PLAYWRIGHT_BROWSERS_PATH may point to a temporary test-browser installation.
export function launchGraphicsBrowser() {
  const selected = process.env.REALM_BROWSER || 'chrome';
  return selected === 'webkit'
    ? webkit.launch({headless: true})
    : chromium.launch({headless: true, ...(selected === 'chromium' ? {} : {channel: selected})});
}

export const graphicsBrowserSuffix = process.env.REALM_BROWSER === 'webkit' ? '-webkit' : '';
