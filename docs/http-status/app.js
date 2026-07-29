// HTTP Status Code Reference
// Look up any HTTP status code with fun messages

const codeInput = document.getElementById('codeInput');
const lookupBtn = document.getElementById('lookupBtn');
const resultCard = document.getElementById('result');
const noResult = document.getElementById('noResult');
const noResultMessage = document.getElementById('noResultMessage');
const searchResults = document.getElementById('searchResults');
const searchResultsTitle = document.getElementById('searchResultsTitle');
const searchResultsList = document.getElementById('searchResultsList');

const STATUS_CODES = {
  // 1xx Informational
  100: { name: 'Continue', message: 'Keep going, you are doing great!', emoji: '👍', category: 'informational',
    guidance: 'Interim reply to an Expect: 100-continue request — keep sending the request body. Most HTTP clients handle this automatically.' },
  101: { name: 'Switching Protocols', message: 'Hang on, changing gears...', emoji: '🔄', category: 'informational',
    guidance: 'The server agreed to switch to the protocol in your Upgrade header (e.g. WebSockets). Continue the conversation using the new protocol.' },
  102: { name: 'Processing', message: 'Working on it, give me a sec...', emoji: '⏳', category: 'informational',
    guidance: 'WebDAV interim response: the server is still working on a slow request. Keep the connection open and wait for the final status.' },
  103: { name: 'Early Hints', message: 'Here is a sneak peek while you wait.', emoji: '👀', category: 'informational',
    guidance: 'Start preloading the resources listed in the Link headers while the server prepares the final response.' },

  // 2xx Success
  200: { name: 'OK', message: 'Everything is fine. Ship it!', emoji: '✅', category: 'success',
    guidance: 'Nothing to fix — the request succeeded and the response body contains the result.' },
  201: { name: 'Created', message: 'Your resource has been born into this world.', emoji: '🎉', category: 'success',
    guidance: 'A new resource was created — read the Location header for its URL and store it if you need to reference it later.' },
  202: { name: 'Accepted', message: 'Got it! I will work on this later.', emoji: '📬', category: 'success',
    guidance: 'Accepted for asynchronous processing — poll a status endpoint or wait for a callback/webhook to learn the outcome.' },
  203: { name: 'Non-Authoritative Info', message: 'Here is info, but I got it secondhand.', emoji: '🤷', category: 'success',
    guidance: 'A proxy transformed the response on the way to you. Treat it like a 200, but the payload may differ from the origin server.' },
  204: { name: 'No Content', message: 'Success, but I have nothing to say.', emoji: '🤐', category: 'success',
    guidance: 'The request succeeded and there is intentionally no body — do not try to parse a response payload.' },
  205: { name: 'Reset Content', message: 'Done! Now clear your form.', emoji: '🧹', category: 'success',
    guidance: 'The request succeeded — reset the form or view that sent it. Like 204, there is no response body.' },
  206: { name: 'Partial Content', message: 'Here is part of what you asked for.', emoji: '🍕', category: 'success',
    guidance: 'Partial response to a Range request — check Content-Range and request the remaining ranges if you need the rest.' },

  // 3xx Redirection
  300: { name: 'Multiple Choices', message: 'Pick one, any one!', emoji: '🎯', category: 'redirect',
    guidance: 'Several representations exist — pick one from the response body list or follow the Location header if provided.' },
  301: { name: 'Moved Permanently', message: 'We have moved. Please update your bookmarks.', emoji: '📦', category: 'redirect',
    guidance: 'Update stored links to the Location URL — clients cache this aggressively, and some change POST to GET when following it.' },
  302: { name: 'Found', message: 'Temporarily over here. Come back later.', emoji: '👉', category: 'redirect',
    guidance: 'Follow the Location header but keep using the original URL for future requests. Use 307 if the method must be preserved.' },
  303: { name: 'See Other', message: 'Look over there instead.', emoji: '👀', category: 'redirect',
    guidance: 'Fetch the Location URL with GET — the classic Post/Redirect/Get pattern after a form submission.' },
  304: { name: 'Not Modified', message: 'Same as before. Use your cache.', emoji: '♻️', category: 'redirect',
    guidance: 'Your cached copy is still valid — serve it. If this is unexpected, check the ETag / If-Modified-Since headers you are sending.' },
  307: { name: 'Temporary Redirect', message: 'Detour! Same method, different place.', emoji: '🚧', category: 'redirect',
    guidance: 'Resend the exact same request (method and body preserved) to the Location URL, but keep the original URL for the future.' },
  308: { name: 'Permanent Redirect', message: 'We moved forever. Update everything.', emoji: '🏠', category: 'redirect',
    guidance: 'Like 301 but the method and body are preserved — update stored URLs to the Location header permanently.' },

  // 4xx Client Error
  400: { name: 'Bad Request', message: 'Your request makes no sense. Try again.', emoji: '🤨', category: 'client-error',
    guidance: 'The request is malformed — check the URL syntax, query parameters, JSON body, and encoding before retrying.' },
  401: { name: 'Unauthorized', message: 'Who are you? Show me your credentials.', emoji: '🔐', category: 'client-error',
    guidance: 'Missing or invalid credentials — send a valid Authorization header (see WWW-Authenticate for the scheme) or refresh an expired token.' },
  402: { name: 'Payment Required', message: 'Pay up! This feature costs money.', emoji: '💳', category: 'client-error',
    guidance: 'Reserved but used by some APIs for billing — check the provider docs for quota, plan, or payment requirements.' },
  403: { name: 'Forbidden', message: 'I know who you are. You cannot pass.', emoji: '🚫', category: 'client-error',
    guidance: 'You are authenticated but not allowed — check permissions, token scopes, or IP allowlists. Re-authenticating will not help.' },
  404: { name: 'Not Found', message: 'This is not the endpoint you are looking for.', emoji: '👻', category: 'client-error',
    guidance: 'Check the URL for typos, confirm the resource exists, and verify the route is registered on the server.' },
  405: { name: 'Method Not Allowed', message: 'You cannot do that here.', emoji: '✋', category: 'client-error',
    guidance: 'This route does not support that HTTP method — check the Allow response header for the methods it accepts.' },
  406: { name: 'Not Acceptable', message: 'I cannot give you what you want in that format.', emoji: '🙅', category: 'client-error',
    guidance: 'The server cannot satisfy your Accept headers — loosen Accept / Accept-Language / Accept-Encoding or request a supported format.' },
  407: { name: 'Proxy Auth Required', message: 'Tell your proxy who you are first.', emoji: '🕵️', category: 'client-error',
    guidance: 'Authenticate with the proxy first — send Proxy-Authorization using the scheme in the Proxy-Authenticate header.' },
  408: { name: 'Request Timeout', message: 'You took too long. I got bored.', emoji: '⏰', category: 'client-error',
    guidance: 'The server gave up waiting for the request — retry, and check for slow networks or clients that stall mid-request.' },
  409: { name: 'Conflict', message: 'There is a conflict. Someone else got here first.', emoji: '⚔️', category: 'client-error',
    guidance: 'The request conflicts with current state (duplicate, stale version) — refetch the resource and retry with fresh data.' },
  410: { name: 'Gone', message: 'It was here. Now it is not. Forever.', emoji: '💨', category: 'client-error',
    guidance: 'Deliberately removed for good — stop requesting it and delete any stored references or links.' },
  411: { name: 'Length Required', message: 'How big is your payload? Tell me!', emoji: '📏', category: 'client-error',
    guidance: 'Add a Content-Length header to the request — this server refuses bodies of unknown size.' },
  412: { name: 'Precondition Failed', message: 'Your conditions were not met.', emoji: '❌', category: 'client-error',
    guidance: 'A conditional header (If-Match, If-Unmodified-Since) failed — refetch the resource and retry with its current ETag.' },
  413: { name: 'Payload Too Large', message: 'Whoa, that is way too big!', emoji: '🐘', category: 'client-error',
    guidance: 'The body exceeds the server limit — shrink the payload, upload in chunks, or raise the server/proxy body-size limit.' },
  414: { name: 'URI Too Long', message: 'Your URL is ridiculously long.', emoji: '📜', category: 'client-error',
    guidance: 'Shorten the URL — move data into a POST body or trim query parameters (often caused by loops appending to the URL).' },
  415: { name: 'Unsupported Media Type', message: 'I do not speak that format.', emoji: '🗣️', category: 'client-error',
    guidance: 'The server rejects your Content-Type — send a supported format and make sure the header matches the actual body.' },
  416: { name: 'Range Not Satisfiable', message: 'You asked for bytes I do not have.', emoji: '📊', category: 'client-error',
    guidance: 'The Range header is outside the resource size — fix the byte range (see Content-Range) or drop the Range header.' },
  417: { name: 'Expectation Failed', message: 'I cannot meet your expectations.', emoji: '😞', category: 'client-error',
    guidance: 'The server cannot honor your Expect header — remove Expect: 100-continue and resend the request.' },
  418: { name: "I'm a teapot", message: 'I refuse to brew coffee. I am a teapot.', emoji: '🫖', category: 'client-error',
    guidance: 'An April Fools joke from RFC 2324 — real servers should not send it. If you see one, someone is having fun.' },
  421: { name: 'Misdirected Request', message: 'Wrong server, buddy.', emoji: '🚗', category: 'client-error',
    guidance: 'The request reached a server that cannot answer for that origin — check DNS, TLS/SNI config, and HTTP/2 connection reuse.' },
  422: { name: 'Unprocessable Entity', message: 'I understand you, but I cannot do that.', emoji: '🤷', category: 'client-error',
    guidance: 'The syntax is fine but the content fails validation — read the response body for field-level errors and fix the data.' },
  423: { name: 'Locked', message: 'This resource is locked down.', emoji: '🔒', category: 'client-error',
    guidance: 'WebDAV: the resource is locked — wait for the lock to be released (or release it) before retrying.' },
  424: { name: 'Failed Dependency', message: 'Something else failed first.', emoji: '🎳', category: 'client-error',
    guidance: 'WebDAV: an earlier request this one depends on failed — fix and replay that request first.' },
  425: { name: 'Too Early', message: 'Slow down, it is too early for that.', emoji: '🌅', category: 'client-error',
    guidance: 'The server refuses early (0-RTT) data to avoid replay attacks — retry after the TLS handshake completes.' },
  426: { name: 'Upgrade Required', message: 'You need to upgrade your protocol.', emoji: '⬆️', category: 'client-error',
    guidance: 'Switch to the protocol named in the Upgrade response header (e.g. a newer TLS or HTTP version), then retry.' },
  428: { name: 'Precondition Required', message: 'You forgot the preconditions.', emoji: '📋', category: 'client-error',
    guidance: 'The server requires a conditional request — add If-Match with the resource ETag to avoid lost-update races.' },
  429: { name: 'Too Many Requests', message: 'Slow down! You are being rate limited.', emoji: '🐌', category: 'client-error',
    guidance: 'You hit a rate limit — honor the Retry-After header and add client-side throttling with exponential backoff.' },
  431: { name: 'Headers Too Large', message: 'Your headers are enormous!', emoji: '🗜️', category: 'client-error',
    guidance: 'Trim request headers — the usual culprit is oversized cookies, so clear or shrink them.' },
  451: { name: 'Unavailable For Legal Reasons', message: 'Lawyers said no. Blame them.', emoji: '⚖️', category: 'client-error',
    guidance: 'Blocked for legal reasons (takedown, regional law) — the content may be reachable from another region or not at all.' },

  // 5xx Server Error
  500: { name: 'Internal Server Error', message: 'Something broke. It is not your fault. Probably.', emoji: '💥', category: 'server-error',
    guidance: 'A generic server-side crash — check the server logs and stack traces. Retrying may work if the failure is transient.' },
  501: { name: 'Not Implemented', message: 'I do not know how to do that yet.', emoji: '🚧', category: 'server-error',
    guidance: 'The server does not implement this method or feature — use a supported method or a different endpoint.' },
  502: { name: 'Bad Gateway', message: 'The server behind me is broken.', emoji: '🔗', category: 'server-error',
    guidance: 'A proxy got an invalid response from upstream — check the backend service health and proxy config; often transient.' },
  503: { name: 'Service Unavailable', message: 'We are too busy or down for maintenance.', emoji: '🔧', category: 'server-error',
    guidance: 'The server is overloaded or in maintenance — retry with backoff and honor the Retry-After header if present.' },
  504: { name: 'Gateway Timeout', message: 'The server behind me is too slow.', emoji: '🐢', category: 'server-error',
    guidance: 'The upstream server was too slow — check backend health and slow queries, or raise the proxy timeout if the work is legitimate.' },
  505: { name: 'HTTP Version Not Supported', message: 'Upgrade your HTTP, grandpa.', emoji: '👴', category: 'server-error',
    guidance: 'The server rejects the HTTP version of the request — retry with a version it supports (usually HTTP/1.1).' },
  506: { name: 'Variant Also Negotiates', message: 'Server config is messed up.', emoji: '🔀', category: 'server-error',
    guidance: 'A content-negotiation misconfiguration on the server — the chosen variant negotiates too. Fix the server config.' },
  507: { name: 'Insufficient Storage', message: 'The server ran out of disk space.', emoji: '💾', category: 'server-error',
    guidance: 'WebDAV: the server cannot store what the request needs — free up space server-side or send less data.' },
  508: { name: 'Loop Detected', message: 'Infinite loop detected. Aborting!', emoji: '🔁', category: 'server-error',
    guidance: 'WebDAV: the server hit an infinite loop while processing — fix the circular reference (e.g. bindings) on the server.' },
  510: { name: 'Not Extended', message: 'The server needs more extensions.', emoji: '🧩', category: 'server-error',
    guidance: 'The request is missing an extension the server requires — rarely seen; consult the server policy docs.' },
  511: { name: 'Network Auth Required', message: 'Log into the network first.', emoji: '📶', category: 'server-error',
    guidance: 'A captive portal is intercepting you — open a browser and log into the network (hotel or airport Wi-Fi).' }
};

const CATEGORIES = {
  'informational': 'Informational',
  'success': 'Success',
  'redirect': 'Redirection',
  'client-error': 'Client Error',
  'server-error': 'Server Error'
};

function mdnUrl(code) {
  return `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/${code}`;
}

// Initialize code grids
function initCodeGrids() {
  const grids = {
    '1xx': document.getElementById('codes-1xx'),
    '2xx': document.getElementById('codes-2xx'),
    '3xx': document.getElementById('codes-3xx'),
    '4xx': document.getElementById('codes-4xx'),
    '5xx': document.getElementById('codes-5xx')
  };

  Object.entries(STATUS_CODES).forEach(([code, info]) => {
    const prefix = code.charAt(0) + 'xx';
    const btn = document.createElement('button');
    btn.className = 'code-btn';
    btn.textContent = code;
    btn.title = info.name;
    btn.addEventListener('click', () => {
      codeInput.value = code;
      lookupCode(parseInt(code));
    });
    grids[prefix].appendChild(btn);
  });
}

function hideAllResults() {
  resultCard.classList.add('hidden');
  noResult.classList.add('hidden');
  searchResults.classList.add('hidden');
}

function showNoMatches(message) {
  hideAllResults();
  noResultMessage.textContent = message;
  noResult.classList.remove('hidden');
}

function searchCodes(query) {
  const q = query.toLowerCase();
  return Object.entries(STATUS_CODES)
    .filter(([code, info]) => {
      const haystack = `${code} ${info.name} ${CATEGORIES[info.category]} ${info.message}`.toLowerCase();
      return haystack.includes(q);
    })
    .map(([code]) => parseInt(code));
}

function showSearchResults(query, codes) {
  hideAllResults();
  searchResultsTitle.textContent = `${codes.length} matches for “${query}”`;
  searchResultsList.innerHTML = '';

  codes.forEach((code) => {
    const info = STATUS_CODES[code];
    const btn = document.createElement('button');
    btn.className = 'search-result-btn';

    const emoji = document.createElement('span');
    emoji.className = 'search-result-emoji';
    emoji.textContent = info.emoji;

    const codeSpan = document.createElement('span');
    codeSpan.className = `search-result-code ${info.category}`;
    codeSpan.textContent = code;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'search-result-name';
    nameSpan.textContent = info.name;

    btn.append(emoji, codeSpan, nameSpan);
    btn.addEventListener('click', () => lookupCode(code));
    searchResultsList.appendChild(btn);
  });

  searchResults.classList.remove('hidden');
}

function lookupCode(code) {
  const info = STATUS_CODES[code];

  if (!info) {
    showNoMatches(`Unknown status code: ${code}. Try a standard code like 404, or search by keyword.`);
    return;
  }

  hideAllResults();

  document.getElementById('statusEmoji').textContent = info.emoji;
  document.getElementById('statusCode').textContent = code;
  document.getElementById('statusName').textContent = info.name;
  document.getElementById('statusMessage').textContent = info.message;
  document.getElementById('statusGuidance').textContent = info.guidance;
  document.getElementById('mdnLink').href = mdnUrl(code);

  const badge = document.getElementById('statusCategory');
  badge.textContent = CATEGORIES[info.category];
  badge.className = `category-badge ${info.category}`;

  resultCard.dataset.category = info.category;
  resultCard.classList.remove('hidden');

  // Scroll to result
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function runLookup() {
  const query = codeInput.value.trim();

  if (!query) {
    showNoMatches('Type a status code like 404, or a keyword like “teapot” or “redirect”.');
    return;
  }

  // Exact numeric code wins
  if (/^\d+$/.test(query) && STATUS_CODES[parseInt(query)]) {
    lookupCode(parseInt(query));
    return;
  }

  const matches = searchCodes(query);

  if (matches.length === 0) {
    showNoMatches(`No matches for “${query}”. Try a code like 404 or a keyword like “redirect”.`);
  } else if (matches.length === 1) {
    codeInput.value = matches[0];
    lookupCode(matches[0]);
  } else {
    showSearchResults(query, matches);
  }
}

lookupBtn.addEventListener('click', runLookup);

codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runLookup();
  }
});

// Initialize
initCodeGrids();
