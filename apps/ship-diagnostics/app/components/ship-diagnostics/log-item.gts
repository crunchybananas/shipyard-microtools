import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import type { LogEntry } from "ship-diagnostics/ship-diagnostics/data/sample-logs";
import { formatTime } from "ship-diagnostics/ship-diagnostics/log-utils";

interface LogItemSignature {
  Args: {
    log: LogEntry;
    isSelected: boolean;
    onSelect: (log: LogEntry) => void;
  };
}

export default class LogItem extends Component<LogItemSignature> {
  get buttonClass() {
    return `log-item level-${this.args.log.level}`;
  }

  get levelLabel() {
    return this.args.log.level.toUpperCase();
  }

  get levelClass() {
    return `log-level ${this.args.log.level}`;
  }

  get time() {
    return formatTime(this.args.log.timestamp);
  }

  select = () => {
    this.args.onSelect(this.args.log);
  };

  <template>
    <li>
      <button
        type="button"
        class={{this.buttonClass}}
        aria-selected={{if @isSelected "true" "false"}}
        {{on "click" this.select}}
      >
        <div class="log-meta">
          <span class="log-time">{{this.time}}</span>
          <span class={{this.levelClass}}>{{this.levelLabel}}</span>
          <span class="log-service">{{@log.service}}</span>
        </div>
        <div class="log-message">{{@log.message}}</div>
      </button>
    </li>
  </template>
}
