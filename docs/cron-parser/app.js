// Cron Parser
// Explains cron expressions in plain English

const cronInput = document.getElementById('cronInput');
const parseBtn = document.getElementById('parseBtn');
const humanReadable = document.getElementById('humanReadable');
const fieldBreakdown = document.getElementById('fieldBreakdown');
const nextRunsList = document.getElementById('nextRuns');

const FIELDS = ['minute', 'hour', 'day of month', 'month', 'day of week'];
const FIELD_NAMES = ['Minute', 'Hour', 'Day of Month', 'Month', 'Day of Week'];
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

parseBtn.addEventListener('click', parseCron);
cronInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') parseCron();
});

// Example buttons
document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    cronInput.value = btn.dataset.cron;
    parseCron();
  });
});

// Parse on load
parseCron();

function parseField(field, index) {
  if (field === '*') return 'every';
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    if (range === '*') return `every ${step}`;
    return `every ${step} from ${range}`;
  }
  if (field.includes(',')) return field.split(',').join(', ');
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    if (index === 4) {
      const startDay = DAYS[parseInt(start)] || start;
      const endDay = DAYS[parseInt(end)] || end;
      return `${startDay}-${endDay}`;
    }
    return `${start}-${end}`;
  }
  if (index === 3 && !isNaN(field)) return MONTHS[parseInt(field)] || field;
  if (index === 4 && !isNaN(field)) return DAYS[parseInt(field)] || field;
  return field;
}

function describeField(field, index) {
  const name = FIELDS[index];
  if (field === '*') return `every ${name}`;
  if (field.includes('/')) {
    const [, step] = field.split('/');
    return `every ${step} ${name}${parseInt(step) > 1 ? 's' : ''}`;
  }
  if (field.includes(',')) return `${name} ${field.split(',').join(', ')}`;
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    return `${name} ${start} through ${end}`;
  }
  return `${name} ${field}`;
}

function getHumanReadable(parts) {
  const [minute, hour, dom, month, dow] = parts;
  
  // Common patterns
  if (minute === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every minute';
  }
  
  if (minute.includes('/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Every ${minute.split('/')[1]} minutes`;
  }
  
  if (minute === '0' && hour.includes('/') && dom === '*' && month === '*' && dow === '*') {
    return `Every ${hour.split('/')[1]} hours`;
  }
  
  if (minute === '0' && hour === '0' && dom === '*' && month === '*' && dow === '*') {
    return 'At midnight every day';
  }
  
  if (minute === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every hour, on the hour';
  }
  
  if (dom === '*' && month === '*' && dow === '*') {
    const h = hour.padStart(2, '0');
    const m = minute.padStart(2, '0');
    return `At ${h}:${m} every day`;
  }
  
  if (dom === '*' && month === '*' && dow !== '*') {
    const h = hour.padStart(2, '0');
    const m = minute.padStart(2, '0');
    let dayStr = dow;
    if (dow.includes('-')) {
      const [start, end] = dow.split('-');
      dayStr = `${DAYS[parseInt(start)] || start} through ${DAYS[parseInt(end)] || end}`;
    } else if (!isNaN(dow)) {
      dayStr = DAYS[parseInt(dow)];
    }
    return `At ${h}:${m} on ${dayStr}`;
  }
  
  if (dom === '1' && month === '*' && dow === '*') {
    const h = hour.padStart(2, '0');
    const m = minute.padStart(2, '0');
    return `At ${h}:${m} on the 1st of every month`;
  }
  
  // Fallback: combine descriptions
  const descriptions = parts.map((p, i) => describeField(p, i));
  return descriptions.filter(d => !d.startsWith('every')).join(', ') || descriptions.join(', ');
}

function getNextRuns(parts, count = 5) {
  const [minute, hour, dom, month, dow] = parts;
  const runs = [];
  const now = new Date();
  let candidate = new Date(now);
  candidate.setSeconds(0);
  candidate.setMilliseconds(0);
  
  // Simple next-run calculation for common patterns
  const maxIterations = 1000;
  let iterations = 0;
  
  while (runs.length < count && iterations < maxIterations) {
    candidate = new Date(candidate.getTime() + 60000); // Add 1 minute
    iterations++;
    
    const m = candidate.getMinutes();
    const h = candidate.getHours();
    const d = candidate.getDate();
    const mo = candidate.getMonth() + 1;
    const wd = candidate.getDay();
    
    if (!matchField(minute, m)) continue;
    if (!matchField(hour, h)) continue;
    if (!matchField(dom, d)) continue;
    if (!matchField(month, mo)) continue;
    if (!matchField(dow, wd)) continue;
    
    runs.push(new Date(candidate));
  }
  
  return runs;
}

function matchField(field, value) {
  if (field === '*') return true;
  
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = parseInt(step);
    if (range === '*') return value % stepNum === 0;
    const start = parseInt(range);
    return value >= start && (value - start) % stepNum === 0;
  }
  
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }
  
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }
  
  return parseInt(field) === value;
}

function formatDate(date) {
  const options = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return date.toLocaleString('en-US', options);
}

function parseCron() {
  const cron = cronInput.value.trim();
  const parts = cron.split(/\s+/);
  
  if (parts.length !== 5) {
    humanReadable.textContent = 'Invalid: expected 5 fields (minute hour day month weekday)';
    humanReadable.classList.add('error');
    return;
  }
  
  humanReadable.classList.remove('error');
  
  // Update human readable
  humanReadable.textContent = getHumanReadable(parts);
  
  // Update field breakdown
  const fieldItems = fieldBreakdown.querySelectorAll('.field-item');
  parts.forEach((part, i) => {
    const valueEl = fieldItems[i].querySelector('.field-value');
    valueEl.textContent = parseField(part, i);
  });
  
  // Update next runs
  const nextRuns = getNextRuns(parts);
  nextRunsList.innerHTML = nextRuns.length > 0
    ? nextRuns.map(d => `<li>${formatDate(d)}</li>`).join('')
    : '<li>Could not calculate next runs</li>';
}
