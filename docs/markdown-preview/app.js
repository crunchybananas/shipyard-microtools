// Markdown Preview
// Live preview with basic markdown parsing

const markdownInput = document.getElementById('markdownInput');
const preview = document.getElementById('preview');
const clearBtn = document.getElementById('clearBtn');
const copyHtmlBtn = document.getElementById('copyHtmlBtn');
const status = document.getElementById('status');

function showStatus(message) {
  status.textContent = message;
  status.className = 'status success';
  setTimeout(() => status.classList.add('hidden'), 2000);
}

// Escape a value for use inside a double-quoted HTML attribute.
// & < > are already entity-escaped by the time attributes are built,
// so only the quote needs handling here.
function escapeAttr(value) {
  return value.replace(/"/g, '&quot;');
}

// Allow only safe link protocols: http, https, mailto, and #fragments.
// Scheme-less (relative) URLs pass through; javascript:, data:, etc. do not.
function sanitizeUrl(url) {
  // Browsers ignore control chars and whitespace when parsing the scheme,
  // so strip them before checking.
  const cleaned = url.replace(/[\u0000-\u0020]/g, '').toLowerCase();
  if (/^(?:https?:|mailto:|#)/.test(cleaned)) return url;
  if (/^[a-z][a-z0-9+.-]*:/.test(cleaned)) return '#';
  return url;
}

// Simple markdown parser
function parseMarkdown(md) {
  let html = md;
  
  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Code blocks (before other processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headers
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  
  // Images (before links so the link rule doesn't half-consume ![alt](src))
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img src="${escapeAttr(sanitizeUrl(src))}" alt="${escapeAttr(alt)}" />`;
  });

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    return `<a href="${escapeAttr(sanitizeUrl(href))}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr />');
  
  // Lists and paragraphs (line-based so <ul>/<ol> open, nest, and close correctly)
  const lines = html.split('\n');
  const processed = [];
  const listStack = []; // open lists, innermost last: { type: 'ul' | 'ol', indent }
  let inPre = false;

  const closeList = () => {
    processed[processed.length - 1] += '</li>';
    processed.push(`</${listStack.pop().type}>`);
  };

  for (let line of lines) {
    if (line.includes('<pre>')) inPre = true;

    const item = inPre ? null : line.match(/^(\s*)(?:([*+-])|(\d+)\.) (.+)$/);
    if (item) {
      const indent = item[1].replace(/\t/g, '    ').length;
      const type = item[2] ? 'ul' : 'ol';

      // Close lists that are more deeply indented than this item
      while (listStack.length && listStack[listStack.length - 1].indent > indent) closeList();
      // Close a same-level list of the other type (ul <-> ol switch)
      const top = listStack[listStack.length - 1];
      if (top && top.indent === indent && top.type !== type) closeList();

      if (!listStack.length || indent > listStack[listStack.length - 1].indent) {
        // Open a new (possibly nested) list; honor a non-1 starting number
        const start = type === 'ol' && parseInt(item[3], 10) !== 1 ? ` start="${parseInt(item[3], 10)}"` : '';
        processed.push(`<${type}${start}>`);
        processed.push(`<li>${item[4]}`);
        listStack.push({ type, indent });
      } else {
        // Sibling item: close the previous <li>, open the next
        processed[processed.length - 1] += '</li>';
        processed.push(`<li>${item[4]}`);
      }
    } else {
      // Any non-item line ends all open lists
      while (listStack.length) closeList();

      if (!inPre && line.trim() &&
          !line.startsWith('<h') &&
          !line.startsWith('<ul') &&
          !line.startsWith('<ol') &&
          !line.startsWith('<li') &&
          !line.startsWith('<blockquote') &&
          !line.startsWith('<hr') &&
          !line.startsWith('<pre') &&
          !line.startsWith('</')) {
        processed.push(`<p>${line}</p>`);
      } else {
        processed.push(line);
      }
    }

    if (line.includes('</pre>')) inPre = false;
  }
  while (listStack.length) closeList();

  html = processed.join('\n');
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
}

function updatePreview() {
  const md = markdownInput.value;
  preview.innerHTML = parseMarkdown(md);
}

markdownInput.addEventListener('input', updatePreview);

clearBtn.addEventListener('click', () => {
  markdownInput.value = '';
  preview.innerHTML = '';
});

copyHtmlBtn.addEventListener('click', () => {
  const html = preview.innerHTML;
  if (!html) {
    return;
  }
  navigator.clipboard.writeText(html).then(() => {
    showStatus('✓ HTML copied to clipboard');
  });
});

// Initialize with placeholder content
markdownInput.value = `# Hello Microtools! 🚀

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

Built for [Microtools](https://github.com/crunchybananas/shipyard-microtools) 🛠️
`;

updatePreview();
