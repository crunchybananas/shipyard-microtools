// Data Forge - Pure Vanilla JS Mock Data Generator
// No dependencies, completely self-contained

let fields = [];
let recordCount = 10;
let outputFormat = 'json';
let prettyPrint = true;
let locale = 'en-US';

// Data generators
const generators = {
  // Personal
  firstName: () => {
    const names = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen'];
    return names[Math.floor(Math.random() * names.length)];
  },
  
  lastName: () => {
    const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    return names[Math.floor(Math.random() * names.length)];
  },
  
  fullName: () => `${generators.firstName()} ${generators.lastName()}`,
  
  email: () => {
    const domains = ['example.com', 'email.com', 'mail.com', 'test.com', 'demo.com'];
    const first = generators.firstName().toLowerCase();
    const last = generators.lastName().toLowerCase();
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${first}.${last}@${domain}`;
  },
  
  phone: () => {
    const area = Math.floor(Math.random() * 900) + 100;
    const prefix = Math.floor(Math.random() * 900) + 100;
    const line = Math.floor(Math.random() * 9000) + 1000;
    return `(${area}) ${prefix}-${line}`;
  },
  
  avatar: () => `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`,
  
  dateOfBirth: () => {
    const year = 1950 + Math.floor(Math.random() * 50);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  age: () => Math.floor(Math.random() * 63) + 18,
  
  gender: () => ['Male', 'Female', 'Other'][Math.floor(Math.random() * 3)],
  
  // Address
  street: () => {
    const numbers = Math.floor(Math.random() * 9999) + 1;
    const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Elm St', 'Park Ave', 'Washington Blvd', 'Lake St', 'Hill Rd'];
    return `${numbers} ${streets[Math.floor(Math.random() * streets.length)]}`;
  },
  
  city: () => {
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'San Francisco'];
    return cities[Math.floor(Math.random() * cities.length)];
  },
  
  state: () => {
    const states = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];
    return states[Math.floor(Math.random() * states.length)];
  },
  
  zipCode: () => String(Math.floor(Math.random() * 90000) + 10000),
  
  country: () => {
    const countries = ['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Japan', 'Australia'];
    return countries[Math.floor(Math.random() * countries.length)];
  },
  
  latitude: () => (Math.random() * 180 - 90).toFixed(6),
  longitude: () => (Math.random() * 360 - 180).toFixed(6),
  
  // Internet
  username: () => {
    const adjectives = ['cool', 'super', 'mega', 'ultra', 'pro', 'epic', 'awesome'];
    const nouns = ['user', 'ninja', 'master', 'guru', 'wizard', 'coder'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}_${noun}${num}`;
  },
  
  url: () => {
    const domains = ['example', 'demo', 'test', 'sample', 'mysite'];
    const tlds = ['com', 'net', 'org', 'io', 'app'];
    return `https://www.${domains[Math.floor(Math.random() * domains.length)]}.${tlds[Math.floor(Math.random() * tlds.length)]}`;
  },
  
  domain: () => {
    const domains = ['example', 'demo', 'test', 'sample', 'mysite'];
    const tlds = ['com', 'net', 'org', 'io', 'app'];
    return `${domains[Math.floor(Math.random() * domains.length)]}.${tlds[Math.floor(Math.random() * tlds.length)]}`;
  },
  
  ipv4: () => `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
  
  ipv6: () => {
    const hex = () => Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    return `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
  },
  
  userAgent: () => {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  },
  
  mac: () => {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
  },
  
  // Commerce
  productName: () => {
    const adjectives = ['Premium', 'Deluxe', 'Professional', 'Ultra', 'Advanced', 'Classic'];
    const products = ['Widget', 'Gadget', 'Device', 'Tool', 'Accessory', 'Kit'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${products[Math.floor(Math.random() * products.length)]}`;
  },
  
  price: () => (Math.random() * 1000 + 10).toFixed(2),
  
  sku: () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let sku = '';
    for (let i = 0; i < 3; i++) sku += letters[Math.floor(Math.random() * letters.length)];
    sku += '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return sku;
  },
  
  barcode: () => String(Math.floor(Math.random() * 900000000000) + 100000000000),
  
  category: () => {
    const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books', 'Toys', 'Food', 'Beauty'];
    return categories[Math.floor(Math.random() * categories.length)];
  },
  
  creditCard: () => {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      parts.push(Math.floor(Math.random() * 10000).toString().padStart(4, '0'));
    }
    return parts.join('-');
  },
  
  currency: () => ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'][Math.floor(Math.random() * 6)],
  
  // Company
  companyName: () => {
    const prefixes = ['Tech', 'Global', 'Digital', 'Smart', 'Next', 'Future'];
    const suffixes = ['Solutions', 'Systems', 'Corp', 'Industries', 'Group', 'Enterprises'];
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
  },
  
  jobTitle: () => {
    const titles = ['Software Engineer', 'Product Manager', 'Designer', 'Data Analyst', 'Marketing Manager', 'Sales Representative', 'Accountant', 'HR Manager'];
    return titles[Math.floor(Math.random() * titles.length)];
  },
  
  department: () => ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'][Math.floor(Math.random() * 6)],
  
  industry: () => ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing'][Math.floor(Math.random() * 6)],
  
  // Text
  sentence: () => {
    const sentences = [
      'The quick brown fox jumps over the lazy dog.',
      'Lorem ipsum dolor sit amet consectetur adipiscing elit.',
      'A journey of a thousand miles begins with a single step.',
      'To be or not to be that is the question.',
      'All that glitters is not gold.'
    ];
    return sentences[Math.floor(Math.random() * sentences.length)];
  },
  
  paragraph: () => {
    const count = Math.floor(Math.random() * 3) + 3;
    const sentences = [];
    for (let i = 0; i < count; i++) {
      sentences.push(generators.sentence());
    }
    return sentences.join(' ');
  },
  
  words: () => {
    const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit'];
    const count = Math.floor(Math.random() * 5) + 3;
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(words[Math.floor(Math.random() * words.length)]);
    }
    return result.join(' ');
  },
  
  slug: () => generators.words().toLowerCase().replace(/\s+/g, '-'),
  
  title: () => {
    const words = generators.words().split(' ');
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  },
  
  // Date & Time
  date: () => {
    const year = 2020 + Math.floor(Math.random() * 5);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  time: () => {
    const hour = String(Math.floor(Math.random() * 24)).padStart(2, '0');
    const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    const second = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    return `${hour}:${minute}:${second}`;
  },
  
  datetime: () => `${generators.date()} ${generators.time()}`,
  
  timestamp: () => Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 31536000),
  
  timezone: () => ['UTC', 'EST', 'PST', 'CST', 'MST', 'GMT'][Math.floor(Math.random() * 6)],
  
  // Other
  uuid: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  
  boolean: () => Math.random() > 0.5,
  
  number: () => Math.floor(Math.random() * 1000),
  
  color: () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
  
  emoji: () => {
    const emojis = ['😀', '😎', '🚀', '💯', '🎉', '⭐', '🔥', '💡', '🎨', '🌟'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }
};

// Templates
const templates = {
  user: [
    { name: 'id', type: 'uuid' },
    { name: 'firstName', type: 'firstName' },
    { name: 'lastName', type: 'lastName' },
    { name: 'email', type: 'email' },
    { name: 'phone', type: 'phone' },
    { name: 'avatar', type: 'avatar' },
    { name: 'age', type: 'age' },
    { name: 'address', type: 'street' },
    { name: 'city', type: 'city' }
  ],
  product: [
    { name: 'id', type: 'uuid' },
    { name: 'name', type: 'productName' },
    { name: 'price', type: 'price' },
    { name: 'sku', type: 'sku' },
    { name: 'category', type: 'category' },
    { name: 'inStock', type: 'boolean' }
  ],
  transaction: [
    { name: 'id', type: 'uuid' },
    { name: 'amount', type: 'price' },
    { name: 'currency', type: 'currency' },
    { name: 'date', type: 'datetime' },
    { name: 'status', type: 'boolean' }
  ],
  blog: [
    { name: 'id', type: 'uuid' },
    { name: 'title', type: 'title' },
    { name: 'slug', type: 'slug' },
    { name: 'author', type: 'fullName' },
    { name: 'content', type: 'paragraph' },
    { name: 'publishedAt', type: 'datetime' }
  ],
  company: [
    { name: 'id', type: 'uuid' },
    { name: 'name', type: 'companyName' },
    { name: 'industry', type: 'industry' },
    { name: 'website', type: 'url' },
    { name: 'email', type: 'email' }
  ],
  event: [
    { name: 'id', type: 'uuid' },
    { name: 'title', type: 'title' },
    { name: 'date', type: 'date' },
    { name: 'time', type: 'time' },
    { name: 'location', type: 'city' }
  ]
};

// UI Functions
function addField(name = '', type = 'firstName') {
  const id = Date.now();
  fields.push({ id, name, type });
  renderFields();
}

function removeField(id) {
  fields = fields.filter(f => f.id !== id);
  renderFields();
}

function updateField(id, prop, value) {
  const field = fields.find(f => f.id === id);
  if (field) field[prop] = value;
}

function renderFields() {
  const container = document.getElementById('fieldsList');
  
  if (fields.length === 0) {
    container.innerHTML = '<div class="empty-state">No fields added yet. Click "+ Add Field" or use a template to get started.</div>';
    return;
  }
  
  container.innerHTML = fields.map(field => `
    <div class="field-item" data-id="${field.id}">
      <div class="field-input">
        <label>Field Name</label>
        <input 
          type="text" 
          value="${field.name}" 
          placeholder="fieldName"
          onchange="updateField(${field.id}, 'name', this.value)"
        />
      </div>
      <div class="field-input">
        <label>Data Type</label>
        <select onchange="updateField(${field.id}, 'type', this.value)">
          ${Object.keys(generators).map(type => 
            `<option value="${type}" ${field.type === type ? 'selected' : ''}>${type}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field-input">
        <label>&nbsp;</label>
        <button class="field-remove" onclick="removeField(${field.id})">Remove</button>
      </div>
    </div>
  `).join('');
}

function generateData() {
  const data = [];
  
  for (let i = 0; i < recordCount; i++) {
    const record = {};
    fields.forEach(field => {
      if (field.name && generators[field.type]) {
        record[field.name] = generators[field.type]();
      }
    });
    data.push(record);
  }
  
  return data;
}

function formatOutput(data) {
  switch (outputFormat) {
    case 'json':
      return prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
      
    case 'csv':
      if (data.length === 0) return '';
      const headers = Object.keys(data[0]);
      const csv = [headers.join(',')];
      data.forEach(row => {
        csv.push(headers.map(h => JSON.stringify(row[h] || '')).join(','));
      });
      return csv.join('\n');
      
    case 'sql':
      if (data.length === 0) return '';
      const tableName = 'table_name';
      const cols = Object.keys(data[0]);
      const inserts = data.map(row => {
        const values = cols.map(col => {
          const val = row[col];
          return typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val;
        }).join(', ');
        return `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${values});`;
      });
      return inserts.join('\n');
      
    case 'xml':
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<records>\n';
      data.forEach(record => {
        xml += '  <record>\n';
        Object.entries(record).forEach(([key, value]) => {
          xml += `    <${key}>${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${key}>\n`;
        });
        xml += '  </record>\n';
      });
      xml += '</records>';
      return xml;
      
    case 'yaml':
      let yaml = '';
      data.forEach((record, i) => {
        yaml += `- `;
        Object.entries(record).forEach(([key, value], j) => {
          const indent = j === 0 ? '' : '  ';
          yaml += `${indent}${key}: ${typeof value === 'string' ? `"${value}"` : value}\n`;
        });
      });
      return yaml;
      
    default:
      return JSON.stringify(data, null, 2);
  }
}

function updatePreview() {
  const preview = document.getElementById('dataPreview');
  
  if (fields.length === 0) {
    preview.textContent = 'Add some fields to generate data...';
    return;
  }
  
  const data = generateData();
  const output = formatOutput(data);
  preview.textContent = output;
}

function downloadData() {
  const data = generateData();
  const output = formatOutput(data);
  
  const extensions = {
    json: 'json',
    csv: 'csv',
    sql: 'sql',
    xml: 'xml',
    yaml: 'yaml'
  };
  
  const blob = new Blob([output], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `data.${extensions[outputFormat]}`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Downloaded!');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
  });
}

function showToast(message) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: #10b981;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const recordCountInput = document.getElementById('recordCount');
  const formatSelect = document.getElementById('format');
  const prettyPrintCheckbox = document.getElementById('prettyPrint');
  const localeSelect = document.getElementById('locale');
  const addFieldBtn = document.getElementById('addField');
  const generateBtn = document.getElementById('generate');
  const copyAllBtn = document.getElementById('copyAll');
  const downloadBtn = document.getElementById('downloadData');
  const refreshBtn = document.getElementById('refreshPreview');
  const templateButtons = document.querySelectorAll('.template-btn');
  
  recordCountInput.addEventListener('change', (e) => {
    recordCount = parseInt(e.target.value) || 10;
  });
  
  formatSelect.addEventListener('change', (e) => {
    outputFormat = e.target.value;
    updatePreview();
  });
  
  prettyPrintCheckbox.addEventListener('change', (e) => {
    prettyPrint = e.target.checked;
    updatePreview();
  });
  
  localeSelect.addEventListener('change', (e) => {
    locale = e.target.value;
  });
  
  addFieldBtn.addEventListener('click', () => addField());
  
  generateBtn.addEventListener('click', updatePreview);
  
  copyAllBtn.addEventListener('click', () => {
    const preview = document.getElementById('dataPreview').textContent;
    copyToClipboard(preview);
  });
  
  downloadBtn.addEventListener('click', downloadData);
  refreshBtn.addEventListener('click', updatePreview);
  
  templateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const template = templates[btn.dataset.template];
      if (template) {
        fields = template.map(f => ({
          id: Date.now() + Math.random(),
          name: f.name,
          type: f.type
        }));
        renderFields();
        updatePreview();
        showToast(`Loaded ${btn.textContent} template`);
      }
    });
  });
  
  // Start with user template
  const template = templates.user;
  fields = template.map(f => ({
    id: Date.now() + Math.random(),
    name: f.name,
    type: f.type
  }));
  renderFields();
  updatePreview();
});

// Make functions global
window.addField = addField;
window.removeField = removeField;
window.updateField = updateField;

// Add animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
