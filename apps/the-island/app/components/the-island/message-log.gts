import Component from "@glimmer/component";

interface MessageLogSignature {
  Args: {
    message: string;
    visible: boolean;
  };
  Element: HTMLDivElement;
}

export default class MessageLog extends Component<MessageLogSignature> {
  get visibilityClass(): string {
    return this.args.visible ? "visible" : "";
  }

  <template>
    <div
      class="game-message {{this.visibilityClass}}"
      aria-live="polite"
      ...attributes
    >
      {{@message}}
    </div>
  </template>
}
