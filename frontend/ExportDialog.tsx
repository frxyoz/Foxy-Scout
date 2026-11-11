import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { csv, CsvOptions, currencyRow, Row } from "./data";

export function ExportDialog({ rows, columns, mode, factor, symbol, currency, onClose, onExport }: {
  rows: Row[]; columns: string[]; mode: string; factor: number;
  symbol: string; currency: string; onClose: () => void; onExport: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scope, setScope] = useState("all");
  const [start, setStart] = useState("1");
  const [count, setCount] = useState(String(Math.min(100, rows.length)));
  const [columnScope, setColumnScope] = useState("all");
  const [delimiter, setDelimiter] = useState<NonNullable<CsvOptions["delimiter"]>>(",");
  const [headers, setHeaders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = scope === "all" ? 1 : Number(start);
  const amount = scope === "all" ? rows.length : Number(count);
  const valid = Number.isSafeInteger(first) && first >= 1 && first <= rows.length
    && Number.isSafeInteger(amount) && amount >= 1 && amount <= rows.length - first + 1;
  const allKeys = useMemo(
    () => {
      const keys = new Set<string>();
      for (const row of rows) {
        for (const key of Object.keys(currencyRow(row, 1, symbol))) keys.add(key);
      }
      return [...keys];
    },
    [rows, symbol],
  );
  const keys = columnScope === "visible" ? [...new Set(columns)] : allKeys;

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const path = await invoke<string | null>("export_csv", {
        contents: csv(rows.slice(first - 1, first - 1 + amount), factor, symbol, {
          columns: keys, delimiter, includeHeaders: headers,
        }),
        suggestedName: mode === "Staff" ? "foxy-staff.csv" : "foxy-players.csv",
      });
      if (path) {
        onExport(`Exported ${amount.toLocaleString()} ${mode.toLowerCase()} to ${path}`);
        onClose();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="export-dialog" aria-labelledby="export-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <h2 id="export-title">Export {mode.toLowerCase()} to CSV</h2>
        <p className="muted">{rows.length.toLocaleString()} matching {mode.toLowerCase()}. Rows follow the current filters and sort order.</p>
        <label>Rows to export
          <select value={scope} onChange={(e) => setScope(e.target.value)} disabled={busy}>
            <option value="all">All matching rows</option>
            <option value="range">Custom row range</option>
          </select>
        </label>
        {scope === "range" && <div className="export-range">
          <label>Start at row
            <input type="number" min="1" max={rows.length} step="1" required value={start}
              disabled={busy} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>Number of rows
            <input type="number" min="1" max={Math.max(0, rows.length - Number(start) + 1)} step="1" required
              value={count} disabled={busy} onChange={(e) => setCount(e.target.value)} />
          </label>
        </div>}
        <label>Columns to export
          <select value={columnScope} onChange={(e) => setColumnScope(e.target.value)} disabled={busy}>
            <option value="all">All available columns</option>
            <option value="visible">Current table columns</option>
          </select>
        </label>
        <label>Separator
          <select value={delimiter} onChange={(e) => setDelimiter(e.target.value as NonNullable<CsvOptions["delimiter"]>)} disabled={busy}>
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value={"\t"}>Tab</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={headers} disabled={busy}
          onChange={(e) => setHeaders(e.target.checked)} />Include column headers</label>
        <p className="export-summary" role="status">{valid
          ? `${amount.toLocaleString()} data rows · ${keys.length} columns · ${currency} · rows ${first.toLocaleString()}–${(first + amount - 1).toLocaleString()}`
          : "Enter a whole-number row range within the matching results."}</p>
        {error && <p role="alert">{error}</p>}
        <div className="export-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" disabled={!valid || busy}>{busy ? "Saving…" : "Save CSV"}</button>
        </div>
      </form>
    </dialog>
  );
}
