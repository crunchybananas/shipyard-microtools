import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { htmlSafe, type SafeString } from "@ember/template";

interface DiffItem {
  type: "added" | "removed" | "unchanged";
  line: string;
}

export default class TextDiffApp extends Component {
  @tracked textA = "";
  @tracked textB = "";
  @tracked showResults = false;
  @tracked diffLines: DiffItem[] = [];
  @tracked addedCount = 0;
  @tracked removedCount = 0;
  @tracked unchangedCount = 0;

  updateTextA = (event: Event): void => {
    this.textA = (event.target as HTMLTextAreaElement).value;
  };

  updateTextB = (event: Event): void => {
    this.textB = (event.target as HTMLTextAreaElement).value;
  };

  compare = (): void => {
    if (!this.textA && !this.textB) {
      alert("Enter text in both fields to compare");
      return;
    }

    this.diffLines = this.computeDiff(this.textA, this.textB);
    this.addedCount = this.diffLines.filter((d) => d.type === "added").length;
    this.removedCount = this.diffLines.filter(
      (d) => d.type === "removed",
    ).length;
    this.unchangedCount = this.diffLines.filter(
      (d) => d.type === "unchanged",
    ).length;
    this.showResults = true;
  };

  swap = (): void => {
    const temp = this.textA;
    this.textA = this.textB;
    this.textB = temp;
  };

  clear = (): void => {
    this.textA = "";
    this.textB = "";
    this.showResults = false;
    this.diffLines = [];
  };

  computeDiff(a: string, b: string): DiffItem[] {
    const linesA = a.split("\n");
    const linesB = b.split("\n");

    const m = linesA.length;
    const n = linesB.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (linesA[i - 1] === linesB[j - 1]) {
          dp[i]![j] = dp[i - 1]![j - 1]! + 1;
        } else {
          dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
        }
      }
    }

    const diff: DiffItem[] = [];
    let i = m,
      j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        diff.unshift({ type: "unchanged", line: linesA[i - 1]! });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
        diff.unshift({ type: "added", line: linesB[j - 1]! });
        j--;
      } else {
        diff.unshift({ type: "removed", line: linesA[i - 1]! });
        i--;
      }
    }

    return diff;
  }

  renderDiffLine(item: DiffItem, index: number): SafeString {
    const prefix =
      item.type === "added" ? "+" : item.type === "removed" ? "-" : " ";
    const lineNum = String(index + 1).padStart(3, " ");
    const escaped = item.line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return htmlSafe(
      `<span class="line-number">${lineNum}</span>${prefix} ${escaped}`,
    );
  }

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>📊 Text Diff</h1>
        <p class="subtitle">Compare two text snippets and see the differences.</p>
      </header>

      <main>
        <div class="input-row">
          <div class="input-section">
            <label for="textA">Original</label>
            <textarea
              id="textA"
              rows="12"
              placeholder="Paste original text here..."
              {{on "input" this.updateTextA}}
            >{{this.textA}}</textarea>
          </div>

          <div class="input-section">
            <label for="textB">Modified</label>
            <textarea
              id="textB"
              rows="12"
              placeholder="Paste modified text here..."
              {{on "input" this.updateTextB}}
            >{{this.textB}}</textarea>
          </div>
        </div>

        <div class="button-row">
          <button
            type="button"
            class="primary-btn"
            {{on "click" this.compare}}
          >🔍 Compare</button>
          <button type="button" class="secondary-btn" {{on "click" this.swap}}>⇄
            Swap</button>
          <button
            type="button"
            class="secondary-btn"
            {{on "click" this.clear}}
          >Clear</button>
        </div>

        {{#if this.showResults}}
          <div class="results">
            <div class="stats-bar">
              <span class="stat added">+{{this.addedCount}} added</span>
              <span class="stat removed">-{{this.removedCount}} removed</span>
              <span class="stat">{{this.unchangedCount}} unchanged</span>
            </div>
            <div class="diff-output">
              {{#each this.diffLines as |item index|}}
                <div class="diff-line {{item.type}}">{{this.renderDiffLine
                    item
                    index
                  }}</div>
              {{/each}}
            </div>
          </div>
        {{/if}}
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a
            href="https://crunchybananas.github.io"
            target="_blank"
            rel="noopener noreferrer"
          >Cory Loken & Chiron</a>
          using
          <a
            href="https://emberjs.com"
            target="_blank"
            rel="noopener noreferrer"
          >Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
