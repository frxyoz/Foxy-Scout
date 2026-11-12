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
  const search = f.search.trim().toLowerCase();
  const day = Date.parse(date);
  return scenarioRows(rows, f.scenario)
    .filter((r) => {
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
        search &&
        !String(r.Name).toLowerCase().includes(search) &&
        !(/^\d+$/.test(search) && String(r.UID).includes(search))
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
