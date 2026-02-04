export function initializeTokenLens(_element: HTMLElement) {
  const jwtInput = document.getElementById("jwtInput") as HTMLTextAreaElement | null;
  const headerOutput = document.getElementById("headerOutput") as HTMLPreElement | null;
  const payloadOutput = document.getElementById("payloadOutput") as HTMLPreElement | null;
  const signatureOutput = document.getElementById("signatureOutput") as HTMLPreElement | null;
  const iatOutput = document.getElementById("iat") as HTMLSpanElement | null;
  const expOutput = document.getElementById("exp") as HTMLSpanElement | null;
  const decodeBtn = document.getElementById("decodeBtn") as HTMLButtonElement | null;
  const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement | null;
  const verifyBtn = document.getElementById("verifyBtn") as HTMLButtonElement | null;
  const secretInput = document.getElementById("secretInput") as HTMLInputElement | null;
  const verifyStatus = document.getElementById("verifyStatus") as HTMLParagraphElement | null;

  if (!jwtInput || !headerOutput || !payloadOutput || !signatureOutput || !iatOutput || !expOutput) return;
  if (!decodeBtn || !clearBtn || !verifyBtn || !secretInput || !verifyStatus) return;

  const base64UrlDecode = (value: string) => {
    const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
    const base64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
    return atob(base64);
  };

  const prettyJson = (obj: unknown) => JSON.stringify(obj, null, 2);

  const unixToDate = (value?: number) => {
    if (!value) return "—";
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  const decodeJwt = () => {
    const token = jwtInput.value.trim();
    if (!token || !token.includes(".")) {
      headerOutput.textContent = "Invalid JWT";
      payloadOutput.textContent = "—";
      signatureOutput.textContent = "—";
      iatOutput.textContent = "—";
      expOutput.textContent = "—";
      return;
    }

    const [header, payload, signature] = token.split(".");
    try {
      const headerJson = JSON.parse(base64UrlDecode(header));
      const payloadJson = JSON.parse(base64UrlDecode(payload));
      headerOutput.textContent = prettyJson(headerJson);
      payloadOutput.textContent = prettyJson(payloadJson);
      signatureOutput.textContent = signature || "—";
      iatOutput.textContent = unixToDate(payloadJson.iat as number | undefined);
      expOutput.textContent = unixToDate(payloadJson.exp as number | undefined);
      verifyStatus.textContent = "No verification attempted.";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Decode error";
      headerOutput.textContent = "Decode error";
      payloadOutput.textContent = message;
    }
  };

  const verifyHs256 = async () => {
    const token = jwtInput.value.trim();
    const secret = secretInput.value.trim();
    if (!token || !secret) {
      verifyStatus.textContent = "Provide a JWT and secret.";
      return;
    }

    const [header, payload, signature] = token.split(".");
    const data = new TextEncoder().encode(`${header}.${payload}`);
    const keyData = new TextEncoder().encode(secret);

    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    const signatureBytes = new Uint8Array(signatureBuffer);
    const computed = btoa(String.fromCharCode(...signatureBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    verifyStatus.textContent = computed === signature ? "Signature valid ✅" : "Signature invalid ❌";
  };

  const clearAll = () => {
    jwtInput.value = "";
    secretInput.value = "";
    headerOutput.textContent = "—";
    payloadOutput.textContent = "—";
    signatureOutput.textContent = "—";
    iatOutput.textContent = "—";
    expOutput.textContent = "—";
    verifyStatus.textContent = "No verification attempted.";
  };

  decodeBtn.addEventListener("click", decodeJwt);
  verifyBtn.addEventListener("click", verifyHs256);
  clearBtn.addEventListener("click", clearAll);

  jwtInput.addEventListener("input", decodeJwt);
}
