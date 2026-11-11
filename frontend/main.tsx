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
} from "./data";
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
  return (
    <Field label={label}>
      <select
        multiple
        value={value}
        onChange={(e) =>
          onChange(Array.from(e.target.selectedOptions, (o) => o.value))
        }
        size={Math.min(5, Math.max(2, options.length))}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <button
        className="text-button"
        type="button"
        onClick={() => onChange([])}
      >
        Clear selection
      </button>
    </Field>
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
}: {
  staff: boolean;
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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTop(0);
    if (ref.current) ref.current.scrollTop = 0;
  }, [rows, columns.join(",")]);
  const start = Math.max(0, Math.floor(top / 34) - 8),
    end = Math.min(rows.length, start + 42);
  return (
    <div
      className="table-scroll"
      ref={ref}
      onScroll={(e) => setTop(e.currentTarget.scrollTop)}
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
            {columns.map((k) => (
              <th key={k}>
                <button
                  title={names[k] || labels[k] || k}
                  onClick={() =>
                    onSort({
                      key: k,
                      asc: sort?.key === k ? !sort.asc : k === "Name",
                    })
                  }
                >
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
                style={{ height: start * 34, padding: 0, border: 0 }}
              />
            </tr>
          )}
          {rows.slice(start, end).map((r, i) => (
            <tr
              key={r.UID ?? start + i}
              tabIndex={0}
              className={selected.includes(r.UID) ? "selected" : ""}
              onClick={() => onSelect(r)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
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
                    {isMoney(k) ? (
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
                  height: (rows.length - end) * 34,
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
}: {
  row: Row;
  keys: string[];
  title: string;
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
                row[k] >= 16 && !["Dirt", "InjP", "Contr"].includes(k)
                  ? "strong"
                  : ""
              }
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
              <Attributes row={row} keys={groups.Technical} title="Technical" />
              <Attributes row={row} keys={groups.Mental} title="Mental" />
              <div>
                <Attributes row={row} keys={groups.Physical} title="Physical" />
                <Attributes
                  row={row}
                  keys={groups.Hidden}
                  title="Hidden & feet"
                />
              </div>
              <Attributes
                row={row}
                keys={groups.Goalkeeping}
                title="Goalkeeping"
              />
              <Attributes
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
    [columns, setColumns] = useSaved<string[]>("foxy-columns-v2", (() => {
      const previous = saved<string[]>("foxy-columns", overview);
      return previous.includes("ValueDifference") ? previous : [...previous, "ValueDifference"];
    })()),
    [currency, setCurrency] = useSaved("foxy-currency", "EUR"),
    [rate, setRate] = useSaved("foxy-rate", 1.1127),
    [night, setNight] = useSaved("foxy-night", false),
    [sf, setSf] = useState({
      search: "",
      age: [18, 80] as [number, number],
      nations: [] as string[],
      attr: "Attacking",
      min: 1,
      sort: "CA",
    }),
    [sfApplied, setSfApplied] = useState(sf);
  const view = views[mode],
    profile = profiles[mode];
  const setView = (value: string) => setViews((v) => ({ ...v, [mode]: value }));
  const setProfile = (value: Row | null) =>
    setProfiles((v) => ({ ...v, [mode]: value }));
  const factor = currency === "EUR" ? 1 / rate : 1,
    symbol = currency === "EUR" ? "€" : "$";
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "light";
  }, [night]);
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
            (!sfApplied.search.trim() ||
              String(r.Name)
                .toLowerCase()
                .includes(sfApplied.search.trim().toLowerCase()) ||
              String(r.UID).includes(sfApplied.search.trim())),
        )
        .sort((a, b) =>
          compare(
            a[sfApplied.sort],
            b[sfApplied.sort],
            ["Name", "Age"].includes(sfApplied.sort),
          ),
        ),
    [staff, sfApplied],
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
            ...(group === "All attributes"
              ? Object.values(groups).flat()
              : [
                  ...(group === "Personality" ? ["Personality"] : []),
                  ...groups[group],
                ]),
          ];
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
        {view === "list" && mode === "Players" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFilters(draft);
              setSort(null);
              setSelected([]);
            }}
          >
            <h2 className="sidebar-title">Filters</h2>
            <details open>
              <summary>Players</summary>
              <div className="details-content">
                <Field label="Player or UID">
                  <input
                    placeholder="Search a player…"
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
            <button className="primary" type="submit">
              Apply filters
            </button>
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
              setSfApplied(sf);
              setSort(null);
            }}
          >
            <h2 className="sidebar-title">Staff filters</h2>
            <Field label="Staff name or UID">
              <input
                value={sf.search}
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
            <button className="primary">Apply staff filters</button>
          </form>
        )}
        <details className="settings">
          <summary>Settings</summary>
          <div className="details-content">
            <Field label="Currency">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="EUR">Euro (€)</option>
                <option value="USD">US dollar ($)</option>
              </select>
            </Field>
            <Field label="USD per €1">
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={rate}
                onChange={(e) => {
                  if (+e.target.value > 0) setRate(+e.target.value);
                }}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={night}
                onChange={(e) => setNight(e.target.checked)}
              />{" "}
              Night theme
            </label>
          </div>
        </details>
      </aside>
      <main>
        <header>
          <span>Football Manager 2024</span>
          <div>
            <button
              onClick={() => setView(view === "about" ? "list" : "about")}
            >
              About
            </button>
            <button
              onClick={() =>
                invoke("quit_app").catch((e) => setError(String(e)))
              }
            >
              Quit
            </button>
          </div>
        </header>
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
            <h2>About Foxy Scout</h2>
            <p>
              A local scouting companion for Football Manager 2024. Save files
              are read on your computer and never modified.
            </p>
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
            <h3>Data and estimates</h3>
            <p>
              CA, PA, attributes and position familiarity are extracted from the
              save. Player scouting uses confirmed ages 15–40. Staff has
              separate coaching, scouting, mental and medical sheets. Staff
              employers, job titles and contracts are not decoded.
            </p>
            <p>
              Market Value estimates financial worth from ability, age,
              contracts and the save’s wage economy. Sale Value estimates an
              asking price from contract leverage and youth headroom. Applicable
              verified release clauses cap Sale Value. Unresolved clause
              conditions do not cap estimates. Values and role projections are
              estimates, not guaranteed offers or Football Manager’s own
              calculated values.
            </p>
            <h3>How to use</h3>
            <ol>
              <li>Choose an FM24 .fm save and load it.</li>
              <li>
                Apply filters and choose a table view. Select a player to open
                the full report.
              </li>
              <li>
                Turn on Compare, select 2–6 players, and open the comparison.
              </li>
            </ol>
            <p>
              Parsed data and ratings are cached locally. Changed saves rebuild
              on the next load. Select Rebuild cached save to parse again.
              Currency settings convert the display and exports; stored amounts
              remain USD.
            </p>
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
                  <span>
                    {rows.length.toLocaleString()} {mode.toLowerCase()}
                  </span>
                  {mode === "Players" && group === "Overview" && (
                    <details className="column-picker">
                      <summary>Customize columns</summary>
                      <div>
                        {extras.map((c) => (
                          <label className="check" key={c}>
                            <input
                              type="checkbox"
                              checked={columns.includes(c)}
                              onChange={(e) =>
                                setColumns(
                                  e.target.checked
                                    ? [...columns, c]
                                    : columns.filter((k) => k !== c),
                                )
                              }
                            />
                            {labels[c] || c}
                          </label>
                        ))}
                        <button onClick={() => setColumns(overview)}>
                          Restore default
                        </button>
                      </div>
                    </details>
                  )}
                </div>
                <DataTable
                  rows={rows}
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
