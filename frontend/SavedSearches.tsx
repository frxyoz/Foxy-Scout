import { useEffect, useId, useState } from "react";
import { ColumnRule, Filters } from "./data";
import "./savedSearches.css";

export type StaffFilters = {
  search: string; age: [number, number]; nations: string[];
  attr: string; min: number; sort: string; columnRules: ColumnRule[];
};
type SearchSort = { key: string; asc: boolean } | null;
export type SearchConfiguration =
  | { mode: "Players"; filters: Filters; sort: SearchSort; group: string; columns: string[]; currency: string; rate: number }
  | { mode: "Staff"; filters: StaffFilters; sort: SearchSort; group: string; currency: string; rate: number };
export interface SavedSearchesProps {
  mode: "Players" | "Staff";
  configuration: SearchConfiguration;
  disabled: boolean;
  onLoad: (configuration: SearchConfiguration) => void;
}
type Entry = { id: string; name: string; configuration: SearchConfiguration };
const storageKey = "foxy-saved-searches-v1";
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.length <= 1000;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1000 && value.every(isText);
const isRange = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every(isNumber) && value[0] <= value[1];

// Copy only configuration fields, even when local storage contains unrelated data.
function parseConfiguration(value: unknown): SearchConfiguration | null {
  if (!isObject(value) || !isObject(value.filters)) return null;
  const f = value.filters;
  if ((value.mode !== "Players" && value.mode !== "Staff") || !isText(value.group)
    || !["EUR", "USD"].includes(String(value.currency)) || !isNumber(value.rate) || value.rate <= 0 || value.rate > 10000) return null;
  if (value.sort !== null && (!isObject(value.sort) || !isText(value.sort.key) || typeof value.sort.asc !== "boolean")) return null;
  if (!isText(f.search) || !isText(f.sort) || !isRange(f.age) || !isTexts(f.nations) || !isNumber(f.min)
    || !Array.isArray(f.columnRules) || f.columnRules.length > 200 || !f.columnRules.every(rule => isObject(rule)
      && isText(rule.column) && isText(rule.operator) && isText(rule.value))) return null;
  const shared = {
    search: f.search, sort: f.sort, age: [...f.age] as [number, number], nations: [...f.nations], min: f.min,
    columnRules: f.columnRules.map(rule => ({ column: rule.column, operator: rule.operator, value: rule.value })) as ColumnRule[],
  };
  const common = { group: value.group, currency: String(value.currency), rate: value.rate,
    sort: value.sort === null ? null : { key: value.sort.key as string, asc: value.sort.asc as boolean } };
  if (value.mode === "Staff") {
    if (!isText(f.attr)) return null;
    return { ...common, mode: "Staff", filters: { ...shared, attr: f.attr } };
  }
  if (!isText(f.club) || !isRange(f.ca) || !isRange(f.pa) || !isRange(f.rating) || !isRange(f.potential)
    || !isTexts(f.positions) || !isNumber(f.max) || !isText(f.basis) || !isText(f.scenario)
    || !isText(f.contract) || !isText(f.listing) || !isTexts(value.columns)) return null;
  return { ...common, mode: "Players", columns: [...value.columns], filters: {
    ...shared, club: f.club, ca: [...f.ca], pa: [...f.pa], rating: [...f.rating], potential: [...f.potential],
    positions: [...f.positions], max: f.max, basis: f.basis, scenario: f.scenario, contract: f.contract, listing: f.listing,
  } };
}

function readEntries(): { entries: Entry[]; message: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { entries: [], message: "" };
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error("Invalid saved searches");
    const entries: Entry[] = [];
    for (const item of value) {
      if (!isObject(item) || !isText(item.id) || !item.id || !isText(item.name) || !item.name.trim() || item.name.trim().length > 80) continue;
      const configuration = parseConfiguration(item.configuration);
      if (!configuration || entries.some(entry => entry.id === item.id || (entry.configuration.mode === configuration.mode && entry.name.toLowerCase() === String(item.name).trim().toLowerCase()))) continue;
      entries.push({ id: item.id, name: item.name.trim(), configuration });
    }
    return { entries, message: entries.length < value.length ? "Some unreadable saved searches were skipped." : "" };
  } catch {
    return { entries: [], message: "Saved searches could not be read. Saving a new search will replace unreadable saved searches." };
  }
}

export function SavedSearches({ mode, configuration, disabled, onLoad }: SavedSearchesProps) {
  const id = useId();
  const [initial] = useState(readEntries);
  const [entries, setEntries] = useState(initial.entries);
  const [message, setMessage] = useState(initial.message);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const options = entries.filter(entry => entry.configuration.mode === mode);
  const selected = options.find(entry => entry.id === selectedId);
  useEffect(() => { setName(""); setSelectedId(""); }, [mode]);

  function persist(next: Entry[], notice: string): boolean {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setEntries(next); setMessage(notice); return true;
    } catch {
      setMessage("Could not save changes. Local storage may be full or unavailable."); return false;
    }
  }
  function validName(exceptId?: string): string | null {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) { setMessage("Enter a search name with 1–80 characters."); return null; }
    if (options.some(entry => entry.id !== exceptId && entry.name.toLowerCase() === trimmed.toLowerCase())) {
      setMessage("That name is already saved. Choose another name or update the existing search."); return null;
    }
    return trimmed;
  }
  function currentConfiguration(): SearchConfiguration | null {
    const parsed = parseConfiguration(configuration);
    if (disabled || !parsed || parsed.mode !== mode) { setMessage("Correct the current filters before saving this search."); return null; }
    return structuredClone(parsed);
  }
  function save() {
    const nextName = validName();
    if (!nextName) return;
    const config = currentConfiguration();
    if (!config) return;
    const entry: Entry = { id: crypto.randomUUID(), name: nextName, configuration: config };
    if (persist([...entries, entry], `Saved “${nextName}”.`)) { setSelectedId(entry.id); setName(nextName); }
  }

  return <details className="saved-searches">
    <summary>Saved searches{options.length > 0 ? ` (${options.length})` : ""}</summary>
    <div className="saved-searches-content">
      <p className="filter-hint">Save filters, sorting, columns and currency for this view.</p>
      <label htmlFor={`${id}-name`}>Search name</label>
      <div className="saved-search-name">
        <input id={`${id}-name`} type="text" maxLength={80} value={name} placeholder="e.g. Young prospects"
          onChange={event => setName(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); if (!disabled) save(); }
          }} />
        <button type="button" disabled={disabled || !name.trim()} onClick={save}>Save search</button>
      </div>
      {options.length > 0 && <>
        <label htmlFor={`${id}-saved`}>Saved searches</label>
        <select id={`${id}-saved`} value={selected?.id || ""} onChange={event => {
          const entry = options.find(entry => entry.id === event.target.value);
          setSelectedId(entry?.id || ""); setName(entry?.name || ""); setMessage("");
        }}><option value="">Choose a search…</option>{options.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
        <div className="saved-search-actions">
          <button type="button" disabled={!selected} onClick={() => {
            if (selected) { onLoad(structuredClone(selected.configuration)); setMessage(`Loaded “${selected.name}”.`); }
          }}>Load search</button>
          <button type="button" disabled={!selected || disabled} title="Replace saved filters with the current view" onClick={() => {
            if (!selected) return;
            const config = currentConfiguration();
            if (config) persist(entries.map(entry => entry.id === selected.id ? { ...entry, configuration: config } : entry), `Updated “${selected.name}”.`);
          }}>Update search</button>
          <button type="button" disabled={!selected || !name.trim() || name.trim() === selected.name} onClick={() => {
            if (!selected) return;
            const nextName = validName(selected.id);
            if (nextName && persist(entries.map(entry => entry.id === selected.id ? { ...entry, name: nextName } : entry), `Renamed to “${nextName}”.`)) setName(nextName);
          }}>Rename search</button>
          <button type="button" disabled={!selected} onClick={() => {
            if (selected && persist(entries.filter(entry => entry.id !== selected.id), `Deleted “${selected.name}”.`)) { setSelectedId(""); setName(""); }
          }}>Delete search</button>
        </div>
      </>}
      {disabled && <p className="filter-hint">Complete the current filters to save or update a search.</p>}
      <p className="saved-search-status" role="status">{message}</p>
    </div>
  </details>;
}
