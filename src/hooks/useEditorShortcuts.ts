import { useEffect } from "react";
import { TAG_SHORTCUTS, type TagType } from "@/lib/structure";

export type ShortcutHandlers = {
  enabled: boolean;
  /** True while a text highlight is waiting to be turned into a tag. */
  hasPending: boolean;
  /** Tag the pending highlight. */
  onTagPending: (type: TagType) => void;
  /** Retag the currently selected element. */
  onRetagSelected: (type: TagType) => void;
  /** True while several elements are lasso-selected. */
  hasMulti: boolean;
  /** Retag every lasso-selected element at once. */
  onTagMulti: (type: TagType) => void;
  onToggleLasso: () => void;
  hasSelection: boolean;
  onClearPending: () => void;
  onStepSelection: (direction: -1 | 1) => void;
  onMoveOrder: (direction: -1 | 1) => void;
  onToggleDecorative: () => void;
  onDeleteSelected: () => void;
  onStepPage: (direction: -1 | 1) => void;
  onToggleOverlay: () => void;
  onToggleHighlightMode: () => void;
  onToggleHelp: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

/**
 * Single keyboard layer for the remediation editor. Highlighting text on the
 * page and pressing one key is the fastest path to a correct tag, so the
 * pending highlight always wins over the selected element.
 */
export function useEditorShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handlers.onSave();
        return;
      }
      // Undo / redo: ⌘Z and ⇧⌘Z (or Ctrl+Y).
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handlers.onRedo();
        else handlers.onUndo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handlers.onRedo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "?") {
        event.preventDefault();
        handlers.onToggleHelp();
        return;
      }
      if (event.key === "Escape") {
        handlers.onClearPending();
        return;
      }
      if (!handlers.enabled) return;

      const key = event.key.toLowerCase();

      // Tagging: the highlight takes priority, then the selected element.
      const tag = TAG_SHORTCUTS[key];
      if (tag) {
        if (handlers.hasPending) {
          event.preventDefault();
          handlers.onTagPending(tag);
          return;
        }
        if (handlers.hasMulti) {
          event.preventDefault();
          handlers.onTagMulti(tag);
          return;
        }
        if (handlers.hasSelection) {
          event.preventDefault();
          handlers.onRetagSelected(tag);
          return;
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (event.shiftKey) handlers.onMoveOrder(1);
          else handlers.onStepSelection(1);
          return;
        case "ArrowUp":
          event.preventDefault();
          if (event.shiftKey) handlers.onMoveOrder(-1);
          else handlers.onStepSelection(-1);
          return;
        case "Delete":
        case "Backspace":
          if (!handlers.hasSelection && !handlers.hasMulti) return;
          event.preventDefault();
          handlers.onDeleteSelected();
          return;
        default:
          break;
      }

      switch (key) {
        case "d":
          event.preventDefault();
          handlers.onToggleDecorative();
          return;
        case "v":
          event.preventDefault();
          handlers.onToggleOverlay();
          return;
        case "h":
          event.preventDefault();
          handlers.onToggleHighlightMode();
          return;
        case "x":
          event.preventDefault();
          handlers.onToggleLasso();
          return;
        case ",":
          event.preventDefault();
          handlers.onStepPage(-1);
          return;
        case ".":
          event.preventDefault();
          handlers.onStepPage(1);
          return;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}

/** Rows shown in the shortcut cheat sheet. */
export const SHORTCUT_ROWS: { keys: string; action: string }[] = [
  { keys: "Highlight text, then 1–6", action: "Tag it as Heading 1 to Heading 6" },
  { keys: "Highlight text, then P", action: "Tag it as a paragraph" },
  { keys: "Highlight text, then L / I", action: "Tag it as a list / list item" },
  { keys: "Highlight text, then C", action: "Tag it as a caption" },
  { keys: "Highlight text, then K", action: "Tag it as a link" },
  { keys: "Highlight text, then Q", action: "Tag it as a block quote" },
  { keys: "Highlight text, then A", action: "Mark it as an artifact (ignored by screen readers)" },
  { keys: "F / T / M", action: "Figure / Table / Form field" },
  { keys: "Esc", action: "Clear the highlight" },
  { keys: "↑ / ↓", action: "Move between elements on the page" },
  { keys: "Shift + ↑ / ↓", action: "Move the element earlier or later in the reading order" },
  { keys: "D", action: "Mark the element decorative (or undo it)" },
  { keys: "Delete", action: "Remove the element from the structure" },
  { keys: "H", action: "Turn highlight mode on or off" },
  { keys: "X", action: "Turn the lasso on or off (drag a box to select several elements)" },
  { keys: "Lasso, then a tag key", action: "Retag every selected element at once" },
  { keys: "V", action: "Show or hide the tag overlay" },
  { keys: ", / .", action: "Previous / next page" },
  { keys: "Ctrl or ⌘ + Z", action: "Undo the last change" },
  { keys: "Ctrl or ⌘ + Shift + Z", action: "Redo the change you undid" },
  { keys: "Ctrl or ⌘ + S", action: "Save your work" },
  { keys: "?", action: "Open this cheat sheet" },
];
