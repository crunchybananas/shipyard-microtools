import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type WorkspaceStoreService from "./workspace-store";

/**
 * Browser notification service.
 * Requests permission on first use, shows notifications
 * for new messages when the tab is not focused.
 */
export default class NotificationService extends Service {
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked permission: NotificationPermission = "default";
  @tracked enabled = false;

  private _hasFocus = true;
  private _originalTitle = "Harbor Chat";

  constructor(properties: object | undefined) {
    super(properties);

    if (typeof Notification !== "undefined") {
      this.permission = Notification.permission;
      this.enabled = this.permission === "granted";
    }

    window.addEventListener("focus", () => {
      this._hasFocus = true;
      document.title = this._originalTitle;
    });
    window.addEventListener("blur", () => {
      this._hasFocus = false;
    });
  }

  async requestPermission(): Promise<void> {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    this.permission = result;
    this.enabled = result === "granted";
  }

  /**
   * Show a browser notification if the tab is not focused.
   * Also updates the document title with unread indicator.
   */
  notify(title: string, body: string, channelId?: string): void {
    if (this._hasFocus) return;

    // Update page title
    document.title = `* ${this._originalTitle}`;

    if (!this.enabled) return;

    const notification = new Notification(title, {
      body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚓</text></svg>",
      tag: channelId ?? "harbor-chat",
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }

  /**
   * Update page title with channel context.
   */
  setChannelTitle(channelName: string): void {
    this._originalTitle = `Harbor Chat · #${channelName}`;
    if (this._hasFocus) {
      document.title = this._originalTitle;
    }
  }
}
