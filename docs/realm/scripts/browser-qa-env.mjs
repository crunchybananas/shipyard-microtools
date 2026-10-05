// Optional preload for an existing Chrome installation and file-origin QA.
// Defaults remain Playwright's normal bundled Chromium and HTTP test server.
import {chromium} from '@playwright/test';
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({
 ...options,
 ...(process.env.REALM_BROWSER_CHANNEL ? {channel:process.env.REALM_BROWSER_CHANNEL}:{}),
 ...(process.env.REALM_QA_URL?.startsWith('file:') ? {args:[...(options?.args||[]),'--allow-file-access-from-files']}:{}),
});
