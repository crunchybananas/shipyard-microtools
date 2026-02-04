export function initializeJsonFormatter(_element: HTMLElement) {
  const jsonInput = document.getElementById("jsonInput") as HTMLTextAreaElement | null;
  const output = document.getElementById("output") as HTMLPreElement | null;
  const status = document.getElementById("status") as HTMLDivElement | null;
  const stats = document.getElementById("stats") as HTMLSpanElement | null;

  const formatBtn = document.getElementById("formatBtn") as HTMLButtonElement | null;
  const minifyBtn = document.getElementById("minifyBtn") as HTMLButtonElement | null;
  const validateBtn = document.getElementById("validateBtn") as HTMLButtonElement | null;
  const copyBtn = document.getElementById("copyBtn") as HTMLButtonElement | null;

  if (!jsonInput || !output || !status || !stats || !formatBtn || !minifyBtn || !validateBtn || !copyBtn) {
    return;
  }

  const showStatus = (message: string, type: "success" | "error") => {
    status.textContent = message;
    status.className = `status ${type}`;
    setTimeout(() => {
      status.classList.add("hidden");
    }, 3000);
  };

  const syntaxHighlight = (json: string) => {
    const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "number";
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "key";
          } else {
            cls = "string";
          }
        } else if (/true|false/.test(match)) {
          cls = "boolean";
        } else if (/null/.test(match)) {
          cls = "null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  const updateStats = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const keys = JSON.stringify(parsed).match(/"[^"]+"\s*:/g) || [];
      const chars = json.length;
      stats.textContent = `${keys.length} keys · ${chars.toLocaleString()} chars`;
    } catch {
      stats.textContent = "";
    }
  };

  formatBtn.addEventListener("click", () => {
    const input = jsonInput.value.trim();
    if (!input) {
      showStatus("Please enter some JSON", "error");
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      output.innerHTML = syntaxHighlight(formatted);
      updateStats(formatted);
      showStatus("✓ Formatted successfully", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      output.textContent = "";
      showStatus(`Invalid JSON: ${message}`, "error");
    }
  });

  minifyBtn.addEventListener("click", () => {
    const input = jsonInput.value.trim();
    if (!input) {
      showStatus("Please enter some JSON", "error");
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      output.innerHTML = syntaxHighlight(minified);
      updateStats(minified);
      showStatus(`✓ Minified: ${input.length} → ${minified.length} chars`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      output.textContent = "";
      showStatus(`Invalid JSON: ${message}`, "error");
    }
  });

  validateBtn.addEventListener("click", () => {
    const input = jsonInput.value.trim();
    if (!input) {
      showStatus("Please enter some JSON", "error");
      return;
    }

    try {
      JSON.parse(input);
      showStatus("✓ Valid JSON!", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showStatus(`✗ Invalid: ${message}`, "error");
    }
  });

  copyBtn.addEventListener("click", () => {
    const text = output.textContent;
    if (!text) {
      showStatus("Nothing to copy", "error");
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        showStatus("✓ Copied to clipboard", "success");
      })
      .catch(() => {
        showStatus("Failed to copy", "error");
      });
  });

  jsonInput.addEventListener("paste", () => {
    setTimeout(() => {
      formatBtn.click();
    }, 100);
  });
}
