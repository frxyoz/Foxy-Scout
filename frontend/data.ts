export type Row = Record<string, any>;
export const groups: Record<string, string[]> = {
  Technical: [
    "Cor",
    "Cro",
    "Dri",
    "Fin",
    "FT",
    "FK",
    "Hea",
    "LS",
    "LT",
    "Mar",
    "Pas",
    "PT",
    "Tac",
    "Tec",
  ],
  Mental: [
    "Agg",
    "Ant",
    "Bra",
    "Com",
    "Con",
    "Dec",
    "Det",
    "Fla",
    "Lea",
    "OTB",
    "Pos",
    "TW",
    "Vis",
    "WR",
  ],
  Physical: ["Acc", "Agi", "Bal", "JR", "NF", "Pac", "Sta", "Str"],
  Hidden: ["Consis", "Dirt", "ImpM", "InjP", "Vers", "LF", "RF"],
  Personality: [
    "Adapt",
    "Ambi",
    "Loyal",
    "Press",
    "Prof",
    "Sport",
    "Contr",
    "Tempr",
  ],
  Goalkeeping: [
    "1v1",
    "AA",
    "CoA",
    "Comm",
    "Ecc",
    "Han",
    "Kic",
    "Ref",
    "RO",
    "TTP",
    "Thr",
  ],
};
export const staffGroups: Record<string, string[]> = {
  Coaching: [
    "Attacking",
    "Defending",
    "Fitness",
    "GK Shot Stopping",
    "GK Handling",
    "GK Distribution",
    "Mental",
    "Tactical",
    "Technical",
    "Set Pieces",
  ],
  Scouting: [
    "Judging Player Ability",
    "Judging Player Potential",
    "Analysing Data",
    "Judging Staff Ability",
    "Negotiating",
  ],
  Medical: ["Physiotherapy", "Sports Science"],
  Mental: [
    "Level of Discipline",
    "Man Management",
    "Motivating",
    "Working With Youngsters",
    "Determination",
    "Tactical Knowledge",
  ],
};
export const names: Record<string, string> = {
  Cor: "Corners",
  Cro: "Crossing",
  Dri: "Dribbling",
  Fin: "Finishing",
  FT: "First Touch",
  FK: "Free Kicks",
  Hea: "Heading",
  LS: "Long Shots",
  LT: "Long Throws",
  Mar: "Marking",
  Pas: "Passing",
  PT: "Penalty Taking",
  Tac: "Tackling",
  Tec: "Technique",
  Agg: "Aggression",
  Ant: "Anticipation",
  Bra: "Bravery",
  Com: "Composure",
  Con: "Concentration",
  Dec: "Decisions",
  Det: "Determination",
  Fla: "Flair",
  Lea: "Leadership",
  OTB: "Off The Ball",
  Pos: "Positioning",
  TW: "Teamwork",
  Vis: "Vision",
  WR: "Work Rate",
  Acc: "Acceleration",
  Agi: "Agility",
  Bal: "Balance",
  JR: "Jumping Reach",
  NF: "Natural Fitness",
  Pac: "Pace",
  Sta: "Stamina",
  Str: "Strength",
  "1v1": "One on Ones",
  AA: "Aerial Reach",
  CoA: "Command of Area",
  Comm: "Communication",
  Ecc: "Eccentricity",
  Han: "Handling",
  Kic: "Kicking",
  Ref: "Reflexes",
  RO: "Rushing Out",
  TTP: "Tendency to Punch",
  Thr: "Throwing",
  Consis: "Consistency",
  Dirt: "Dirtiness",
  ImpM: "Important Matches",
  InjP: "Injury Proneness",
  Vers: "Versatility",
  LF: "Left Foot",
  RF: "Right Foot",
  Adapt: "Adaptability",
  Ambi: "Ambition",
  Loyal: "Loyalty",
  Press: "Pressure",
  Prof: "Professionalism",
  Sport: "Sportsmanship",
  Contr: "Controversy",
  Tempr: "Temperament",
};
export const labels: Record<string, string> = {
  Name: "Player",
  BestPos: "Position",
  Diff: "PA − CA",
  RoleRtg: "Role /100",
  PotRtg: "Potential /100",
  PotRole: "Potential role",
  MarketValue: "Market Value",
  SaleValue: "Sale Value",
  ValueDifference: "Market − Sale",
  TransferListed: "Transfer listed",
  LoanListed: "Loan listed",
  ReleaseClause: "Release cap",
  SaleValueBasis: "Sale basis",
  Wage: "Annual wage",
  Rep: "Reputation",
};
export const positions = [
  "GK",
  "SW",
  "DL",
  "DC",
  "DR",
  "DM",
  "ML",
  "MC",
  "MR",
  "AML",
  "AMC",
  "AMR",
  "ST",
  "WBL",
  "WBR",
];
export const scenarios = [
  "Any club",
  "Foreign clubs",
  "Domestic clubs",
  "Domestic higher division",
];
export const suffixes = ["", "Foreign", "Domestic", "Higher"];
export const overview = [
  "Club",
  "Age",
  "CA",
  "PA",
  "Diff",
  "BestPos",
  "MarketValue",
  "SaleValue",
  "ValueDifference",
];
export const extras = [
  "Club",
  "Nation",
  "Age",
  "CA",
  "PA",
  "Diff",
  "Rep",
  "BestPos",
  "Role",
  "RoleRtg",
  "PotRole",
  "PotRtg",
  "MarketValue",
  "SaleValue",
  "ValueDifference",
  "ReleaseClause",
  "TransferListed",
  "LoanListed",
  "SaleValueBasis",
  "Contract",
  "Wage",
  "Personality",
  "UID",
  "Height",
  "Weight",
  "Foot",
];
export const isMoney = (k: string) =>
  k === "ValueDifference" ||
  k === "Wage" ||
  (/^(MarketValue|SaleValue|ReleaseClause)/.test(k) &&
    !k.includes("Basis") &&
    k !== "ReleaseClauses");
export type Filters = {
  search: string;
  club: string;
  age: [number, number];
  ca: [number, number];
  pa: [number, number];
  rating: [number, number];
  potential: [number, number];
  positions: string[];
  nations: string[];
  min: number;
  max: number;
  basis: string;
  scenario: string;
  contract: string;
  listing: string;
  columnRules: ColumnRule[];
  sort: string;
};
export const defaults: Filters = {
  search: "",
  club: "",
  age: [15, 40],
  ca: [1, 200],
  pa: [1, 200],
  rating: [0, 100],
  potential: [0, 100],
  positions: [],
  nations: [],
  min: 0,
  max: 0,
  basis: "MarketValue",
  scenario: "Any club",
  contract: "All",
  listing: "All",
  columnRules: [],
  sort: "CA",
};
export function scenarioRows(rows: Row[], scenario: string): Row[] {
  const s = suffixes[scenarios.indexOf(scenario)] || "";
  const adjusted: Row[] = s
    ? rows.map((r) => ({
        ...r,
        SaleValue: r["SaleValue" + s],
        SaleValueBasis: r["SaleValueBasis" + s],
        ReleaseClause: r["ReleaseClause" + s],
        ClauseScenario: scenario,
      }))
    : rows;
  return adjusted.map((r) => ({
    ...r,
    ValueDifference: r.MarketValue == null || r.SaleValue == null
      ? null : r.MarketValue - r.SaleValue,
  }));
}
export function contractDate(v: any): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v));
  if (!m) return null;
  const d = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return Number.isFinite(d) ? d : null;
}
export function filterPlayers(
  rows: Row[],
  f: Filters,
  date: string,
  factor: number,
): Row[] {
  const between = (x: number, r: number[]) => x >= r[0] && x <= r[1];
  const day = Date.parse(date);
  return scenarioRows(rows, f.scenario)
    .filter((r) => {
      if (!matchesSearch(r, f.search, factor) || !matchesColumnRules(r, f.columnRules, factor)) return false;
      if (f.listing === "Transfer" && r.TransferListed !== true) return false;
      if (f.listing === "Loan" && r.LoanListed !== true) return false;
      if (f.listing === "Either" && r.TransferListed !== true && r.LoanListed !== true) return false;
      if (
        !between(r.Age, f.age) ||
        !between(r.CA, f.ca) ||
        !between(r.PA, f.pa) ||
        !between(r.RoleRtg ?? 0, f.rating) ||
        !between(r.PotRtg ?? 0, f.potential)
      )
        return false;
      if (
        f.club &&
        !String(r.Club).toLowerCase().includes(f.club.toLowerCase())
      )
        return false;
      if (f.nations.length && !f.nations.includes(r.Nation)) return false;
      if (f.positions.length && !f.positions.some((p) => r["Pos_" + p] >= 10))
        return false;
      const price = r[f.basis];
      if (f.min && (price == null || price < (f.min * 1e6) / factor))
        return false;
      if (f.max && (price == null || price > (f.max * 1e6) / factor))
        return false;
      if (f.contract !== "All") {
        const end = contractDate(r.Contract);
        if (end == null) return false;
        if (f.contract === "Expired") {
          if (end >= day) return false;
        } else if (
          end < day ||
          end > day + (f.contract.includes("6") ? 183 : 365) * 86400000
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => compare(a[f.sort], b[f.sort], f.sort === "Name"));
}
export function compare(a: any, b: any, asc: boolean): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  const n =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b));
  return asc ? n : -n;
}
export function currencyRow(r: Row, factor: number, symbol: string): Row {
  return Object.fromEntries(
    Object.entries(r)
      .filter(
        ([k, v]) =>
          (/^[A-Z]/.test(k) || k === "1v1") &&
          (typeof v !== "object" || v === null),
      )
      .map(([k, v]) => [
        k,
        isMoney(k) && v != null
          ? Math.round(v * factor)
          : k === "ReleaseClauses"
            ? String(v).replace(
                /\$([\d,]+)/g,
                (_, n) =>
                  symbol +
                  Math.round(
                    Number(n.replaceAll(",", "")) * factor,
                  ).toLocaleString("en-US"),
              )
            : v,
      ]),
  );
}
export type CsvOptions = {
  columns?: string[];
  delimiter?: "," | ";" | "\t";
  includeHeaders?: boolean;
};
export function csv(
  rows: Row[], factor: number, symbol: string, options: CsvOptions = {},
): string {
  if (!rows.length) return "";
  const converted = rows.map((r) => currencyRow(r, factor, symbol));
  const available = new Set<string>();
  for (const row of converted) {
    for (const key of Object.keys(row)) available.add(key);
  }
  const keys = options.columns
    ? [...new Set(options.columns)]
    : [...available];
  const delimiter = options.delimiter ?? ",";
  const escape = (v: any) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      ...(options.includeHeaders === false ? [] : [keys.map(escape).join(delimiter)]),
      ...converted.map((r) => keys.map((k) => escape(r[k])).join(delimiter)),
    ].join("\r\n")
  );
}

export type ColumnKind = "number" | "text" | "boolean" | "date";
export type SearchColumn = { key: string; label: string; kind: ColumnKind };
export type ColumnRule = { column: string; operator: string; value: string };
export const columnLabel = (key: string) => labels[key] || names[key] || key.replace(/^Pos_/, "Position: ").replace(/([a-z])([A-Z])/g, "$1 $2");
export function searchColumns(rows: Row[], candidates: string[]): SearchColumn[] {
  const kinds = new Map<string, ColumnKind>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!/^[A-Z]/.test(key) && key !== "1v1") continue;
      if (value == null || typeof value === "object" || kinds.has(key)) continue;
      kinds.set(key, typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "text");
    }
  }
  const numeric = new Set(["Age", "CA", "PA", "Diff", "Rep", "Reputation", "RoleRtg", "PotRtg", "UID", "Height", "Weight", ...Object.values(groups).flat(), ...Object.values(staffGroups).flat()]);
  for (const key of candidates) if (!kinds.has(key)) kinds.set(key,
    isMoney(key) || numeric.has(key) || key.startsWith("Pos_") ? "number"
    : ["TransferListed", "LoanListed"].includes(key) ? "boolean" : "text");
  return [...kinds].map(([key, kind]) => ({ key, label: columnLabel(key), kind: key === "DoB" || key === "Contract" ? "date" as const : kind }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export function ruleError(rule: ColumnRule): string | null {
  if (["empty", "present"].includes(rule.operator)) return null;
  if (!rule.value.trim()) return "Enter a value or remove this filter.";
  if (["gt", "gte", "lt", "lte", "number_eq", "number_ne"].includes(rule.operator) && !Number.isFinite(Number(rule.value))) return "Enter a valid number.";
  if (["before", "after"].includes(rule.operator) && !/^\d{4}-\d{2}-\d{2}$/.test(rule.value)) return "Choose a date.";
  return null;
}
export function matchesColumnRules(row: Row, rules: ColumnRule[], factor: number): boolean {
  return rules.every(rule => {
    if (ruleError(rule)) return false;
    const raw = row[rule.column];
    const missing = raw == null || raw === "";
    if (rule.operator === "empty") return missing;
    if (rule.operator === "present") return !missing;
    if (missing) return false;
    const value = rule.value.trim();
    if (["gt", "gte", "lt", "lte", "number_eq", "number_ne"].includes(rule.operator)) {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      const actual = isMoney(rule.column) ? Math.round(raw * factor) : raw;
      const expected = Number(value);
      switch (rule.operator) {
        case "gt": return actual > expected;
        case "gte": return actual >= expected;
        case "lt": return actual < expected;
        case "lte": return actual <= expected;
        case "number_eq": return actual === expected;
        case "number_ne": return actual !== expected;
      }
    }
    if (rule.operator === "boolean") return typeof raw === "boolean" && raw === (value === "true");
    if (rule.operator === "before" || rule.operator === "after") {
      const actual = contractDate(raw);
      const expected = Date.parse(value + "T00:00:00Z");
      return actual != null && (rule.operator === "before" ? actual < expected : actual > expected);
    }
    const actual = String(raw).toLocaleLowerCase();
    const expected = value.toLocaleLowerCase();
    switch (rule.operator) {
      case "contains": return actual.includes(expected);
      case "not_contains": return !actual.includes(expected);
      case "eq": return actual === expected;
      case "ne": return actual !== expected;
      case "starts": return actual.startsWith(expected);
      case "ends": return actual.endsWith(expected);
      default: return false;
    }
  });
}
export function matchesSearch(row: Row, query: string, factor: number): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const values = Object.entries(row).filter(([key, value]) => (/^[A-Z]/.test(key) || key === "1v1") && value != null && typeof value !== "object")
    .map(([key, value]) => String(isMoney(key) && typeof value === "number" ? Math.round(value * factor) : value).toLocaleLowerCase());
  return terms.every(term => values.some(value => value.includes(term)));
}
