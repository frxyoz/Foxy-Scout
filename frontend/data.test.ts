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
