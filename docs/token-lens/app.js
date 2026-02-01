const jwtInput = document.getElementById('jwtInput');
const headerOutput = document.getElementById('headerOutput');
const payloadOutput = document.getElementById('payloadOutput');
const signatureOutput = document.getElementById('signatureOutput');
const iatOutput = document.getElementById('iat');
const expOutput = document.getElementById('exp');
const decodeBtn = document.getElementById('decodeBtn');
const clearBtn = document.getElementById('clearBtn');
const verifyBtn = document.getElementById('verifyBtn');
const secretInput = document.getElementById('secretInput');
const verifyStatus = document.getElementById('verifyStatus');

const base64UrlDecode = (str) => {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
};

const prettyJson = (obj) => JSON.stringify(obj, null, 2);

const unixToDate = (value) => {
  if (!value) return '—';
  const date = new Date(value * 1000);
  return isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const decodeJwt = () => {
  const token = jwtInput.value.trim();
  if (!token || !token.includes('.')) {
    headerOutput.textContent = 'Invalid JWT';
    payloadOutput.textContent = '—';
    signatureOutput.textContent = '—';
    iatOutput.textContent = '—';
    expOutput.textContent = '—';
    return;
  }

  const [header, payload, signature] = token.split('.');
  try {
    const headerJson = JSON.parse(base64UrlDecode(header));
    const payloadJson = JSON.parse(base64UrlDecode(payload));
    headerOutput.textContent = prettyJson(headerJson);
    payloadOutput.textContent = prettyJson(payloadJson);
    signatureOutput.textContent = signature || '—';
    iatOutput.textContent = unixToDate(payloadJson.iat);
    expOutput.textContent = unixToDate(payloadJson.exp);
    verifyStatus.textContent = 'No verification attempted.';
  } catch (err) {
    headerOutput.textContent = 'Decode error';
    payloadOutput.textContent = err.message;
  }
};

async function verifyHs256() {
  const token = jwtInput.value.trim();
  const secret = secretInput.value.trim();
  if (!token || !secret) {
    verifyStatus.textContent = 'Provide a JWT and secret.';
    return;
  }

  const [header, payload, signature] = token.split('.');
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const keyData = new TextEncoder().encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signatureBytes = new Uint8Array(signatureBuffer);
  const computed = btoa(String.fromCharCode(...signatureBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  verifyStatus.textContent = computed === signature ? 'Signature valid ✅' : 'Signature invalid ❌';
}

const clearAll = () => {
  jwtInput.value = '';
  secretInput.value = '';
  headerOutput.textContent = '—';
  payloadOutput.textContent = '—';
  signatureOutput.textContent = '—';
  iatOutput.textContent = '—';
  expOutput.textContent = '—';
  verifyStatus.textContent = 'No verification attempted.';
};

decodeBtn.addEventListener('click', decodeJwt);
verifyBtn.addEventListener('click', verifyHs256);
clearBtn.addEventListener('click', clearAll);

jwtInput.addEventListener('input', decodeJwt);
