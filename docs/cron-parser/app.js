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
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // 7 is also Sunday
const FIELD_RANGES = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }   // day of week (7 = Sunday, normalized to 0)
];

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

// Expand a cron field into the set of values it matches.
// Handles *, lists, ranges, steps, ranges-with-steps (1-30/5),
// bare-value steps (5/15 = 5 through max, step 15), and day-of-week 7 = Sunday.
function expandField(field, index) {
  const { min, max } = FIELD_RANGES[index];
  const values = new Set();

  for (const part of field.split(',')) {
    let range = part;
    let step = 1;

    if (part.includes('/')) {
      const [r, s] = part.split('/');
      range = r;
      step = parseInt(s);
    }
    if (isNaN(step) || step < 1) continue;

    let start, end;
    if (range === '*') {
      start = min;
      end = max;
    } else if (range.includes('-')) {
      [start, end] = range.split('-').map(Number);
    } else {
      start = parseInt(range);
      end = part.includes('/') ? max : start;
    }
    if (isNaN(start) || isNaN(end)) continue;

    start = Math.max(start, min);
    end = Math.min(end, max);
    for (let v = start; v <= end; v += step) {
      values.add(index === 4 && v === 7 ? 0 : v);
    }
  }

  return values;
}

function getNextRuns(parts, count = 5) {
  const [minuteSet, hourSet, domSet, monthSet, dowSet] = parts.map(expandField);
  const domRestricted = parts[2] !== '*';
  const dowRestricted = parts[4] !== '*';

  // Standard cron: when BOTH day fields are restricted, a day matches if EITHER does
  const dayMatches = (date) => {
    const domOk = domSet.has(date.getDate());
    const dowOk = dowSet.has(date.getDay());
    return (domRestricted && dowRestricted) ? (domOk || dowOk) : (domOk && dowOk);
  };

  const dayPossible = (domRestricted && dowRestricted)
    ? (domSet.size > 0 || dowSet.size > 0)
    : (domSet.size > 0 && dowSet.size > 0);
  if (minuteSet.size === 0 || hourSet.size === 0 || monthSet.size === 0 || !dayPossible) {
    return [];
  }

  const runs = [];
  const now = new Date();
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Field-aware search: skip whole months/days/hours that can't match,
  // so even sparse schedules (yearly, Feb 29) resolve in a few thousand steps
  const horizonYear = now.getFullYear() + 25;
  const maxIterations = 100000;
  let iterations = 0;

  while (runs.length < count && iterations < maxIterations) {
    iterations++;
    if (candidate.getFullYear() > horizonYear) break;

    if (!monthSet.has(candidate.getMonth() + 1)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(candidate)) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hourSet.has(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minuteSet.has(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1);
      continue;
    }

    runs.push(new Date(candidate));
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return runs;
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
