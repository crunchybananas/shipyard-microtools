export function initializeBase64Tools(_element: HTMLElement) {
  const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
  const panels = document.querySelectorAll<HTMLElement>(".panel");
  const status = document.getElementById("status") as HTMLDivElement | null;

  const textInput = document.getElementById(
    "textInput",
  ) as HTMLTextAreaElement | null;
  const base64Input = document.getElementById(
    "base64Input",
  ) as HTMLTextAreaElement | null;
  const encodeTextBtn = document.getElementById(
    "encodeTextBtn",
  ) as HTMLButtonElement | null;
  const decodeTextBtn = document.getElementById(
    "decodeTextBtn",
  ) as HTMLButtonElement | null;

  const dropZone = document.getElementById("dropZone") as HTMLDivElement | null;
  const fileInput = document.getElementById(
    "fileInput",
  ) as HTMLInputElement | null;
  const filePreview = document.getElementById(
    "filePreview",
  ) as HTMLDivElement | null;
  const previewImg = document.getElementById(
    "previewImg",
  ) as HTMLImageElement | null;
  const fileName = document.getElementById(
    "fileName",
  ) as HTMLParagraphElement | null;
  const fileBase64Output = document.getElementById(
    "fileBase64Output",
  ) as HTMLTextAreaElement | null;
  const copyBase64Btn = document.getElementById(
    "copyBase64Btn",
  ) as HTMLButtonElement | null;
  const copyDataUrlBtn = document.getElementById(
    "copyDataUrlBtn",
  ) as HTMLButtonElement | null;

  if (!status || !textInput || !base64Input || !encodeTextBtn || !decodeTextBtn)
    return;
  if (
    !dropZone ||
    !fileInput ||
    !filePreview ||
    !previewImg ||
    !fileName ||
    !fileBase64Output
  )
    return;
  if (!copyBase64Btn || !copyDataUrlBtn) return;

  let currentDataUrl = "";

  const showStatus = (message: string, type: "success" | "error") => {
    status.textContent = message;
    status.className = `status ${type}`;
    setTimeout(() => {
      status.classList.add("hidden");
    }, 3000);
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((button) => button.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      const targetId = `${tab.dataset.tab}-panel`;
      const targetPanel = document.getElementById(targetId);
      targetPanel?.classList.add("active");
    });
  });

  encodeTextBtn.addEventListener("click", () => {
    const text = textInput.value;
    if (!text) {
      showStatus("Enter some text to encode", "error");
      return;
    }
    try {
      base64Input.value = btoa(unescape(encodeURIComponent(text)));
      showStatus("✓ Encoded successfully", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showStatus(`Encoding failed: ${message}`, "error");
    }
  });

  decodeTextBtn.addEventListener("click", () => {
    const b64 = base64Input.value.trim();
    if (!b64) {
      showStatus("Enter some Base64 to decode", "error");
      return;
    }
    try {
      textInput.value = decodeURIComponent(escape(atob(b64)));
      showStatus("✓ Decoded successfully", "success");
    } catch {
      showStatus("Decoding failed: Invalid Base64", "error");
    }
  });

  const handleFile = (file?: File | null) => {
    if (!file) return;

    fileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      currentDataUrl = reader.result;
      const base64Only = currentDataUrl.split(",")[1] ?? "";
      fileBase64Output.value = base64Only;

      if (file.type.startsWith("image/")) {
        previewImg.src = currentDataUrl;
        previewImg.style.display = "block";
      } else {
        previewImg.style.display = "none";
      }

      filePreview.classList.remove("hidden");
      showStatus("✓ File loaded", "success");
    };
    reader.readAsDataURL(file);
  };

  fileInput.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | null;
    handleFile(target?.files?.[0]);
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
    handleFile(event.dataTransfer?.files?.[0]);
  });

  copyBase64Btn.addEventListener("click", () => {
    const text = fileBase64Output.value;
    if (!text) {
      showStatus("Nothing to copy", "error");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showStatus("✓ Base64 copied", "success");
    });
  });

  copyDataUrlBtn.addEventListener("click", () => {
    if (!currentDataUrl) {
      showStatus("Nothing to copy", "error");
      return;
    }
    navigator.clipboard.writeText(currentDataUrl).then(() => {
      showStatus("✓ Data URL copied", "success");
    });
  });
}
