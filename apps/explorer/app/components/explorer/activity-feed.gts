import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import type { Activity } from "explorer/services/shipyard-api";

export interface ActivityFeedSignature {
  Element: HTMLElement;
  Args: {
    activities: Activity[];
    onRefresh: () => void;
  };
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "Just now";
}

export default class ActivityFeed extends Component<ActivityFeedSignature> {
  formatTime = (time: string): string => {
    return formatRelativeTime(time);
  };

  <template>
    <section class="panel activity" ...attributes>
      <div class="panel-header">
        <h2>📡 Live Activity</h2>
        <button
          type="button"
          class="btn-icon"
          title="Refresh"
          {{on "click" @onRefresh}}
        >↻</button>
      </div>
      <div class="activity-feed">
        {{#if @activities.length}}
          {{#each @activities as |activity|}}
            <div class="activity-item">
              <div class="activity-icon">{{activity.icon}}</div>
              <div class="activity-content">
                <div class="activity-text">
                  <strong>{{activity.author}}</strong>
                  {{activity.text}}
                </div>
                <div class="activity-time">{{this.formatTime activity.time}}</div>
              </div>
            </div>
          {{/each}}
        {{else}}
          <div class="loading-inline">No recent activity</div>
        {{/if}}
      </div>
    </section>
  </template>
}
