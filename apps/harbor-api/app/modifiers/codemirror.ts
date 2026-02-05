// Harbor API — CodeMirror 6 Modifier
// Vanilla CodeMirror wired up via an Ember modifier. No wrapper addon needed.
//
// Usage in .gts template:
//   <div {{this.codemirror @value @language @readonly onChange=this.handleChange}} />

import { modifier } from "ember-modifier";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";

const langMap: Record<string, () => ReturnType<typeof json>> = {
  json,
  xml,
  html,
};

/**
 * A modifier that mounts a full CodeMirror 6 editor on any element.
 * Reactive: updates content when `value` changes externally.
 * No ember-codemirror addon. Just the modifier pattern.
 */
export const codemirror = modifier(
  (
    element: HTMLElement,
    [value, language, readonly]: [string, string, boolean],
    named: { onChange?: (value: string) => void },
  ) => {
    const langExt = langMap[language];

    const extensions = [
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      foldGutter(),
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorState.readOnly.of(readonly ?? false),
    ];

    if (langExt) {
      extensions.push(langExt());
    }

    if (named.onChange) {
      const onChange = named.onChange;
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      );
    }

    // Add custom styling for the editor to fill its container
    extensions.push(
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "13px",
          fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
        },
        ".cm-scroller": {
          overflow: "auto",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid #2a2a4a",
        },
      }),
    );

    const state = EditorState.create({
      doc: value ?? "",
      extensions,
    });

    const view = new EditorView({
      state,
      parent: element,
    });

    // Reactive update: if value changes externally, update the doc
    // (without disturbing the cursor if the user is editing)
    const currentDoc = view.state.doc.toString();
    if (value !== undefined && value !== currentDoc) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    }

    return () => {
      view.destroy();
    };
  },
);

/**
 * Highlight-only: a simpler readonly viewer for response bodies
 */
export const codemirrorReadonly = modifier(
  (
    element: HTMLElement,
    [value, language]: [string, string],
  ) => {
    const langExt = langMap[language];

    const extensions = [
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      foldGutter(),
      lineNumbers(),
      EditorView.lineWrapping,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "13px",
          fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
        },
        ".cm-scroller": { overflow: "auto" },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid #2a2a4a",
        },
        ".cm-cursor": { display: "none" },
      }),
    ];

    if (langExt) {
      extensions.push(langExt());
    }

    const state = EditorState.create({
      doc: value ?? "",
      extensions,
    });

    const view = new EditorView({ state, parent: element });

    return () => {
      view.destroy();
    };
  },
);
