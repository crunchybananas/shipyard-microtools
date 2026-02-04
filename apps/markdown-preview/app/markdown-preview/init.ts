export function initializeMarkdownPreview(_element: HTMLElement) {
  const markdownInput = document.getElementById("markdownInput") as HTMLTextAreaElement | null;
  const preview = document.getElementById("preview") as HTMLDivElement | null;
  const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement | null;
  const copyHtmlBtn = document.getElementById("copyHtmlBtn") as HTMLButtonElement | null;
  const status = document.getElementById("status") as HTMLDivElement | null;

  if (!markdownInput || !preview || !clearBtn || !copyHtmlBtn || !status) return;

  const showStatus = (message: string) => {
    status.textContent = message;
    status.className = "status success";
    setTimeout(() => status.classList.add("hidden"), 2000);
  };

  const parseMarkdown = (markdown: string) => {
    let html = markdown;

    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
    html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
    html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
    html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html = html.replace(/_(.+?)_/g, "<em>$1</em>");

    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

    html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "<hr />");

    html = html.replace(/^[\*\-\+] (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

    const lines = html.split("\n");
    const processed: string[] = [];
    let inPre = false;

    for (const line of lines) {
      if (line.includes("<pre>")) inPre = true;
      if (line.includes("</pre>")) inPre = false;

      if (
        !inPre &&
        line.trim() &&
        !line.startsWith("<h") &&
        !line.startsWith("<ul") &&
        !line.startsWith("<ol") &&
        !line.startsWith("<li") &&
        !line.startsWith("<blockquote") &&
        !line.startsWith("<hr") &&
        !line.startsWith("<pre") &&
        !line.startsWith("</")
      ) {
        processed.push(`<p>${line}</p>`);
      } else {
        processed.push(line);
      }
    }

    html = processed.join("\n");

    html = html.replace(/<p><\/p>/g, "");
    html = html.replace(/<p>\s*<\/p>/g, "");

    return html;
  };

  const updatePreview = () => {
    const markdown = markdownInput.value;
    preview.innerHTML = parseMarkdown(markdown);
  };

  markdownInput.addEventListener("input", updatePreview);

  clearBtn.addEventListener("click", () => {
    markdownInput.value = "";
    preview.innerHTML = "";
  });

  copyHtmlBtn.addEventListener("click", () => {
    const html = preview.innerHTML;
    if (!html) return;
    navigator.clipboard.writeText(html).then(() => {
      showStatus("✓ HTML copied to clipboard");
    });
  });

  markdownInput.value = `# Hello Shipyard! 🚀

This is a **live markdown preview** tool.

## Features

- Real-time preview
- Syntax highlighting for code
- Copy rendered HTML

### Code Example

\`\`\`javascript
const ship = {
  name: 'My Awesome Ship',
  status: 'verified'
};
console.log(ship);
\`\`\`

> Pro tip: Use \`inline code\` for short snippets.

---

Built with **Ember** • [Support Crunchy Bananas](https://crunchybananas.com/donate)
`;

  updatePreview();
}
