import { useEffect, useRef, useState } from "react";
import { labels, names } from "./data";

export function ColumnPicker({ available, value, defaults, onChange }: {
  available: string[]; value: string[]; defaults: string[]; onChange: (columns: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDetailsElement>(null);
  const title = (key: string) => labels[key] || names[key] || key;
  const matches = available.filter(key => `${title(key)} ${key}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) root.current?.removeAttribute("open");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && root.current?.open) {
        root.current.open = false;
        root.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return <details className="column-picker" ref={root} onToggle={() => { if (!root.current?.open) setQuery(""); }}>
    <summary>Customize columns</summary>
    <div className="column-panel">
      <div className="column-panel-heading"><strong>Table columns</strong><span>{value.length + 1} shown</span></div>
      <input type="search" aria-label="Find a column" placeholder="Find an attribute or column…" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="column-options">
        {matches.map(key => <label className="check" key={key}>
          <input type="checkbox" checked={value.includes(key)} onChange={event => onChange(event.target.checked ? [...value, key] : value.filter(item => item !== key))} />
          {title(key)}
        </label>)}
        {!matches.length && <p className="muted">No columns match “{query}”.</p>}
      </div>
      <button className="text-button" onClick={() => onChange(defaults)}>Restore default</button>
    </div>
  </details>;
}
