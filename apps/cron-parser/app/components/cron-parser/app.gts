import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";

const FIELDS = ["minute", "hour", "day of month", "month", "day of week"];
const FIELD_NAMES = ["Minute", "Hour", "Day of Month", "Month", "Day of Week"];
const MONTHS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface FieldBreakdownItem {
  name: string;
  value: string;
}

const EXAMPLES = [
  { cron: "* * * * *", label: "Every minute" },
  { cron: "*/5 * * * *", label: "Every 5 minutes" },
  { cron: "0 * * * *", label: "Every hour" },
  { cron: "0 0 * * *", label: "Daily at midnight" },
  { cron: "0 9 * * 1-5", label: "Weekdays at 9am" },
  { cron: "0 0 1 * *", label: "First of month" },
  { cron: "30 4 * * 0", label: "Sundays at 4:30am" },
  { cron: "0 */2 * * *", label: "Every 2 hours" },
];

export default class CronParserApp extends Component {
  @tracked cronInput = "*/15 * * * *";
  @tracked humanReadable = "Enter a cron expression above";
  @tracked fieldBreakdown: FieldBreakdownItem[] = FIELD_NAMES.map((name) => ({
    name,
    value: "—",
  }));
  @tracked nextRuns: string[] = ["—"];
  @tracked hasError = false;

  examples = EXAMPLES;

  constructor(owner: unknown, args: object) {
    super(owner, args);
    this.parseCron();
  }

  @action
  updateInput(event: Event): void {
    this.cronInput = (event.target as HTMLInputElement).value;
  }

  @action
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.parseCron();
    }
  }

  @action
  useExample(cron: string): void {
    this.cronInput = cron;
    this.parseCron();
  }

  @action
  parseCron(): void {
    const cron = this.cronInput.trim();
    const parts = cron.split(/\s+/);

    if (parts.length !== 5) {
      this.humanReadable =
        "Invalid: expected 5 fields (minute hour day month weekday)";
      this.hasError = true;
      return;
    }

    this.hasError = false;

    // Field breakdown
    this.fieldBreakdown = FIELD_NAMES.map((name, i) => ({
      name,
      value: this.parseField(parts[i]!, i),
    }));

    // Human readable
    this.humanReadable = this.getHumanReadable(parts);

    // Next runs
    this.nextRuns = this.getNextRuns(parts).map((d) => this.formatDate(d));
    if (this.nextRuns.length === 0) {
      this.nextRuns = ["Could not calculate"];
    }
  }

  parseField(field: string, index: number): string {
    if (field === "*") return "every";
    if (field.includes("/")) {
      const [range, step] = field.split("/");
      if (range === "*") return `every ${step}`;
      return `every ${step} from ${range}`;
    }
    if (field.includes(",")) return field.split(",").join(", ");
    if (field.includes("-")) {
      const [start, end] = field.split("-");
      if (index === 4) {
        const startDay = DAYS[parseInt(start!)] ?? start;
        const endDay = DAYS[parseInt(end!)] ?? end;
        return `${startDay}-${endDay}`;
      }
      return `${start}-${end}`;
    }
    if (index === 3 && !isNaN(parseInt(field)))
      return MONTHS[parseInt(field)] ?? field;
    if (index === 4 && !isNaN(parseInt(field)))
      return DAYS[parseInt(field)] ?? field;
    return field;
  }

  describeField(field: string, index: number): string {
    const name = FIELDS[index]!;
    if (field === "*") return `every ${name}`;
    if (field.includes("/")) {
      const [, step] = field.split("/");
      return `every ${step} ${name}${parseInt(step!) > 1 ? "s" : ""}`;
    }
    if (field.includes(",")) return `${name} ${field.split(",").join(", ")}`;
    if (field.includes("-")) {
      const [start, end] = field.split("-");
      return `${name} ${start} through ${end}`;
    }
    return `${name} ${field}`;
  }

  getHumanReadable(parts: string[]): string {
    const [minute, hour, dom, month, dow] = parts;

    if (
      minute === "*" &&
      hour === "*" &&
      dom === "*" &&
      month === "*" &&
      dow === "*"
    ) {
      return "Every minute";
    }

    if (
      minute?.includes("/") &&
      hour === "*" &&
      dom === "*" &&
      month === "*" &&
      dow === "*"
    ) {
      return `Every ${minute.split("/")[1]} minutes`;
    }

    if (
      minute === "0" &&
      hour?.includes("/") &&
      dom === "*" &&
      month === "*" &&
      dow === "*"
    ) {
      return `Every ${hour.split("/")[1]} hours`;
    }

    if (
      minute === "0" &&
      hour === "0" &&
      dom === "*" &&
      month === "*" &&
      dow === "*"
    ) {
      return "At midnight every day";
    }

    if (
      minute === "0" &&
      hour === "*" &&
      dom === "*" &&
      month === "*" &&
      dow === "*"
    ) {
      return "Every hour, on the hour";
    }

    if (dom === "*" && month === "*" && dow === "*") {
      const h = (hour ?? "0").padStart(2, "0");
      const m = (minute ?? "0").padStart(2, "0");
      return `At ${h}:${m} every day`;
    }

    if (dom === "*" && month === "*" && dow !== "*") {
      const h = (hour ?? "0").padStart(2, "0");
      const m = (minute ?? "0").padStart(2, "0");
      let dayStr = dow!;
      if (dow!.includes("-")) {
        const [start, end] = dow!.split("-");
        dayStr = `${DAYS[parseInt(start!)] ?? start} through ${DAYS[parseInt(end!)] ?? end}`;
      } else if (!isNaN(parseInt(dow!))) {
        dayStr = DAYS[parseInt(dow!)] ?? dow!;
      }
      return `At ${h}:${m} on ${dayStr}`;
    }

    if (dom === "1" && month === "*" && dow === "*") {
      const h = (hour ?? "0").padStart(2, "0");
      const m = (minute ?? "0").padStart(2, "0");
      return `At ${h}:${m} on the 1st of every month`;
    }

    const descriptions = parts.map((p, i) => this.describeField(p!, i));
    return (
      descriptions.filter((d) => !d.startsWith("every")).join(", ") ||
      descriptions.join(", ")
    );
  }

  matchField(field: string, value: number): boolean {
    if (field === "*") return true;

    if (field.includes("/")) {
      const [range, step] = field.split("/");
      const stepNum = parseInt(step!);
      if (range === "*") return value % stepNum === 0;
      const start = parseInt(range!);
      return value >= start && (value - start) % stepNum === 0;
    }

    if (field.includes(",")) {
      return field.split(",").map(Number).includes(value);
    }

    if (field.includes("-")) {
      const [start, end] = field.split("-").map(Number);
      return value >= start! && value <= end!;
    }

    return parseInt(field) === value;
  }

  getNextRuns(parts: string[], count = 5): Date[] {
    const [minute, hour, dom, month, dow] = parts;
    const runs: Date[] = [];
    const now = new Date();
    const candidate = new Date(now);
    candidate.setSeconds(0);
    candidate.setMilliseconds(0);

    const maxIterations = 1000;
    let iterations = 0;

    while (runs.length < count && iterations < maxIterations) {
      candidate.setTime(candidate.getTime() + 60000);
      iterations++;

      const m = candidate.getMinutes();
      const h = candidate.getHours();
      const d = candidate.getDate();
      const mo = candidate.getMonth() + 1;
      const wd = candidate.getDay();

      if (!this.matchField(minute!, m)) continue;
      if (!this.matchField(hour!, h)) continue;
      if (!this.matchField(dom!, d)) continue;
      if (!this.matchField(month!, mo)) continue;
      if (!this.matchField(dow!, wd)) continue;

      runs.push(new Date(candidate));
    }

    return runs;
  }

  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    return date.toLocaleString("en-US", options);
  }

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>⏰ Cron Parser</h1>
        <p class="subtitle">Explains cron expressions in plain English.</p>
      </header>

      <main>
        <div class="input-section">
          <label for="cronInput">Cron Expression</label>
          <input
            type="text"
            id="cronInput"
            placeholder="*/15 * * * *"
            value={{this.cronInput}}
            {{on "input" this.updateInput}}
            {{on "keydown" this.handleKeydown}}
          />

          <div class="field-hints">
            <span>minute</span>
            <span>hour</span>
            <span>day</span>
            <span>month</span>
            <span>weekday</span>
          </div>

          <button type="button" class="primary-btn" {{on "click" this.parseCron}}>
            <span class="btn-text">🔍 Parse Expression</span>
          </button>
        </div>

        <div class="results">
          <div class="result-card">
            <h3>Human Readable</h3>
            <p
              class="highlight-text {{if this.hasError 'error'}}"
            >{{this.humanReadable}}</p>
          </div>

          <div class="result-card">
            <h3>Field Breakdown</h3>
            <div class="field-grid">
              {{#each this.fieldBreakdown as |field|}}
                <div class="field-item">
                  <span class="field-name">{{field.name}}</span>
                  <span class="field-value">{{field.value}}</span>
                </div>
              {{/each}}
            </div>
          </div>

          <div class="result-card">
            <h3>Next 5 Runs</h3>
            <ul class="next-runs-list">
              {{#each this.nextRuns as |run|}}
                <li>{{run}}</li>
              {{/each}}
            </ul>
          </div>
        </div>

        <div class="examples-section">
          <h3>Common Examples</h3>
          <div class="examples-grid">
            {{#each this.examples as |example|}}
              <button
                type="button"
                class="example-btn"
                {{on "click" (fn this.useExample example.cron)}}
              >{{example.label}}</button>
            {{/each}}
          </div>
        </div>
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener">Cory Loken & Chiron</a>
          using <a href="https://emberjs.com" target="_blank" rel="noopener">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
