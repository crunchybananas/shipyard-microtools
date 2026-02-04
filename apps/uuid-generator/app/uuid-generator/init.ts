export function initializeUuidGenerator(_element: HTMLElement) {
  const status = document.getElementById("status") as HTMLDivElement | null;

  if (!status) return;

  const showStatus = (message: string) => {
    status.textContent = message;
    status.className = "status success";
    setTimeout(() => status.classList.add("hidden"), 2000);
  };

  const generateUUID4 = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const rand = (Math.random() * 16) | 0;
      const value = char === "x" ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    });
  };

  const generateUUID7 = () => {
    const now = Date.now();
    const timestamp = now.toString(16).padStart(12, "0");
    const random = Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 65536)
        .toString(16)
        .padStart(4, "0"),
    ).join("");

    return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${random.slice(0, 3)}-${(
      0x8 |
      ((Math.random() * 4) | 0)
    ).toString(16)}${random.slice(4, 7)}-${random.slice(7, 19)}`;
  };

  const generateNanoId = (size = 21) => {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let id = "";
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    for (let i = 0; i < size; i += 1) {
      id += alphabet[bytes[i]! % alphabet.length];
    }
    return id;
  };

  const generateShortId = () => {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    for (let i = 0; i < 8; i += 1) {
      id += alphabet[bytes[i]! % alphabet.length];
    }
    return id;
  };

  const generators = {
    uuid4: generateUUID4,
    uuid7: generateUUID7,
    nanoid: generateNanoId,
    shortid: generateShortId,
  } as const;

  const generateAll = () => {
    (Object.keys(generators) as Array<keyof typeof generators>).forEach(
      (type) => {
        const input = document.getElementById(type) as HTMLInputElement | null;
        if (input) {
          input.value = generators[type]();
        }
      },
    );
  };

  document
    .querySelectorAll<HTMLButtonElement>(".regen-btn")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const type = button.dataset.type as keyof typeof generators | undefined;
        if (!type) return;
        const input = document.getElementById(type) as HTMLInputElement | null;
        if (input) {
          input.value = generators[type]();
        }
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>(".copy-btn")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.target;
        if (!target) return;
        const input = document.getElementById(
          target,
        ) as HTMLInputElement | null;
        if (!input) return;
        navigator.clipboard.writeText(input.value).then(() => {
          showStatus("✓ Copied to clipboard");
        });
      });
    });

  const bulkType = document.getElementById(
    "bulkType",
  ) as HTMLSelectElement | null;
  const bulkCount = document.getElementById(
    "bulkCount",
  ) as HTMLInputElement | null;
  const bulkOutput = document.getElementById(
    "bulkOutput",
  ) as HTMLTextAreaElement | null;
  const bulkGenBtn = document.getElementById(
    "bulkGenBtn",
  ) as HTMLButtonElement | null;
  const copyBulkBtn = document.getElementById(
    "copyBulkBtn",
  ) as HTMLButtonElement | null;

  if (bulkType && bulkCount && bulkOutput && bulkGenBtn && copyBulkBtn) {
    bulkGenBtn.addEventListener("click", () => {
      const type = bulkType.value as keyof typeof generators;
      const count = Math.min(100, Math.max(1, parseInt(bulkCount.value) || 10));
      const ids = Array.from({ length: count }, () => generators[type]());
      bulkOutput.value = ids.join("\n");
    });

    copyBulkBtn.addEventListener("click", () => {
      if (!bulkOutput.value) return;
      navigator.clipboard.writeText(bulkOutput.value).then(() => {
        showStatus("✓ Copied all IDs");
      });
    });
  }

  generateAll();
}
