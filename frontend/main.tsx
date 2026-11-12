import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import {
  Row,
  groups,
  staffGroups,
  names,
  labels,
  positions,
  scenarios,
  overview,
  extras,
  isMoney,
  Filters,
  defaults,
  filterPlayers,
  compare,
  searchColumns,
  matchesSearch,
  matchesColumnRules,
  ColumnRule,
  ruleError,
} from "./data";
import { ColumnFilters } from "./ColumnFilters";
import { ColumnPicker } from "./ColumnPicker";
import { AppHeader } from "./AppHeader";
import { Preferences, Appearance, Accent, Motion, Density } from "./Preferences";
import { SavedSearches, SearchConfiguration } from "./SavedSearches";
import { KeybindBar, ShortcutGuide } from "./KeyboardShortcuts";
import { ExportDialog } from "./ExportDialog";
import logo from "./assets/fox-logo.png";
import "./style.css";
import roleNames from "./roles.json";
type Snapshot = {
  players: Row[];
  staff: Row[];
  game_date: string;
  game_year: number;
  fm_version: number;
  cache_hit: boolean;
  elapsed_ms: number;
};
const hadCurrencyPreference = localStorage.getItem("foxy-currency") !== null;
const text = (v: any) =>
  v === null || v === undefined || v === "" ? "—" : String(v);
function saved<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function useSaved<T>(key: string, fallback: T) {
  const [v, set] = useState<T>(() => saved(key, fallback));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(v));
  }, [key, v]);
  return [v, set] as const;
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, child => React.isValidElement<Record<string,unknown>>(child) && (child.type === 'input' || child.type === 'select' || child.type === NumericInput) ? React.cloneElement(child, {id}) : child)}
    </div>
  );
}
function NumericInput({ value, onChange, min, max, fallback, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max"> & {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
  fallback: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  const normalize = (raw: string) => {
    const number = raw.trim() === "" ? fallback : Number(raw);
    return Math.max(min, Math.min(max ?? Infinity, Number.isFinite(number) ? number : fallback));
  };
  return <input {...props} type="number" min={min} max={max} value={draft}
    onFocus={() => { focused.current = true; }}
    onChange={(e) => {
      setDraft(e.target.value);
      onChange(normalize(e.target.value));
    }}
    onBlur={(e) => {
      focused.current = false;
      const next = normalize(e.target.value);
      setDraft(String(next));
      onChange(next);
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter") e.currentTarget.blur();
    }}
  />;
}
function Range({
  label,
  value,
  onChange,
  min,
  max,
  fallback = [min, max],
}: {
  label: string;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  min: number;
  max: number;
  fallback?: [number, number];
}) {
  return (
    <fieldset className="range">
      <legend>{label}</legend>
      <div>
        <NumericInput
          aria-label={label + " minimum"}
          type="number"
          min={min}
          max={value[1]}
          value={value[0]}
          fallback={fallback[0]}
          onChange={(v) => onChange([v, value[1]])}
        />
        <span>to</span>
        <NumericInput
          aria-label={label + " maximum"}
          type="number"
          min={value[0]}
          max={max}
          value={value[1]}
          fallback={fallback[1]}
          onChange={(v) => onChange([value[0], v])}
        />
      </div>
    </fieldset>
  );
}
function Multi({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDetailsElement>(null);
  const toggle = (option: string) => onChange(value.includes(option) ? value.filter(item => item !== option) : [...value, option]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) root.current?.removeAttribute("open");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && root.current?.open) {
        root.current.open = false;
        root.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, []);
  return (
    <fieldset className="multi-filter">
      <legend>{label}</legend>
      {label === "Positions" ? <div className="position-choices" role="group" aria-label={label}>
        {[["", "ST", ""], ["AML", "AMC", "AMR"], ["ML", "MC", "MR"], ["WBL", "DM", "WBR"], ["DL", "DC", "DR"], ["", "GK", ""]].flatMap((line, row) =>
          line.map((option, column) => option && options.includes(option) ? <button key={option} type="button" style={{ gridRow: row + 1, gridColumn: column + 1 }} aria-pressed={value.includes(option)} onClick={() => toggle(option)}>{option}</button> : null)
        )}
      </div> : <details className="multi-disclosure" ref={root} onToggle={() => { if (!root.current?.open) setQuery(""); }}>
        <summary>{value.length ? `${value.length} selected` : "Any nationality"}</summary>
        <div className="multi-content">
          <input type="search" aria-label={`Find ${label.toLowerCase()}`} placeholder="Find a nationality…" value={query} onChange={event => setQuery(event.target.value)} />
          <div className="multi-options" role="group" aria-label={label}>
            {options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase())).map(option => <label className="check" key={option}>
              <input type="checkbox" checked={value.includes(option)} onChange={() => toggle(option)} />{option}
            </label>)}
            {!options.some(option => option.toLowerCase().includes(query.trim().toLowerCase())) && <p className="muted">No nationalities found.</p>}
          </div>
        </div>
      </details>}
      {value.length > 0 && <button className="text-button multi-clear" type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange([])}>Clear selection</button>}
    </fieldset>
  );
}
function Tabs({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string;
  onChange: (s: string) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((x) => (
        <button
          key={x}
          aria-pressed={x === value}
          className={x === value ? "active" : ""}
          onClick={() => onChange(x)}
        >
          {x}
        </button>
      ))}
    </div>
  );
}
function MoneyCell({
  value,
  factor,
  symbol,
}: {
  value: any;
  factor: number;
  symbol: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [narrow, setNarrow] = useState(false);
  const converted = value == null ? null : Math.round(value * factor);
  const full =
    converted == null ? "—" : symbol + converted.toLocaleString("en-US");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.font = getComputedStyle(el).font;
        setNarrow(ctx.measureText(full).width > el.clientWidth);
      }
    };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    return () => ro.disconnect();
  }, [full]);
  return (
    <span ref={ref} className="money-cell" title={full} aria-label={full}>
      {narrow && converted !== null
        ? symbol + (converted / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
        : full}
    </span>
  );
}
function DataTable({
  rows,
  columns,
  onSelect,
  selected,
  compareMode,
  factor,
  symbol,
  sort,
  onSort,
  staff,
  density,
}: {
  staff: boolean;
  density: Density;
  rows: Row[];
  columns: string[];
  onSelect: (r: Row) => void;
  selected: number[];
  compareMode: boolean;
  factor: number;
  symbol: string;
  sort: { key: string; asc: boolean } | null;
  onSort: (s: { key: string; asc: boolean }) => void;
}) {
  const [top, setTop] = useState(0);
  const rowHeight = density === "compact" ? 28 : 34;
  const ref = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const focusedRow = useRef<number | null>(null);
  useEffect(() => {
    setTop(0);
    pendingFocus.current = null;
    focusedRow.current = null;
    if (ref.current) ref.current.scrollTop = 0;
  }, [rows, columns.join(","), rowHeight]);
  const start = Math.max(0, Math.floor(top / rowHeight) - 8),
    end = Math.min(rows.length, start + Math.ceil(900 / rowHeight) + 16);
  useEffect(() => {
    if (pendingFocus.current === null) return;
    const row = ref.current?.querySelector<HTMLElement>(`[data-row-index="${pendingFocus.current}"]`);
    if (row) {
      row.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  });
  const focusRow = (index: number) => {
    const container = ref.current;
    if (!container || !rows.length) return;
    const next = Math.max(0, Math.min(rows.length - 1, index));
    const headerHeight = container.querySelector("thead")?.getBoundingClientRect().height || 38;
    const rowTop = headerHeight + next * rowHeight;
    const rowBottom = rowTop + rowHeight;
    if (rowTop < container.scrollTop + headerHeight) container.scrollTop = next * rowHeight;
    else if (rowBottom > container.scrollTop + container.clientHeight) container.scrollTop = rowBottom - container.clientHeight;
    focusedRow.current = next;
    pendingFocus.current = next;
    setTop(container.scrollTop);
    const row = container.querySelector<HTMLElement>(`[data-row-index="${next}"]`);
    if (row) {
      row.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  };
  return (
    <div
      className="table-scroll"
      ref={ref}
      tabIndex={0}
      aria-label="Scouting results"
      onScroll={(e) => setTop(e.currentTarget.scrollTop)}
      onKeyDown={(e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !rows.length) return;
        const target = e.target as HTMLElement;
        const row = target.closest<HTMLElement>("[data-row-index]");
        if (target !== e.currentTarget && (!row || target !== row)) return;
        const current = row ? Number(row.dataset.rowIndex) : focusedRow.current;
        const page = Math.max(1, Math.floor((e.currentTarget.clientHeight - 38) / rowHeight));
        let next: number;
        if (e.key === "ArrowDown" || e.key === "j") next = current === null ? 0 : current + 1;
        else if (e.key === "ArrowUp" || e.key === "k") next = current === null ? 0 : current - 1;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = rows.length - 1;
        else if (e.key === "PageDown") next = current === null ? 0 : current + page;
        else if (e.key === "PageUp") next = current === null ? 0 : current - page;
        else return;
        e.preventDefault();
        e.stopPropagation();
        focusRow(next);
      }}
    >
      <table className="results">
        <colgroup>
          {compareMode && <col style={{ width: 38 }} />}
          {columns.map((k, i) => (
            <col
              key={k}
              style={{
                width:
                  i === 0
                    ? 220
                    : isMoney(k)
                      ? 150
                      : k === "Club" || k === "Personality"
                        ? 180
                        : 100,
              }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {compareMode && <th aria-label="Select players" />}
            {columns.map((k, columnIndex) => (
              <th key={k} aria-sort={sort?.key === k ? (sort.asc ? "ascending" : "descending") : "none"}>
                <button
                  title={names[k] || labels[k] || k}
                  onClick={() =>
                    onSort({
                      key: k,
                      asc: sort?.key === k ? !sort.asc : k === "Name",
                    })
                  }
                >
                  {columnIndex < 9 && <span className="column-key" aria-hidden="true">{columnIndex + 1}</span>}
                  {k === "Name" && staff ? "Staff member" : labels[k] || k}
                  {sort?.key === k ? (sort.asc ? " ↑" : " ↓") : ""}
                </button>
                <span
                  className="resize"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const th = e.currentTarget.parentElement!;
                    const table = th.closest("table")!;
                    const index = Array.from(
                      th.parentElement!.children,
                    ).indexOf(th);
                    const col = table.querySelectorAll("col")[index];
                    const x = e.clientX,
                      width = th.getBoundingClientRect().width;
                    const move = (ev: PointerEvent) => {
                      col.style.width =
                        Math.max(65, width + ev.clientX - x) + "px";
                    };
                    const up = () => {
                      document.removeEventListener("pointermove", move);
                      document.removeEventListener("pointerup", up);
                    };
                    document.addEventListener("pointermove", move);
                    document.addEventListener("pointerup", up);
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {start > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length + (compareMode ? 1 : 0)}
                style={{ height: start * rowHeight, padding: 0, border: 0 }}
              />
            </tr>
          )}
          {rows.slice(start, end).map((r, i) => (
            <tr
              key={r.UID ?? start + i}
              tabIndex={0}
              data-row-index={start + i}
              onFocus={() => { focusedRow.current = start + i; }}
              className={selected.includes(r.UID) ? "selected" : ""}
              onClick={() => onSelect(r)}
              onKeyDown={(e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(r);
                }
              }}
              aria-label={"Open " + r.Name}
            >
              {compareMode && (
                <td>
                  <input
                    aria-label={"Select " + r.Name}
                    type="checkbox"
                    checked={selected.includes(r.UID)}
                    readOnly
                    tabIndex={-1}
                  />
                </td>
              )}
              {columns.map((k, j) => {
                const numeric = typeof r[k] === "number";
                const max = ["CA", "PA"].includes(k)
                  ? 200
                  : ["RoleRtg", "PotRtg"].includes(k)
                    ? 100
                    : Object.values(groups).flat().includes(k) ||
                        Object.values(staffGroups).flat().includes(k)
                      ? 20
                      : 0;
                return (
                  <td
                    key={k}
                    className={
                      (numeric ? "numeric " : "") + (j === 0 ? "name-cell" : "")
                    }
                    title={text(r[k])}
                  >
                    {k === "Name" && !staff ? (
                      <span className="player-name">
                        {r.TransferListed === true && <span className="listing-badge transfer-listed" role="img" title="Transfer listed" aria-label="Transfer listed">Trn</span>}
                        {r.LoanListed === true && <span className="listing-badge loan-listed" role="img" title="Loan listed" aria-label="Loan listed">Loa</span>}
                        <span className="player-name-text">{text(r.Name)}</span>
                      </span>
                    ) : isMoney(k) ? (
                      <MoneyCell value={r[k]} factor={factor} symbol={symbol} />
                    ) : max ? (
                      <span className="score-cell">
                        <span
                          className={
                            "score-fill " +
                            (["Dirt", "InjP", "Contr"].includes(k)
                              ? "risk"
                              : "")
                          }
                          style={{
                            width:
                              Math.max(0, Math.min(100, (r[k] / max) * 100)) +
                              "%",
                          }}
                        />
                        <b>{text(r[k])}</b>
                      </span>
                    ) : (
                      text(r[k])
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {end < rows.length && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length + (compareMode ? 1 : 0)}
                style={{
                  height: (rows.length - end) * rowHeight,
                  padding: 0,
                  border: 0,
                }}
              />
            </tr>
          )}
        </tbody>
      </table>
      {!rows.length && (
        <p className="empty">
          No matches. Clear a filter to show more results.
        </p>
      )}
    </div>
  );
}
function Attributes({
  row,
  keys,
  title,
  playerColors = false,
}: {
  row: Row;
  keys: string[];
  title: string;
  playerColors?: boolean;
}) {
  return (
    <section className="attribute-group">
      <h3>{title}</h3>
      <dl>
        {keys.map((k) => (
          <div key={k}>
            <dt>{names[k] || k}</dt>
            <dd
              className={
                playerColors && typeof row[k] === "number" && row[k] >= 1 && row[k] <= 20
                  ? "attribute-tone-" + (() => {
                      const value = ["Dirt", "InjP", "Contr"].includes(k) ? 21 - row[k] : row[k];
                      return value <= 5 ? "low" : value <= 10 ? "medium" : value <= 15 ? "good" : "high";
                    })()
                  : !playerColors && row[k] >= 16 && !["Dirt", "InjP", "Contr"].includes(k)
                  ? "strong"
                  : ""
              }
              title={playerColors && ["Dirt", "InjP", "Contr"].includes(k) ? "Lower is better" : undefined}
            >
              {text(row[k])}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
const coords: Record<string, [number, number]> = {
  GK: [100, 177],
  SW: [100, 160],
  DC: [100, 142],
  DL: [32, 140],
  DR: [168, 140],
  WBL: [25, 112],
  WBR: [175, 112],
  DM: [100, 117],
  MC: [100, 89],
  ML: [30, 89],
  MR: [170, 89],
  AMC: [100, 61],
  AML: [30, 53],
  AMR: [170, 53],
  ST: [100, 30],
};
function Pitch({ row }: { row: Row }) {
  return (
    <svg
      className="pitch"
      viewBox="0 0 200 205"
      role="img"
      aria-label="Player position familiarity"
    >
      <rect x="8" y="8" width="184" height="188" rx="2" />
      <path d="M8 102H192 M65 8V36H135V8 M65 196V168H135V196" />
      <circle cx="100" cy="102" r="22" />
      {Object.entries(coords)
        .filter(([k]) => row["Pos_" + k] > 1)
        .map(([k, [x, y]]) => (
          <g key={k}>
            <circle
              cx={x}
              cy={y}
              r="12"
              className={row["Pos_" + k] >= 15 ? "natural" : "playable"}
            />
            <text x={x} y={y + 3} textAnchor="middle">
              {k}
            </text>
            <title>
              {k}: {row["Pos_" + k]}/20
            </title>
          </g>
        ))}
    </svg>
  );
}
function Details({ items }: { items: [string, any][] }) {
  return (
    <dl className="details">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{text(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
function roleName(label: string): string {
  const role = (roleNames as Record<string, { name: string; duty: string }>)[
    label.split(" ")[0]
  ];
  if (!role) return "";
  const duty =
    (
      {
        At: "Attack",
        De: "Defend",
        Su: "Support",
        Au: "Automatic",
        Co: "Cover",
        St: "Stopper",
      } as Row
    )[/\(([^)]+)\)/.exec(label)?.[1] || ""] || role.duty;
  return role.name + (duty ? " — " + duty : "");
}
const reportCache = new WeakMap<Row, Row>();
function Report({
  row,
  staff,
  factor,
  symbol,
}: {
  row: Row;
  staff: boolean;
  factor: number;
  symbol: string;
}) {
  const [sg, setSg] = useSaved("foxy-staff-report-group", "Coaching");
  const money = (v: any) =>
    v == null ? "—" : symbol + Math.round(v * factor).toLocaleString("en-US");
  const clauses = String(row.ReleaseClauses || "None decoded").replace(
    /\$([\d,]+)/g,
    (_, n) => money(+n.replaceAll(",", "")),
  );
  const [remoteReport, setRemoteReport] = useState<Row | null>(null);
  const [roleError, setRoleError] = useState("");
  const [roleLoading, setRoleLoading] = useState(false);
  useEffect(() => {
    setRemoteReport(null);
    setRoleError("");
    if (staff || row.RoleReport || row.role_report) return;
    const cached = reportCache.get(row);
    if (cached) { setRemoteReport(cached); return; }
    let active = true;
    setRoleLoading(true);
    invoke<Row>("role_report", {player: row}).then(result => {
      reportCache.set(row, result);
      if (active) setRemoteReport(result);
    }).catch(error => { if (active) setRoleError(String(error)); })
      .finally(() => { if (active) setRoleLoading(false); });
    return () => { active = false; };
  }, [row, staff]);
  const report = row.RoleReport ?? row.role_report ?? remoteReport;
  const roles: [string, number][] = report?.current || [];
  const pot: Record<string, number> = Object.fromEntries(
    report?.potential || [],
  );
  return (
    <article className="report">
      <div className="profile-heading">
        <div>
          <h2>{row.Name}</h2>
          <p>
            {[row.Club, row.Nation, "Age " + row.Age, row.BestPos]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="metrics">
          {(staff
            ? [
                ["Staff ability", row.CA + " / 200"],
                ["Potential ability", row.PA + " / 200"],
                ["Judging ability", row["Judging Player Ability"] + " / 20"],
                [
                  "Judging potential",
                  row["Judging Player Potential"] + " / 20",
                ],
              ]
            : [
                ["Current ability", row.CA + " / 200"],
                ["Potential ability", row.PA + " / 200"],
                ["Market Value", money(row.MarketValue)],
                ["Sale Value", money(row.SaleValue)],
              ]
          ).map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      </div>
      {staff ? (
        <>
          <Tabs
            label="Staff report section"
            options={Object.keys(staffGroups)}
            value={sg}
            onChange={setSg}
          />
          <div className="staff-attributes">
            <Attributes
              row={row}
              keys={staffGroups[sg].slice(
                0,
                Math.ceil(staffGroups[sg].length / 2),
              )}
              title={sg}
            />
            <Attributes
              row={row}
              keys={staffGroups[sg].slice(
                Math.ceil(staffGroups[sg].length / 2),
              )}
              title={sg + " · continued"}
            />
          </div>
        </>
      ) : (
        <>
          <div className="sheet">
            <div className="attribute-grid">
              <Attributes playerColors row={row} keys={groups.Technical} title="Technical" />
              <Attributes playerColors row={row} keys={groups.Mental} title="Mental" />
              <div>
                <Attributes playerColors row={row} keys={groups.Physical} title="Physical" />
                <Attributes
                  playerColors
                  row={row}
                  keys={groups.Hidden}
                  title="Hidden & feet"
                />
              </div>
              <Attributes
                playerColors
                row={row}
                keys={groups.Goalkeeping}
                title="Goalkeeping"
              />
              <Attributes
                playerColors
                row={row}
                keys={groups.Personality}
                title="Personality"
              />
            </div>
            <section>
              <h3>Positions & roles</h3>
              <Pitch row={row} />
              <Details
                items={[
                  ["Best role", row.Role],
                  ["Current fit", row.RoleRtg + "/100"],
                  ["Potential role", row.PotRole],
                  ["Potential fit", row.PotRtg + "/100"],
                ]}
              />
              <dl className="position-list">
                {positions
                  .filter((p) => row["Pos_" + p] > 1)
                  .map((p) => (
                    <div key={p}>
                      <dt>{p}</dt>
                      <dd>{row["Pos_" + p]}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          </div>
          <div className="report-bottom">
            <section>
              <h3>Role ratings</h3>
              {roles.length ? (
                <table className="role-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Full name</th>
                      <th>Now</th>
                      <th>Potential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...roles]
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td>{roleName(k)}</td>
                          <td>{Math.round(v * 5)}</td>
                          <td>
                            {Math.round((pot[k] ?? v) * 5)}
                            {(pot[k] ?? v) * 5 - v * 5 >= 0.5 && (
                              <span className="role-growth">
                                {" "}
                                +{Math.round((pot[k] ?? v) * 5 - v * 5)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">
                  {roleLoading ? "Loading role ratings…" : roleError ? "Role ratings could not be loaded: " + roleError : "No playable position data for role ratings."}
                </p>
              )}
            </section>
            <section>
              <h3>Contract & value</h3>
              <Details
                items={[
                  ["Club", row.Club],
                  ["Contract until", row.Contract],
                  ["Annual wage", money(row.Wage)],
                  [
                    "Market value range",
                    money(row.MarketValueLo) + " – " + money(row.MarketValueHi),
                  ],
                  ["Sale value", money(row.SaleValue)],
                  ["Sale value basis", row.SaleValueBasis],
                  ["Applicable release cap", money(row.ReleaseClause)],
                  ["Release clauses", clauses],
                  ["Clause eligibility", row.ClauseScenario],
                ]}
              />
            </section>
            <section>
              <h3>Player information</h3>
              <Details
                items={[
                  ["Born", row.DoB],
                  ["Height", row.Height + " cm"],
                  ["Weight", row.Weight ? row.Weight + " kg" : "—"],
                  [
                    "Preferred foot",
                    (
                      { L: "Left", R: "Right", E: "Either", B: "Either" } as Row
                    )[row.Foot],
                  ],
                  ["Left / right foot", row.LeftFoot + " / " + row.RightFoot],
                  ["Personality", row.Personality],
                  ["Reputation", row.Rep],
                  ["Unique ID", row.UID],
                ]}
              />
            </section>
          </div>
        </>
      )}
    </article>
  );
}
function Comparison({
  rows,
  factor,
  symbol,
}: {
  rows: Row[];
  factor: number;
  symbol: string;
}) {
  const [group, setGroup] = useSaved("foxy-compare-group", "Overview");
  const keys =
    group === "Overview"
      ? [
          "BestPos",
          "Nation",
          "Role",
          "Age",
          "CA",
          "PA",
          "Diff",
          "RoleRtg",
          "MarketValue",
          "SaleValue",
          "ReleaseClause",
          "Wage",
        ]
      : group === "Contract & bio"
        ? [
            "Contract",
            "Foot",
            "Personality",
            "DoB",
            "Height",
            "Weight",
            "Rep",
            "Wage",
          ]
        : groups[group] || [];
  return (
    <section>
      <h2>Compare players</h2>
      <Tabs
        label="Compare category"
        options={[
          "Overview",
          "Technical",
          "Mental",
          "Physical",
          "Hidden",
          "Personality",
          "Goalkeeping",
          "Contract & bio",
        ]}
        value={group}
        onChange={setGroup}
      />
      {group === "Overview" && (
        <div className="comparison-bars">
          {rows.map((r) => (
            <div key={r.UID}>
              <span>{r.Name}</span>
              <div>
                <i style={{ width: r.CA / 2 + "%" }} title={"CA " + r.CA} />
                <b style={{ width: r.PA / 2 + "%" }} title={"PA " + r.PA} />
              </div>
              <small>
                {r.CA} CA · {r.PA} PA
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="compare-scroll">
        <table className="comparison">
          <thead>
            <tr>
              <th>Metric</th>
              {rows.map((r) => (
                <th key={r.UID}>
                  {r.Name}
                  <small>{r.Club}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const vals = rows
                .map((r) => r[k])
                .filter((x) => typeof x === "number");
              const lower = [
                "Age",
                "SaleValue",
                "ReleaseClause",
                "Wage",
                "Dirt",
                "InjP",
                "Contr",
              ].includes(k);
              const best = lower ? Math.min(...vals) : Math.max(...vals);
              const different = new Set(vals).size > 1;
              return (
                <tr key={k}>
                  <th>{names[k] || labels[k] || k}</th>
                  {rows.map((r) => (
                    <td
                      key={r.UID}
                      className={different && r[k] === best ? "strong" : ""}
                    >
                      {isMoney(k) ? (
                        <MoneyCell
                          value={r[k]}
                          factor={factor}
                          symbol={symbol}
                        />
                      ) : (
                        text(r[k])
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [path, setPath] = useSaved("foxy-path", ""),
    [folder, setFolder] = useState(""),
    [recent, setRecent] = useState<string[]>([]),
    [force, setForce] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [mode, setMode] = useState("Players"),
    [views, setViews] = useState<Record<string, string>>({
      Players: "list",
      Staff: "list",
    }),
    [profiles, setProfiles] = useState<Record<string, Row | null>>({
      Players: null,
      Staff: null,
    }),
    [loadedPath, setLoadedPath] = useState(""),
    [group, setGroup] = useState("Overview"),
    [staffGroup, setStaffGroup] = useState("Overview"),
    [draft, setDraft] = useState<Filters>(defaults),
    [filters, setFilters] = useState<Filters>(defaults),
    [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null),
    [cmp, setCmp] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [selected, setSelected] = useState<number[]>([]),
    [columns, setColumns] = useSaved<string[]>("foxy-columns-v3", (() => {
      const previous = saved<string[]>("foxy-columns-v2", saved<string[]>("foxy-columns", overview));
      const next = (previous.includes("ValueDifference") ? [...previous] : [...previous, "ValueDifference"]).filter(key => key !== "Nation");
      next.splice(next.includes("BestPos") ? next.indexOf("BestPos") + 1 : next.length, 0, "Nation");
      return next;
    })()),
    [currency, setCurrency] = useSaved("foxy-currency", "EUR"),
    [rate, setRate] = useSaved("foxy-rate", 1.1127),
    [appearance, setAppearance] = useSaved<Appearance>("foxy-appearance", localStorage.getItem("foxy-night") === null ? "system" : saved("foxy-night", false) ? "dark" : "light"),
    [accent, setAccent] = useSaved<Accent>("foxy-accent", "rust"),
    [density, setDensity] = useSaved<Density>("foxy-density", "comfortable"),
    [motion, setMotion] = useSaved<Motion>("foxy-motion", "system"),
    [showRatingBars, setShowRatingBars] = useSaved("foxy-rating-bars", true),
    [showKeybindBar, setShowKeybindBar] = useSaved("foxy-keybind-bar", true),
    [shortcutsOpen, setShortcutsOpen] = useState(false),
    [sf, setSf] = useState({
      search: "",
      age: [18, 80] as [number, number],
      nations: [] as string[],
      attr: "Attacking",
      min: 1,
      sort: "CA",
      columnRules: [] as ColumnRule[],
    }),
    [sfApplied, setSfApplied] = useState(sf);
  const view = views[mode],
    profile = profiles[mode];
  const filtersPending = JSON.stringify(mode === "Staff" ? sf : draft) !== JSON.stringify(mode === "Staff" ? sfApplied : filters);
  const setView = (value: string) => setViews((v) => ({ ...v, [mode]: value }));
  const setProfile = (value: Row | null) =>
    setProfiles((v) => ({ ...v, [mode]: value }));
  const factor = currency === "EUR" ? 1 / rate : 1,
    symbol = currency === "EUR" ? "€" : "$";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => { document.documentElement.dataset.theme = appearance === "dark" || (appearance === "system" && media.matches) ? "night" : "light"; };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [appearance]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    root.dataset.density = density;
    root.dataset.motion = motion;
    root.dataset.ratingBars = showRatingBars ? "visible" : "hidden";
  }, [accent, density, motion, showRatingBars]);
  useEffect(() => {
    if (hadCurrencyPreference) return;
    invoke<{ currency?: string; usd_per_eur?: number }>("load_preferences")
      .then((p) => {
        if (p?.currency === "EUR" || p?.currency === "USD")
          setCurrency(p.currency);
        if (
          p?.usd_per_eur &&
          Number.isFinite(p.usd_per_eur) &&
          p.usd_per_eur > 0
        )
          setRate(p.usd_per_eur);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    invoke<string[]>("recent_saves")
      .then((s) => {
        setRecent(s);
        if (!path && s[0]) setPath(s[0]);
      })
      .catch((e) => setError(String(e)));
  }, []);
  const players = snapshot?.players || [];
  const staff = useMemo(
    () =>
      snapshot?.staff.map((r) => ({
        ...r,
        ...r.attributes,
        Name: r.Name ?? r.name,
        UID: r.UID ?? r.uid,
        Age: r.Age ?? r.age,
        Nation: r.Nation ?? r.nation,
        CA: r.CA ?? r.ca,
        PA: r.PA ?? r.pa,
        Reputation: r.Reputation ?? r.reputation,
      })) || [],
    [snapshot],
  );
  const filtered = useMemo(
    () => filterPlayers(players, filters, snapshot?.game_date || "", factor),
    [players, filters, snapshot?.game_date, factor],
  );
  const searchableColumns = useMemo(() => searchColumns(
    mode === "Staff" ? staff : players,
    mode === "Staff" ? ["Name", "Nation", "Age", "CA", "PA", "UID", ...Object.values(staffGroups).flat()] : ["Name", ...extras, ...Object.values(groups).flat(), ...positions.map(p => "Pos_" + p)],
  ), [snapshot, staff, mode]);
  const filteredStaff = useMemo(
    () =>
      staff
        .filter(
          (r) =>
            r.Age >= sfApplied.age[0] &&
            r.Age <= sfApplied.age[1] &&
            r[sfApplied.attr] >= sfApplied.min &&
            (!sfApplied.nations.length ||
              sfApplied.nations.includes(r.Nation)) &&
            matchesSearch(r, sfApplied.search, factor) &&
            matchesColumnRules(r, sfApplied.columnRules, factor),
        )
        .sort((a, b) =>
          compare(
            a[sfApplied.sort],
            b[sfApplied.sort],
            ["Name", "Age"].includes(sfApplied.sort),
          ),
        ),
    [staff, sfApplied, factor],
  );
  const baseRows = mode === "Staff" ? filteredStaff : filtered;
  const rows = useMemo(
    () =>
      sort
        ? [...baseRows].sort((a, b) =>
            compare(a[sort.key], b[sort.key], sort.asc),
          )
        : baseRows,
    [baseRows, sort],
  );
  const nations = Array.from(
    new Set(
      (mode === "Staff" ? staff : players).map((r) => r.Nation).filter(Boolean),
    ),
  ).sort();
  const shown =
    mode === "Staff"
      ? [
          "Name",
          "Nation",
          "Age",
          "CA",
          "PA",
          ...(staffGroup === "Overview"
            ? [
                "Judging Player Ability",
                "Judging Player Potential",
                "Physiotherapy",
              ]
            : staffGroups[staffGroup]),
        ]
      : group === "Overview"
        ? ["Name", ...columns]
        : [
            "Name",
            "Age",
            "CA",
            "PA",
            "Diff",
            "BestPos",
            "Nation",
            ...(group === "All attributes"
              ? Object.values(groups).flat()
              : [
                  ...(group === "Personality" ? ["Personality"] : []),
                  ...groups[group],
                ]),
          ];
  const configuration: SearchConfiguration = mode === "Staff"
    ? { mode: "Staff", filters: sf, sort, group: staffGroup, currency, rate }
    : { mode: "Players", filters: draft, sort, group, columns, currency, rate };
  const profileIndex = profile ? rows.findIndex(row => row.UID === profile.UID) : -1;
  function browseProfile(direction: number) {
    const next = rows[profileIndex + direction];
    if (view === "profile" && profileIndex >= 0 && next) setProfile(next);
  }
  function focusSearch() {
    const input = document.querySelector<HTMLInputElement>('aside input[data-scout-search]');
    if (input) { input.closest("details")?.setAttribute("open", ""); input.focus(); input.select(); }
  }
  function focusResults() {
    const table = document.querySelector<HTMLElement>('.table-scroll');
    table?.focus();
    table?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  }
  function saveSearch() {
    const panel = document.querySelector<HTMLDetailsElement>('.saved-searches');
    if (panel) { panel.open = true; panel.querySelector<HTMLInputElement>('input')?.focus(); }
  }
  function restoreSearch(config: SearchConfiguration) {
    setCurrency(config.currency); setRate(config.rate); setSort(config.sort);
    if (config.mode === "Players") {
      setDraft(config.filters); setFilters(config.filters); setColumns(config.columns);
      setGroup(["Overview", "All attributes", ...Object.keys(groups)].includes(config.group) ? config.group : "Overview");
      setSelected([]);
    } else {
      setSf(config.filters); setSfApplied(config.filters);
      setStaffGroup(["Overview", ...Object.keys(staffGroups)].includes(config.group) ? config.group : "Overview");
    }
    setView("list");
  }
  function sortColumn(index: number, ascending = false) {
    const key = shown[index];
    if (!key) return;
    const numeric = rows.some(row => typeof row[key] === "number");
    setSort(current => ({ key, asc: ascending || (current?.key === key ? !current.asc : !numeric) }));
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || document.querySelector('dialog[open], .header-panel, .column-picker[open], .multi-disclosure[open]')) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editing = !!target?.closest('input, select, textarea, [contenteditable="true"], [role="textbox"]');
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (event.key === "Enter" && !command && !event.altKey && !event.shiftKey && view === "list"
        && !target?.closest('button, summary, a, select, input[type="checkbox"], .saved-searches')
        && (!editing || target?.closest('aside form'))) {
        event.preventDefault();
        document.querySelector<HTMLFormElement>('aside form')?.requestSubmit();
        return;
      }
      if (command && !event.altKey && !event.shiftKey && view === "list" && (key === "f" || key === "s" || key === "enter")) {
        event.preventDefault();
        if (key === "f") focusSearch();
        else if (key === "s") saveSearch();
        else document.querySelector<HTMLFormElement>('aside form')?.requestSubmit();
        return;
      }
      if (editing || command) {
        if (target?.matches('input[data-scout-search]') && event.key === "ArrowDown" && !event.altKey && !command && view === "list" && rows.length) {
          event.preventDefault(); focusResults();
        }
        return;
      }
      if (event.altKey) {
        if (/^Digit[1-9]$/.test(event.code) && view === "list") { event.preventDefault(); sortColumn(Number(event.code.slice(-1)) - 1, event.shiftKey); }
        else if (event.code === "Digit0" && view === "list") {
          event.preventDefault();
          const current = sort || { key: mode === "Staff" ? sfApplied.sort : filters.sort, asc: ["Name", "Age"].includes(mode === "Staff" ? sfApplied.sort : filters.sort) };
          setSort({ ...current, asc: !current.asc });
        }
        else if (event.code === "KeyP" || event.code === "KeyS") { event.preventDefault(); const next = event.code === "KeyP" ? "Players" : "Staff"; setMode(next); setViews(value => ({ ...value, [next]: "list" })); setSort(null); }
        else if (event.code === "KeyE" && view === "list" && snapshot && rows.length) { event.preventDefault(); setExportOpen(true); }
        else if (event.code === "KeyC" && mode === "Players" && view === "list") { event.preventDefault(); setCmp(value => !value); setSelected([]); }
        else if (event.key === "Enter" && mode === "Players" && cmp && selected.length >= 2) { event.preventDefault(); setView("compare"); }
        else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { if (view === "profile") { event.preventDefault(); browseProfile(event.key === "ArrowLeft" ? -1 : 1); } }
        return;
      }
      if (event.key === "/" && view === "list") { event.preventDefault(); focusSearch(); }
      else if (event.key === "?") { event.preventDefault(); setShortcutsOpen(true); }
      else if (event.key === "Escape" && view !== "list") { event.preventDefault(); setView("list"); }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [view, mode, shown.join(","), rows, sort, profileIndex, filters.sort, sfApplied.sort, cmp, selected, snapshot]);
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  async function load() {
    setBusy(true);
    setError("");
    setNotice("Reading FM24 save and computing ratings…");
    try {
      const result = await invoke<Snapshot>("load_save", { path, force });
      setSnapshot(result);
      setLoadedPath(path);
      setViews({ Players: "list", Staff: "list" });
      setProfiles({ Players: null, Staff: null });
      setSelected([]);
      setNotice(
        `${result.cache_hit ? "Loaded from disk cache" : "Save loaded"} · ${(result.elapsed_ms / 1000).toFixed(2)}s`,
      );
    } catch (e) {
      setError(String(e));
      setNotice("");
    } finally {
      setBusy(false);
    }
  }
  async function choose() {
    try {
      const p = await invoke<string | null>("choose_save");
      if (p) setPath(p);
    } catch (e) {
      setError(String(e));
    }
  }
  function select(r: Row) {
    if (mode === "Staff" || !cmp) {
      setProfile(r);
      setView("profile");
      return;
    }
    setSelected((s) =>
      s.includes(r.UID)
        ? s.filter((id) => id !== r.UID)
        : s.length < 6
          ? [...s, r.UID]
          : s,
    );
  }
  return (
    <div className="app">
      <aside>
        <div className="sidebar-brand">
          <img src={logo} alt="" />
          <strong>Foxy Scout</strong>
        </div>
        <Tabs
          options={["Players", "Staff"]}
          value={mode}
          label="Scouting workspace"
          onChange={(x) => {
            setMode(x);
            setSort(null);
          }}
        />
        <details open={!snapshot}>
          <summary>Save file</summary>
          <div className="details-content">
            {recent.length > 0 && (
              <Field label="Detected saves">
                <select
                  value={recent.includes(path) ? path : ""}
                  onChange={(e) => setPath(e.target.value)}
                >
                  <option value="" disabled>
                    Select a save
                  </option>
                  {recent.map((p) => (
                    <option key={p} value={p}>
                      {p.split("/").at(-1)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Full path to .fm file">
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/Users/you/…/save.fm"
              />
            </Field>
            <button onClick={choose} disabled={busy}>
              Choose .fm file…
            </button>
            <details>
              <summary>Custom folder</summary>
              <Field label="FM save folder path">
                <input
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="~/…/Football Manager 2024/games"
                />
              </Field>
              <button
                onClick={async () => {
                  try {
                    const s = await invoke<string[]>("list_saves", {
                      directory: folder,
                    });
                    setRecent(s);
                    if (s[0]) setPath(s[0]);
                    else setError("No .fm saves found in this folder.");
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Find saves
              </button>
            </details>
            <label className="check">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />{" "}
              Rebuild cached save
            </label>
            <button
              className="primary"
              disabled={busy || !path.trim()}
              onClick={load}
            >
              {busy ? "Loading…" : "Load FM24 save"}
            </button>
          </div>
        </details>
        {view === "list" && <SavedSearches key={mode} mode={mode === "Staff" ? "Staff" : "Players"} configuration={configuration}
          disabled={(mode === "Staff" ? sf : draft).columnRules.some(rule => !!ruleError(rule))} onLoad={restoreSearch} />}
        {view === "list" && mode === "Players" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.columnRules.some(ruleError)) return;
              setFilters(draft);
              setSort(null);
              setSelected([]);
            }}
          >
            <h2 className="sidebar-title">Filters</h2>
            <details open>
              <summary>Players</summary>
              <div className="details-content">
                <Field label="Search players">
                  <input
                    data-scout-search
                    type="search"
                    title="Find players · ⌘F / Ctrl+F"
                    placeholder="Search any column…"
                    value={draft.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                  />
                </Field>
                <Range
                  label="Player age"
                  value={draft.age}
                  onChange={(v) => setFilter("age", v)}
                  min={15}
                  max={40}
                />
                <Multi
                  label="Positions"
                  options={positions.filter((p) => p !== "SW")}
                  value={draft.positions}
                  onChange={(v) => setFilter("positions", v)}
                />
              </div>
            </details>
            <details>
              <summary>Ability</summary>
              <div className="details-content">
                {(["ca", "pa", "rating", "potential"] as const).map((k, i) => (
                  <Range
                    key={k}
                    label={
                      [
                        "Current ability / 200",
                        "Potential ability / 200",
                        "Current role rating / 100",
                        "Potential role rating / 100",
                      ][i]
                    }
                    value={draft[k]}
                    onChange={(v) => setFilter(k, v)}
                    min={i < 2 ? 1 : 0}
                    max={i < 2 ? 200 : 100}
                  />
                ))}
              </div>
            </details>
            <details>
              <summary>Market</summary>
              <div className="details-content">
                <Field label="Club">
                  <input
                    value={draft.club}
                    placeholder="Any club"
                    onChange={(e) => setFilter("club", e.target.value)}
                  />
                </Field>
                <Multi
                  label="Nationalities"
                  options={nations}
                  value={draft.nations}
                  onChange={(v) => setFilter("nations", v)}
                />
                <Field label="Filter price by">
                  <select
                    value={draft.basis}
                    onChange={(e) => setFilter("basis", e.target.value)}
                  >
                    <option value="MarketValue">Market Value</option>
                    <option value="SaleValue">Sale Value</option>
                  </select>
                </Field>
                <div className="pair">
                  {(["min", "max"] as const).map((k) => (
                    <Field
                      key={k}
                      label={`${k === "min" ? "Min" : "Max"} (${symbol}M)`}
                    >
                      <NumericInput
                        min={0}
                        fallback={defaults[k]}
                        value={draft[k]}
                        title="0 = unbounded"
                        onChange={(v) => setFilter(k, v)}
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Buying-club eligibility">
                  <select
                    value={draft.scenario}
                    onChange={(e) => setFilter("scenario", e.target.value)}
                  >
                    {scenarios.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Contract status">
                  <select
                    value={draft.contract}
                    onChange={(e) => setFilter("contract", e.target.value)}
                  >
                    {[
                      "All",
                      "Expired",
                      "Expiring in 6 months",
                      "Expiring in 12 months",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Listing status">
                  <select value={draft.listing} onChange={(e) => setFilter("listing", e.target.value)}>
                    <option value="All">All players</option>
                    <option value="Transfer">Transfer listed</option>
                    <option value="Loan">Loan listed</option>
                    <option value="Either">Transfer or loan listed</option>
                  </select>
                </Field>
              </div>
            </details>
            <Field label="Sort results by">
              <select
                value={draft.sort}
                onChange={(e) => setFilter("sort", e.target.value)}
              >
                {[
                  "CA",
                  "PA",
                  "Diff",
                  "RoleRtg",
                  "PotRtg",
                  "MarketValue",
                  "SaleValue",
                  "ValueDifference",
                  "Age",
                  "Name",
                  ...groups.Hidden,
                  ...groups.Technical,
                  ...groups.Mental,
                  ...groups.Physical,
                ].map((x) => (
                  <option value={x} key={x}>
                    {labels[x] || names[x] || x}
                  </option>
                ))}
              </select>
            </Field>
            <ColumnFilters columns={searchableColumns} rules={draft.columnRules} onChange={v => setFilter("columnRules", v)} currency={currency}/>
            <button className="primary" type="submit" disabled={draft.columnRules.some(rule => !!ruleError(rule))}>
              Apply filters
            </button>
            <p className="filter-state" role="status">{filtersPending ? "Changes ready to apply" : "Filters are up to date"}<span>Enter to apply</span></p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setDraft(defaults);
                setFilters(defaults);
                setSort(null);
              }}
            >
              Reset filters
            </button>
          </form>
        )}
        {view === "list" && mode === "Staff" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (sf.columnRules.some(ruleError)) return;
              setSfApplied(sf);
              setSort(null);
            }}
          >
            <h2 className="sidebar-title">Staff filters</h2>
            <Field label="Search staff">
              <input
                data-scout-search
                type="search"
                title="Find staff · ⌘F / Ctrl+F"
                value={sf.search}
                placeholder="Search any column…"
                onChange={(e) => setSf({ ...sf, search: e.target.value })}
              />
            </Field>
            <Range
              label="Staff age"
              min={18}
              max={100}
              fallback={[18, 80]}
              value={sf.age}
              onChange={(v) => setSf({ ...sf, age: v })}
            />
            <Multi
              label="Nationality"
              options={nations}
              value={sf.nations}
              onChange={(v) => setSf({ ...sf, nations: v })}
            />
            <Field label="Required staff attribute">
              <select
                value={sf.attr}
                onChange={(e) => setSf({ ...sf, attr: e.target.value })}
              >
                {Object.values(staffGroups)
                  .flat()
                  .map((x) => (
                    <option key={x}>{x}</option>
                  ))}
              </select>
            </Field>
            <Field label="Minimum attribute / 20">
              <NumericInput
                min={1}
                max={20}
                fallback={1}
                value={sf.min}
                onChange={(v) => setSf({ ...sf, min: v })}
              />
            </Field>
            <Field label="Sort staff by">
              <select
                value={sf.sort}
                onChange={(e) => setSf({ ...sf, sort: e.target.value })}
              >
                {[
                  "CA",
                  "PA",
                  "Name",
                  "Age",
                  ...Object.values(staffGroups).flat(),
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <ColumnFilters columns={searchableColumns} rules={sf.columnRules} onChange={v => setSf({ ...sf, columnRules: v })} currency={currency}/>
            <button className="primary" type="submit" disabled={sf.columnRules.some(rule => !!ruleError(rule))}>Apply staff filters</button>
            <p className="filter-state" role="status">{filtersPending ? "Changes ready to apply" : "Filters are up to date"}<span>Enter to apply</span></p>
            <button type="button" className="text-button" onClick={() => {
              const reset = { search: "", age: [18, 80] as [number, number], nations: [] as string[], attr: "Attacking", min: 1, sort: "CA", columnRules: [] as ColumnRule[] };
              setSf(reset); setSfApplied(reset); setSort(null);
            }}>Reset staff filters</button>
          </form>
        )}
      </aside>
      <main>
        <AppHeader onAbout={() => setView("about")} onQuit={() => invoke("quit_app").catch(e => setError(String(e)))} settings={
          <Preferences appearance={appearance} accent={accent} density={density} motion={motion} showRatingBars={showRatingBars} currency={currency} rate={rate}
            showKeybindBar={showKeybindBar} onShowKeybindBarChange={setShowKeybindBar} onShowShortcuts={() => setShortcutsOpen(true)}
            onAppearanceChange={setAppearance} onAccentChange={setAccent} onDensityChange={setDensity} onMotionChange={setMotion} onShowRatingBarsChange={setShowRatingBars}
            onCurrencyChange={setCurrency} onRateChange={setRate} onReset={() => {
              setAppearance("system"); setAccent("rust"); setDensity("comfortable"); setMotion("system"); setShowRatingBars(true); setShowKeybindBar(true); setCurrency("EUR"); setRate(1.1127);
            }} />
        }/>
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {busy && (
          <div className="loading" role="status">
            <progress />
            {notice}
          </div>
        )}
        {!busy && notice && (
          <p className="status" role="status">
            {notice}
          </p>
        )}
        {view === "about" ? (
          <section className="about">
            <button onClick={() => setView("list")}>
              ← Back to {mode.toLowerCase()}
            </button>
            <div className="about-hero">
              <img src={logo} alt=""/>
              <div><p className="eyebrow">YOUR LOCAL SCOUTING DESK</p><h1>About Foxy Scout</h1>
                <p>Find the right player. See the full picture.</p>
                <div className="about-tags"><span>Version 2.0</span><span>Football Manager 2024</span><span>Read-only saves</span></div>
              </div>
            </div>
            <p className="about-intro">Explore players and staff, compare attributes, and build a shortlist from your own FM24 save. Your save stays on your computer and is never modified.</p>
            {snapshot && (
              <Details
                items={[
                  ["Save date", snapshot.game_date],
                  ["Players", players.length.toLocaleString()],
                  ["Staff", staff.length.toLocaleString()],
                  [
                    "Average CA",
                    players.length
                      ? (
                          players.reduce((s, r) => s + r.CA, 0) / players.length
                        ).toFixed(0)
                      : "—",
                  ],
                  [
                    "Average PA",
                    players.length
                      ? (
                          players.reduce((s, r) => s + r.PA, 0) / players.length
                        ).toFixed(0)
                      : "—",
                  ],
                  ["Load time", (snapshot.elapsed_ms / 1000).toFixed(2) + "s"],
                ]}
              />
            )}
            <div className="about-grid"><section className="about-card">
            <h3>What comes from your save</h3>
            <p>
              CA, PA, attributes and position familiarity are extracted from the
              save. Player scouting uses confirmed ages 15–40. Staff has
              separate coaching, scouting, mental and medical sheets. Staff
              employers, job titles and contracts are not decoded.
            </p>
            <p className="muted">Transfer and loan badges come from contract flags. Their FM24 labels are awaiting independent in-game confirmation.</p>
            </section><section className="about-card"><h3>Understand the estimates</h3><p>
              Market Value estimates financial worth from ability, age,
              contracts and the save’s wage economy. Sale Value estimates an
              asking price from contract leverage and youth headroom. Applicable
              verified release clauses cap Sale Value. Unresolved clause
              conditions do not cap estimates. Values and role projections are
              estimates, not guaranteed offers or Football Manager’s own
              calculated values.
            </p>
            </section><section className="about-card"><h3>Build a better search</h3>
            <ol>
              <li>Choose an FM24 .fm save and load it.</li>
              <li>
                Search across columns, or add column conditions for specific attributes, prices, dates, or listing statuses. Every condition must match.
              </li>
              <li>
                Turn on Compare, select 2–6 players, and open the comparison.
              </li>
            </ol>
            </section><section className="about-card"><h3>Made for your desktop</h3>
            <p>
              Parsed data and ratings are cached locally. Changed saves rebuild
              on the next load. Select Rebuild cached save to parse again.
              Currency settings convert the display and exports; stored amounts
              remain USD.
            </p>
            <p>Open Settings at the top right to change currency or theme. More app actions contains Quit.</p>
            </section></div>
            <p className="muted">
              Unofficial fan-made tool, not affiliated with Sports Interactive
              or SEGA. Football Manager is a trademark of Sports Interactive
              Ltd.
            </p>
          </section>
        ) : !snapshot ? (
          <div className="welcome">
            <img src={logo} alt="Foxy Scout fox" />
            <h1>Your next signing starts here.</h1>
            <p>Choose a Football Manager 2024 save to start scouting.</p>
            <button onClick={choose}>Choose .fm file…</button>
          </div>
        ) : view === "profile" && profile ? (
          <>
            <button className="back" onClick={() => setView("list")}>
              ← Back to {mode === "Staff" ? "Staff" : "Player"} List
            </button>
            <Report
              row={profile}
              staff={mode === "Staff"}
              factor={factor}
              symbol={symbol}
            />
          </>
        ) : view === "compare" ? (
          <>
            <button className="back" onClick={() => setView("list")}>
              ← Back to Player List
            </button>
            <Comparison
              rows={filtered.filter((r) => selected.includes(r.UID))}
              factor={factor}
              symbol={symbol}
            />
          </>
        ) : (
          <>
            <div className="page-heading">
              <h1>{mode === "Staff" ? "Staff" : "Player"} scouting</h1>
              <span className="badge">
                FM24 ·{" "}
                {new Date(snapshot.game_date + "T12:00:00").toLocaleDateString(
                  "en-GB",
                  { day: "2-digit", month: "short", year: "numeric" },
                )}
              </span>
            </div>
            <p className="muted file-name">{loadedPath.split("/").at(-1)}</p>
            {mode === "Staff" && (
              <div className="staff-summary">
                <span>
                  <strong>{rows.length.toLocaleString()}</strong> staff found
                </span>
                {["Coaching", "Scouting", "Medical"].map((g) => (
                  <span key={g}>
                    {g} average{" "}
                    <strong>
                      {rows.length
                        ? (
                            rows.reduce(
                              (s, r) =>
                                s +
                                staffGroups[g].reduce((a, k) => a + r[k], 0) /
                                  staffGroups[g].length,
                              0,
                            ) / rows.length
                          ).toFixed(1)
                        : "—"}
                    </strong>
                  </span>
                ))}
              </div>
            )}
            <div className="toolbar">
              {mode === "Players" ? (
                <>
                  <Field label="Table view">
                    <select value={group} onChange={(e) => setGroup(e.target.value)}>
                      {["Overview", "Hidden", "Personality", "Technical", "Mental", "Physical", "Goalkeeping", "All attributes"].map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </Field>
                  <label className="check">
                    <input type="checkbox" checked={cmp} onChange={(e) => { setCmp(e.target.checked); setSelected([]); }} />
                    Compare
                  </label>
                </>
              ) : (
                <Tabs label="Staff table" options={["Overview", ...Object.keys(staffGroups)]} value={staffGroup} onChange={setStaffGroup} />
              )}
              <button onClick={() => setExportOpen(true)} disabled={!rows.length}>
                Export CSV
              </button>
            </div>
            {cmp && mode === "Players" && (
              <div className="compare-controls">
                <span>{selected.length} of 6 players selected</span>
                <button
                  disabled={selected.length < 2}
                  onClick={() => setView("compare")}
                >
                  Compare selected
                </button>
                <button className="text-button" onClick={() => setSelected([])}>
                  Clear selection
                </button>
              </div>
            )}
            <>
                <div className="results-controls">
                  <span className="result-count" aria-live="polite">
                    <strong>{rows.length.toLocaleString()}</strong> {mode.toLowerCase()}
                    <span className="result-context">of {(mode === "Staff" ? staff : players).length.toLocaleString()} loaded</span>
                    {filtersPending && <span className="pending-label">Unapplied changes</span>}
                  </span>
                  {mode === "Players" && group === "Overview" && (
                    <ColumnPicker available={[...new Set([...extras, ...searchableColumns.map(c => c.key)])].filter(c => c !== "Name")} value={columns} defaults={overview} onChange={setColumns} />
                  )}
                </div>
                <DataTable
                  rows={rows}
                  density={density}
                  staff={mode === "Staff"}
                  columns={shown}
                  onSelect={select}
                  selected={selected}
                  compareMode={mode === "Players" && cmp}
                  factor={factor}
                  symbol={symbol}
                  sort={sort}
                  onSort={setSort}
                />
            </>
          </>
        )}
      </main>
      {showKeybindBar && snapshot && view !== "about" && <KeybindBar profile={view !== "list"}
        onSearch={focusSearch} onApply={() => document.querySelector<HTMLFormElement>('aside form')?.requestSubmit()} onResults={focusResults} onSave={saveSearch} onHelp={() => setShortcutsOpen(true)}
        onBack={() => setView("list")} onPrevious={() => browseProfile(-1)} onNext={() => browseProfile(1)}
        hasPrevious={view === "profile" && profileIndex > 0} hasNext={view === "profile" && profileIndex >= 0 && profileIndex < rows.length - 1} />}
      {shortcutsOpen && <ShortcutGuide columns={shown} onClose={() => setShortcutsOpen(false)} />}
      {exportOpen && (
        <ExportDialog
          rows={rows} columns={shown} mode={mode}
          factor={factor} symbol={symbol} currency={currency}
          onClose={() => setExportOpen(false)} onExport={setNotice}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
