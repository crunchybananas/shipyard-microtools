import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { modifier } from "ember-modifier";
import { on } from "@ember/modifier";

// ── Signature ──────────────────────────────────────────────────

interface FilePanelSignature {
  Args: {
    onStatus: (message: string, type: "success" | "error") => void;
  };
}

// ── Component ──────────────────────────────────────────────────

export default class FilePanel extends Component<FilePanelSignature> {
  @tracked fileName = "";
  @tracked fileSize = "";
  @tracked base64Output = "";
  @tracked previewSrc = "";
  @tracked dragging = false;

  private dataUrl = "";

  // ── Computed ─────────────────────────────────────────────────

  get hasFile() {
    return this.fileName.length > 0;
  }

  get isImage() {
    return this.previewSrc.length > 0;
  }

  get dropZoneClass() {
    return this.dragging ? "drop-zone dragover" : "drop-zone";
  }

  // ── Drag-and-drop modifier ───────────────────────────────────

  dropZone = modifier((element: HTMLElement) => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      this.dragging = true;
    };

    const onDragLeave = () => {
      this.dragging = false;
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      this.dragging = false;
      this.handleFile(e.dataTransfer?.files?.[0]);
    };

    element.addEventListener("dragover", onDragOver);
    element.addEventListener("dragleave", onDragLeave);
    element.addEventListener("drop", onDrop);

    return () => {
      element.removeEventListener("dragover", onDragOver);
      element.removeEventListener("dragleave", onDragLeave);
      element.removeEventListener("drop", onDrop);
    };
  });

  // ── File handling ────────────────────────────────────────────

  private handleFile(file?: File | null) {
    if (!file) return;

    this.fileName = file.name;
    this.fileSize = (file.size / 1024).toFixed(1);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      this.dataUrl = reader.result;
      this.base64Output = this.dataUrl.split(",")[1] ?? "";
      this.previewSrc = file.type.startsWith("image/") ? this.dataUrl : "";
      this.args.onStatus("✓ File loaded", "success");
    };
    reader.readAsDataURL(file);
  }

  // ── Event handlers (fat arrows) ──────────────────────────────

  onFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    this.handleFile(input.files?.[0]);
  };

  copyBase64 = () => {
    if (!this.base64Output) {
      this.args.onStatus("Nothing to copy", "error");
      return;
    }
    navigator.clipboard.writeText(this.base64Output).then(() => {
      this.args.onStatus("✓ Base64 copied", "success");
    });
  };

  copyDataUrl = () => {
    if (!this.dataUrl) {
      this.args.onStatus("Nothing to copy", "error");
      return;
    }
    navigator.clipboard.writeText(this.dataUrl).then(() => {
      this.args.onStatus("✓ Data URL copied", "success");
    });
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="panel active">
      <div class="input-section">
        <label>Upload File or Image</label>
        <div class={{this.dropZoneClass}} {{this.dropZone}}>
          <p>
            📁 Drop a file here or
            <label class="file-label">
              browse
              <input type="file" {{on "change" this.onFileChange}} />
            </label>
          </p>
        </div>

        {{#if this.hasFile}}
          <div class="file-preview">
            {{#if this.isImage}}
              <img src={{this.previewSrc}} alt="Preview" />
            {{/if}}
            <p>{{this.fileName}} ({{this.fileSize}} KB)</p>
          </div>
        {{/if}}
      </div>

      <div class="input-section">
        <label>Base64 Output</label>
        <textarea
          rows="6"
          readonly
          placeholder="Base64 will appear here..."
        >{{this.base64Output}}</textarea>
        <div class="button-row">
          <button
            class="secondary-btn"
            type="button"
            {{on "click" this.copyBase64}}
          >📋 Copy</button>
          <button
            class="secondary-btn"
            type="button"
            {{on "click" this.copyDataUrl}}
          >🔗 Copy as Data URL</button>
        </div>
      </div>
    </div>
  </template>
}
