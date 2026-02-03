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
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr />');
  
  // Unordered lists
  html = html.replace(/^[\*\-\+] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Paragraphs (lines not already wrapped)
  const lines = html.split('\n');
  const processed = [];
  let inPre = false;
  
  for (let line of lines) {
    if (line.includes('<pre>')) inPre = true;
    if (line.includes('</pre>')) inPre = false;
    
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

Built for [Shipyard](https://shipyard.bot) 🛠️
`;

updatePreview();
