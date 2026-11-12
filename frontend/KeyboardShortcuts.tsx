import { useEffect, useRef } from "react";
import { labels, names } from "./data";
import "./keyboard.css";

export const shortcutGroups = [
  { title: "Search & workspace", entries: [
    ["/ or ⌘ / Ctrl + F", "Focus search"], ["Enter", "Apply filters"],
    ["⌘ / Ctrl + S", "Save a search configuration"],
    ["Alt + P / S", "Switch to players / staff"], ["Alt + E", "Export matching rows"],
  ] },
  { title: "Results & reports", entries: [
    ["↓ from search", "Move to results"], ["↑ / ↓ or K / J", "Move between rows"],
    ["Home / End", "First / last result"], ["Page Up / Down", "Move a page of results"],
    ["Space", "Open a row or select for comparison"], ["Esc", "Return from a report or close a panel"],
    ["Alt + ← / →", "Previous / next report"], ["Alt + C", "Toggle player comparison"],
    ["Alt + Return", "Compare selected players"],
  ] },
  { title: "Column sorting", entries: [
    ["Alt + 1–9", "Sort by the numbered visible column; repeat to reverse"],
    ["Alt + Shift + 1–9", "Sort that column ascending"], ["Alt + 0", "Reverse the current sort"],
    ["?", "Open this guide"],
  ] },
];

export function ShortcutGuide({ columns, onClose }: { columns: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="shortcut-dialog export-dialog" ref={dialog} aria-labelledby="shortcut-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="shortcut-title"><h2 id="shortcut-title">Keyboard shortcuts</h2><button onClick={onClose} aria-label="Close keyboard shortcuts">Close</button></div>
    <p className="muted shortcut-intro">Letter and number shortcuts stay inactive while typing. Use Option for Alt on Mac.</p>
    {shortcutGroups.map(group => <section key={group.title}><h3>{group.title}</h3><dl className="shortcut-list">
      {group.entries.map(([keys, description]) => <div key={keys}><dt>{description}</dt><dd><kbd>{keys}</kbd></dd></div>)}
    </dl></section>)}
    <p className="shortcut-intro muted">Current column numbers</p>
    <ol className="shortcut-columns">{columns.slice(0, 9).map(key => <li key={key}>{labels[key] || names[key] || key}</li>)}</ol>
  </dialog>;
}

export function KeybindBar({ profile, onSearch, onApply, onResults, onSave, onHelp, onBack, onPrevious, onNext, hasPrevious, hasNext }: {
  profile: boolean; onSearch: () => void; onApply: () => void; onResults: () => void; onSave: () => void; onHelp: () => void;
  onBack: () => void; onPrevious: () => void; onNext: () => void; hasPrevious: boolean; hasNext: boolean;
}) {
  return <nav className="keybind-bar" aria-label="Keyboard shortcuts">
    {profile ? <>
      <button onClick={onBack}><kbd>Esc</kbd> Results</button>
      <button onClick={onPrevious} disabled={!hasPrevious}><kbd>Alt ←</kbd> Previous</button>
      <button onClick={onNext} disabled={!hasNext}><kbd>Alt →</kbd> Next</button>
    </> : <>
      <button onClick={onSearch}><kbd>/</kbd> Search</button>
      <button onClick={onApply}><kbd>Enter</kbd> Apply</button>
      <button onClick={onResults}><kbd>↑ ↓</kbd> Results</button>
      <button onClick={onSave}><kbd>⌘ / Ctrl S</kbd> Save search</button>
      <span className="keybind-sort"><kbd>Alt 1–9</kbd> Sort columns</span>
    </>}
    <button className="keybind-help" onClick={onHelp} aria-label="Keyboard shortcuts"><kbd>?</kbd> Shortcuts</button>
  </nav>;
}
