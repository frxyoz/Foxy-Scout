import { useEffect, useId, useState } from "react";
import "./preferences.css";
import { shortcutGroups } from "./KeyboardShortcuts";

export type Appearance = "system" | "light" | "dark";
export type Accent = "rust" | "blue" | "green" | "purple" | "red" | "slate";
export type Motion = "system" | "reduced";
export type Density = "comfortable" | "compact";

export interface PreferencesProps {
  appearance: Appearance;
  accent: Accent;
  motion: Motion;
  density: Density;
  showRatingBars: boolean;
  currency: string;
  rate: number;
  onAppearanceChange: (value: Appearance) => void;
  onAccentChange: (value: Accent) => void;
  onMotionChange: (value: Motion) => void;
  onDensityChange: (value: Density) => void;
  onShowRatingBarsChange: (value: boolean) => void;
  onCurrencyChange: (value: string) => void;
  onRateChange: (value: number) => void;
  onReset: () => void;
  showKeybindBar: boolean;
  onShowKeybindBarChange: (value: boolean) => void;
  onShowShortcuts: () => void;
}

const accents: { value: Accent; label: string }[] = [
  { value: "rust", label: "Rust" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "purple", label: "Purple" },
  { value: "red", label: "Red" },
  { value: "slate", label: "Slate" },
];

export function Preferences(props: PreferencesProps) {
  const id = useId();
  const [rateDraft, setRateDraft] = useState(String(props.rate));
  const [rateNotice, setRateNotice] = useState("");
  useEffect(() => { setRateDraft(String(props.rate)); setRateNotice(""); }, [props.rate]);

  function commitRate() {
    const value = Number(rateDraft);
    if (rateDraft.trim() && Number.isFinite(value) && value > 0 && value <= 10000) {
      props.onRateChange(value);
      setRateDraft(String(value));
      setRateNotice("");
    } else {
      setRateDraft(String(props.rate));
      setRateNotice("Enter a rate greater than 0 and at most 10,000. Previous rate restored.");
    }
  }

  return <div className="preferences">
    <fieldset className="preference-section">
      <legend>Appearance</legend>
      <label className="preference-row">Appearance
        <select aria-label="Appearance" value={props.appearance} onChange={(event) => props.onAppearanceChange(event.target.value as Appearance)}>
          <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </label>
      <div className="preference-colors" role="group" aria-label="Accent color">
        {accents.map(({ value, label }) => <button key={value} type="button"
          className="preference-swatch" data-color={value} aria-label={label}
          aria-pressed={props.accent === value} title={label}
          onClick={() => props.onAccentChange(value)}>
          <span className="preference-swatch-dot" aria-hidden="true">{props.accent === value && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg>}</span>
          <span>{label}</span>
        </button>)}
      </div>
      <label className="preference-row">Motion
        <select aria-label="Motion" value={props.motion} onChange={(event) => props.onMotionChange(event.target.value as Motion)}>
          <option value="system">System</option><option value="reduced">Reduced</option>
        </select>
      </label>
    </fieldset>
    <fieldset className="preference-section">
      <legend>Tables</legend>
      <label className="preference-row">Table density
        <select aria-label="Table density" value={props.density} onChange={(event) => props.onDensityChange(event.target.value as Density)}>
          <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
        </select>
      </label>
      <label className="preference-check"><input type="checkbox" checked={props.showRatingBars}
        onChange={(event) => props.onShowRatingBarsChange(event.target.checked)} />Show rating bars</label>
    </fieldset>
    <fieldset className="preference-section">
      <legend>Currency</legend>
      <label className="preference-row">Currency
        <select aria-label="Currency" value={props.currency} onChange={(event) => props.onCurrencyChange(event.target.value)}>
          <option value="EUR">EUR · Euro</option><option value="USD">USD · US dollar</option>
        </select>
      </label>
      <label className="preference-row">USD per €1
        <input type="text" inputMode="decimal" value={rateDraft} aria-describedby={`${id}-rate-hint ${id}-rate-notice`}
          onChange={(event) => { setRateDraft(event.target.value); setRateNotice(""); }} onBlur={commitRate}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          }} />
      </label>
      <p className="preference-hint" id={`${id}-rate-hint`}>Manual exchange rate. Applies to display, filters and exports.</p>
      <span className="preference-notice" id={`${id}-rate-notice`} role="status">{rateNotice}</span>
    </fieldset>
    <details className="preference-shortcuts">
      <summary>Keyboard shortcuts</summary>
      <label className="preference-check"><input type="checkbox" checked={props.showKeybindBar} onChange={event => props.onShowKeybindBarChange(event.target.checked)} />Show keybind bar</label>
      <dl>{shortcutGroups[0].entries.slice(0, 4).map(([keys, description]) => <div key={keys}><dt>{description}</dt><dd><kbd>{keys}</kbd></dd></div>)}</dl>
      <button type="button" className="text-button" onClick={props.onShowShortcuts}>All keyboard shortcuts</button>
    </details>
    <button className="preference-reset" type="button" onClick={() => {
      setRateDraft(String(props.rate)); setRateNotice(""); props.onReset();
    }}>Reset preferences</button>
  </div>;
}
