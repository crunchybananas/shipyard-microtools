import Component from "@glimmer/component";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import {
  type Bookmark,
  getBookmarks,
  deleteBookmark,
} from "cosmos/services/bookmark-manager";

export interface BookmarksModalSignature {
  Element: HTMLDivElement;
  Args: {
    onClose: () => void;
    onNavigate: (bookmark: Bookmark) => void;
  };
}

export default class BookmarksModal extends Component<BookmarksModalSignature> {
  get bookmarks(): Bookmark[] {
    return getBookmarks();
  }

  handleBackdropClick = (event: MouseEvent): void => {
    if (event.target === event.currentTarget) {
      this.args.onClose();
    }
  };

  handleBookmarkClick = (bookmark: Bookmark): void => {
    this.args.onNavigate(bookmark);
    this.args.onClose();
  };

  handleDelete = (event: MouseEvent, id: number): void => {
    event.stopPropagation();
    deleteBookmark(id);
    // Force re-render by calling onClose and reopening
    this.args.onClose();
  };

  <template>
    {{! template-lint-disable no-invalid-interactive }}
    <div
      class="modal-backdrop"
      ...attributes
      {{on "click" this.handleBackdropClick}}
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2>📚 Bookmarks</h2>
          <button
            class="close-btn"
            type="button"
            {{on "click" @onClose}}
          >&times;</button>
        </div>
        <div class="bookmarks-list">
          {{#if this.bookmarks.length}}
            {{#each this.bookmarks as |bookmark|}}
              {{! template-lint-disable no-invalid-interactive }}
              <div
                class="bookmark-item"
                {{on "click" (fn this.handleBookmarkClick bookmark)}}
              >
                <div>
                  <div class="bookmark-name">{{bookmark.name}}</div>
                  <div class="bookmark-coords">
                    {{this.formatCoords bookmark.x}},
                    {{this.formatCoords bookmark.y}}
                    @
                    {{this.formatZoom bookmark.zoom}}x
                  </div>
                </div>
                <button
                  class="bookmark-delete"
                  type="button"
                  {{on "click" (fn this.handleDelete bookmark.id)}}
                >×</button>
              </div>
            {{/each}}
          {{else}}
            <div class="empty-bookmarks">
              No bookmarks yet. Click ☆ to save a location.
            </div>
          {{/if}}
        </div>
      </div>
    </div>
  </template>

  formatCoords = (val: number): string => {
    return val.toFixed(2);
  };

  formatZoom = (val: number): string => {
    return val.toFixed(1);
  };
}
