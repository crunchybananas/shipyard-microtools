// HTTP Status Code Reference
// Look up any HTTP status code with fun messages

const codeInput = document.getElementById('codeInput');
const lookupBtn = document.getElementById('lookupBtn');
const resultCard = document.getElementById('result');

const STATUS_CODES = {
  // 1xx Informational
  100: { name: 'Continue', message: 'Keep going, you are doing great!', emoji: '👍', category: 'informational' },
  101: { name: 'Switching Protocols', message: 'Hang on, changing gears...', emoji: '🔄', category: 'informational' },
  102: { name: 'Processing', message: 'Working on it, give me a sec...', emoji: '⏳', category: 'informational' },
  103: { name: 'Early Hints', message: 'Here is a sneak peek while you wait.', emoji: '👀', category: 'informational' },
  
  // 2xx Success
  200: { name: 'OK', message: 'Everything is fine. Ship it!', emoji: '✅', category: 'success' },
  201: { name: 'Created', message: 'Your resource has been born into this world.', emoji: '🎉', category: 'success' },
  202: { name: 'Accepted', message: 'Got it! I will work on this later.', emoji: '📬', category: 'success' },
  203: { name: 'Non-Authoritative Info', message: 'Here is info, but I got it secondhand.', emoji: '🤷', category: 'success' },
  204: { name: 'No Content', message: 'Success, but I have nothing to say.', emoji: '🤐', category: 'success' },
  205: { name: 'Reset Content', message: 'Done! Now clear your form.', emoji: '🧹', category: 'success' },
  206: { name: 'Partial Content', message: 'Here is part of what you asked for.', emoji: '🍕', category: 'success' },
  
  // 3xx Redirection
  300: { name: 'Multiple Choices', message: 'Pick one, any one!', emoji: '🎯', category: 'redirect' },
  301: { name: 'Moved Permanently', message: 'We have moved. Please update your bookmarks.', emoji: '📦', category: 'redirect' },
  302: { name: 'Found', message: 'Temporarily over here. Come back later.', emoji: '👉', category: 'redirect' },
  303: { name: 'See Other', message: 'Look over there instead.', emoji: '👀', category: 'redirect' },
  304: { name: 'Not Modified', message: 'Same as before. Use your cache.', emoji: '♻️', category: 'redirect' },
  307: { name: 'Temporary Redirect', message: 'Detour! Same method, different place.', emoji: '🚧', category: 'redirect' },
  308: { name: 'Permanent Redirect', message: 'We moved forever. Update everything.', emoji: '🏠', category: 'redirect' },
  
  // 4xx Client Error
  400: { name: 'Bad Request', message: 'Your request makes no sense. Try again.', emoji: '🤨', category: 'client-error' },
  401: { name: 'Unauthorized', message: 'Who are you? Show me your credentials.', emoji: '🔐', category: 'client-error' },
  402: { name: 'Payment Required', message: 'Pay up! This feature costs money.', emoji: '💳', category: 'client-error' },
  403: { name: 'Forbidden', message: 'I know who you are. You cannot pass.', emoji: '🚫', category: 'client-error' },
  404: { name: 'Not Found', message: 'This is not the endpoint you are looking for.', emoji: '👻', category: 'client-error' },
  405: { name: 'Method Not Allowed', message: 'You cannot do that here.', emoji: '✋', category: 'client-error' },
  406: { name: 'Not Acceptable', message: 'I cannot give you what you want in that format.', emoji: '🙅', category: 'client-error' },
  407: { name: 'Proxy Auth Required', message: 'Tell your proxy who you are first.', emoji: '🕵️', category: 'client-error' },
  408: { name: 'Request Timeout', message: 'You took too long. I got bored.', emoji: '⏰', category: 'client-error' },
  409: { name: 'Conflict', message: 'There is a conflict. Someone else got here first.', emoji: '⚔️', category: 'client-error' },
  410: { name: 'Gone', message: 'It was here. Now it is not. Forever.', emoji: '💨', category: 'client-error' },
  411: { name: 'Length Required', message: 'How big is your payload? Tell me!', emoji: '📏', category: 'client-error' },
  412: { name: 'Precondition Failed', message: 'Your conditions were not met.', emoji: '❌', category: 'client-error' },
  413: { name: 'Payload Too Large', message: 'Whoa, that is way too big!', emoji: '🐘', category: 'client-error' },
  414: { name: 'URI Too Long', message: 'Your URL is ridiculously long.', emoji: '📜', category: 'client-error' },
  415: { name: 'Unsupported Media Type', message: 'I do not speak that format.', emoji: '🗣️', category: 'client-error' },
  416: { name: 'Range Not Satisfiable', message: 'You asked for bytes I do not have.', emoji: '📊', category: 'client-error' },
  417: { name: 'Expectation Failed', message: 'I cannot meet your expectations.', emoji: '😞', category: 'client-error' },
  418: { name: "I'm a teapot", message: 'I refuse to brew coffee. I am a teapot.', emoji: '🫖', category: 'client-error' },
  421: { name: 'Misdirected Request', message: 'Wrong server, buddy.', emoji: '🚗', category: 'client-error' },
  422: { name: 'Unprocessable Entity', message: 'I understand you, but I cannot do that.', emoji: '🤷', category: 'client-error' },
  423: { name: 'Locked', message: 'This resource is locked down.', emoji: '🔒', category: 'client-error' },
  424: { name: 'Failed Dependency', message: 'Something else failed first.', emoji: '🎳', category: 'client-error' },
  425: { name: 'Too Early', message: 'Slow down, it is too early for that.', emoji: '🌅', category: 'client-error' },
  426: { name: 'Upgrade Required', message: 'You need to upgrade your protocol.', emoji: '⬆️', category: 'client-error' },
  428: { name: 'Precondition Required', message: 'You forgot the preconditions.', emoji: '📋', category: 'client-error' },
  429: { name: 'Too Many Requests', message: 'Slow down! You are being rate limited.', emoji: '🐌', category: 'client-error' },
  431: { name: 'Headers Too Large', message: 'Your headers are enormous!', emoji: '🗜️', category: 'client-error' },
  451: { name: 'Unavailable For Legal Reasons', message: 'Lawyers said no. Blame them.', emoji: '⚖️', category: 'client-error' },
  
  // 5xx Server Error
  500: { name: 'Internal Server Error', message: 'Something broke. It is not your fault. Probably.', emoji: '💥', category: 'server-error' },
  501: { name: 'Not Implemented', message: 'I do not know how to do that yet.', emoji: '🚧', category: 'server-error' },
  502: { name: 'Bad Gateway', message: 'The server behind me is broken.', emoji: '🔗', category: 'server-error' },
  503: { name: 'Service Unavailable', message: 'We are too busy or down for maintenance.', emoji: '🔧', category: 'server-error' },
  504: { name: 'Gateway Timeout', message: 'The server behind me is too slow.', emoji: '🐢', category: 'server-error' },
  505: { name: 'HTTP Version Not Supported', message: 'Upgrade your HTTP, grandpa.', emoji: '👴', category: 'server-error' },
  506: { name: 'Variant Also Negotiates', message: 'Server config is messed up.', emoji: '🔀', category: 'server-error' },
  507: { name: 'Insufficient Storage', message: 'The server ran out of disk space.', emoji: '💾', category: 'server-error' },
  508: { name: 'Loop Detected', message: 'Infinite loop detected. Aborting!', emoji: '🔁', category: 'server-error' },
  510: { name: 'Not Extended', message: 'The server needs more extensions.', emoji: '🧩', category: 'server-error' },
  511: { name: 'Network Auth Required', message: 'Log into the network first.', emoji: '📶', category: 'server-error' }
};

const CATEGORIES = {
  'informational': 'Informational',
  'success': 'Success',
  'redirect': 'Redirection',
  'client-error': 'Client Error',
  'server-error': 'Server Error'
};

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

function lookupCode(code) {
  const info = STATUS_CODES[code];
  
  if (!info) {
    resultCard.classList.add('hidden');
    alert(`Unknown status code: ${code}`);
    return;
  }
  
  document.getElementById('statusEmoji').textContent = info.emoji;
  document.getElementById('statusCode').textContent = code;
  document.getElementById('statusName').textContent = info.name;
  document.getElementById('statusMessage').textContent = info.message;
  
  const badge = document.getElementById('statusCategory');
  badge.textContent = CATEGORIES[info.category];
  badge.className = `category-badge ${info.category}`;
  
  resultCard.dataset.category = info.category;
  resultCard.classList.remove('hidden');
  
  // Scroll to result
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

lookupBtn.addEventListener('click', () => {
  const code = parseInt(codeInput.value);
  if (code >= 100 && code <= 599) {
    lookupCode(code);
  } else {
    alert('Please enter a valid HTTP status code (100-599)');
  }
});

codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    lookupBtn.click();
  }
});

// Initialize
initCodeGrids();
