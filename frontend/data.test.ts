import { describe, expect, it } from "vitest";
import { csv, currencyRow, defaults, filterPlayers, Row } from "./data";
const rows: Row[] = [
  {
    Name: "Tejay McGrann",
    UID: 2002066982,
    Age: 23,
    CA: 160,
    PA: 190,
    Diff: 30,
    RoleRtg: 80,
    PotRtg: 90,
    Club: "Arsenal",
    Nation: "ENG",
    Pos_ST: 20,
    Contract: "17/02/2032",
    MarketValue: 1112700,
    SaleValue: 2000000,
    SaleValueForeign: 500000,
    SaleValueBasisForeign: "Foreign release",
    ReleaseClauseForeign: 500000,
    ReleaseClauses: "Foreign clubs: $500,000",
  },
  {
    Name: "Low Player",
    UID: 20,
    Age: 18,
    CA: 80,
    PA: 130,
    Diff: 50,
    RoleRtg: 40,
    PotRtg: 70,
    Club: "Other",
    Nation: "FRA",
    Pos_ST: 9,
    Contract: "Free",
    MarketValue: null,
    SaleValue: null,
    SaleValueForeign: null,
  },
];
describe("filter parity", () => {
  it("filters independent listing flags without treating unknown values as listed", () => {
    const input = [
      { ...rows[0], UID: 1, TransferListed: true, LoanListed: false },
      { ...rows[0], UID: 2, TransferListed: false, LoanListed: true },
      { ...rows[0], UID: 3, TransferListed: true, LoanListed: true },
      { ...rows[0], UID: 4, TransferListed: null, LoanListed: null },
      { ...rows[0], UID: 5, TransferListed: false, LoanListed: false },
    ];
    const ids = (listing: string) => filterPlayers(input, { ...defaults, listing }, "2031-08-17", 1).map(r => r.UID);
    expect(ids("All")).toEqual([1, 2, 3, 4, 5]);
    expect(ids("Transfer")).toEqual([1, 3]);
    expect(ids("Loan")).toEqual([2, 3]);
    expect(ids("Either")).toEqual([1, 2, 3]);
    expect(csv([input[0]], 1, "$", { columns: ["Name", "TransferListed", "LoanListed"] }))
      .toContain('"true","false"');
  });
  it("calculates market minus sale for the selected scenario, sorting and CSV currency", () => {
    const result = filterPlayers(rows, { ...defaults, sort: "ValueDifference" }, "2031-08-17", 1);
    expect(result[0].ValueDifference).toBe(-887300);
    expect(result[1].ValueDifference).toBeNull();
    const foreign = filterPlayers(rows, { ...defaults, scenario: "Foreign clubs" }, "2031-08-17", 1);
    expect(foreign[0].ValueDifference).toBe(612700);
    expect(currencyRow(foreign[0], 2, "$" ).ValueDifference).toBe(1225400);
    expect(csv(foreign, 2, "$", { columns: ["ValueDifference"] })).toBe('\uFEFF"ValueDifference"\r\n"1225400"\r\n""');
    expect(rows[0].ValueDifference).toBeUndefined();
  });
  it("uses literal search and UID substring matching", () => {
    expect(
      filterPlayers(
        rows,
        { ...defaults, search: "200206" },
        "2031-08-17",
        1,
      ).map((r) => r.Name),
    ).toEqual(["Tejay McGrann"]);
    expect(
      filterPlayers(rows, { ...defaults, search: "[" }, "2031-08-17", 1),
    ).toHaveLength(0);
  });
  it("requires competent position familiarity", () => {
    expect(
      filterPlayers(rows, { ...defaults, positions: ["ST"] }, "2031-08-17", 1),
    ).toHaveLength(1);
  });
  it("changes clause scenario before applying currency budget", () => {
    const result = filterPlayers(
      rows,
      { ...defaults, scenario: "Foreign clubs", basis: "SaleValue", max: 0.5 },
      "2031-08-17",
      1 / 1.1127,
    );
    expect(result).toHaveLength(1);
    expect(result[0].SaleValue).toBe(500000);
    expect(rows[0].SaleValue).toBe(2000000);
  });
  it("only includes decoded dates within contract cutoff", () => {
    expect(
      filterPlayers(
        rows,
        { ...defaults, contract: "Expiring in 6 months" },
        "2031-08-17",
        1,
      ),
    ).toHaveLength(0);
    expect(
      filterPlayers(
        rows,
        { ...defaults, contract: "Expiring in 12 months" },
        "2031-08-17",
        1,
      ),
    ).toHaveLength(1);
  });
  it("preserves null pricing in filters and sorting", () => {
    expect(
      filterPlayers(rows, { ...defaults, min: 0.1 }, "2031-08-17", 1),
    ).toHaveLength(1);
    expect(filterPlayers(rows, defaults, "2031-08-17", 1)[0].CA).toBe(160);
  });
});
describe("display currency and CSV", () => {
  it("exports requested columns in order with optional headers and separators", () => {
    const input = [{ Name: 'A; "B"\nC', MarketValue: 1112700, Age: 20 }];
    expect(csv(input, 1 / 1.1127, "€", {
      columns: ["MarketValue", "Name"], delimiter: ";", includeHeaders: false,
    })).toBe('\uFEFF"1000000";"A; ""B""\nC"');
    expect(csv(input, 1, "$", { columns: ["Age", "Name"], delimiter: "\t" }))
      .toBe('\uFEFF"Age"\t"Name"\r\n"20"\t"A; ""B""\nC"');
  });
  it("includes scalar columns discovered after the first row and omits nested payloads", () => {
    expect(csv([{ Name: "First" }, { Name: "Second", Age: 21, RoleReport: {} }], 1, "$"))
      .toBe('\uFEFF"Name","Age"\r\n"First",""\r\n"Second","21"');
    expect(csv([], 1, "$", { includeHeaders: false })).toBe("");
    expect(csv([{ Name: "First" }], 1, "$", { columns: ["Name", "Age"] }))
      .toBe('\uFEFF"Name","Age"\r\n"First",""');
  });
  it("converts amounts and clause descriptions without mutating canonical USD", () => {
    const euro = currencyRow(rows[0], 1 / 1.1127, "€");
    expect(euro.MarketValue).toBe(1000000);
    expect(euro.ReleaseClauses).toBe("Foreign clubs: €449,357");
    expect(rows[0].MarketValue).toBe(1112700);
  });
  it("exports full values with safe CSV quoting and no nested parser payloads", () => {
    const result = csv(
      [
        {
          Name: 'A, "B"',
          MarketValue: 1112700,
          attributes: { CA: 160 },
          RoleReport: { current: [] },
        },
      ],
      1 / 1.1127,
      "€",
    );
    expect(result).toContain('"A, ""B"""');
    expect(result).toContain('"1000000"');
    expect(result).not.toContain("RoleReport");
  });
});
