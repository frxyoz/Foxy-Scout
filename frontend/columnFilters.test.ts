import { describe, expect, it } from "vitest";
import { searchColumns, matchesColumnRules, matchesSearch, ruleError, defaults, filterPlayers, ColumnRule, groups, staffGroups, extras } from "./data";
const rule = (column: string, operator: string, value = ""): ColumnRule => ({ column, operator, value });
describe("column search", () => {
  it("discovers every scalar column across records and all attribute groups", () => {
    const columns = searchColumns([{ Name: "First", MarketValue: null, RoleReport: {}, attributes: {} }, { ExtraMetric: 12, LoanListed: false }], [...extras, ...Object.values(groups).flat(), ...Object.values(staffGroups).flat()]);
    for (const key of [...extras, ...Object.values(groups).flat(), ...Object.values(staffGroups).flat(), "ExtraMetric"]) expect(columns.some(c => c.key === key)).toBe(true);
    expect(columns.find(c => c.key === "MarketValue")?.kind).toBe("number");
    expect(columns.find(c => c.key === "LoanListed")?.kind).toBe("boolean");
    expect(columns.some(c => ["RoleReport", "attributes"].includes(c.key))).toBe(false);
  });
  it("matches numbers, currency, booleans, text and missing values without coercing unknowns", () => {
    const row = { CA: 120, MarketValue: 1000000, Diff: -5, Club: "North [FC]", LoanListed: false, Wage: null };
    expect(matchesColumnRules(row, [rule("CA", "gte", "120"), rule("CA", "lte", "130"), rule("Diff", "lt", "0")], 1)).toBe(true);
    expect(matchesColumnRules(row, [rule("MarketValue", "number_eq", "500000")], .5)).toBe(true);
    expect(matchesColumnRules(row, [rule("LoanListed", "boolean", "false"), rule("Club", "contains", "[fc]")], 1)).toBe(true);
    expect(matchesColumnRules(row, [rule("Wage", "lte", "0")], 1)).toBe(false);
    expect(matchesColumnRules(row, [rule("Wage", "empty")], 1)).toBe(true);
    expect(matchesColumnRules(row, [rule("Wage", "present")], 1)).toBe(false);
    expect(matchesColumnRules({}, [rule("LoanListed", "boolean", "false")], 1)).toBe(false);
    expect(ruleError(rule("CA", "gte", ""))).toBeTruthy();
    expect(ruleError(rule("CA", "gte", "NaN"))).toBeTruthy();
  });
  it("matches dates chronologically and excludes non-date contract statuses", () => {
    expect(matchesColumnRules({ Contract: "31/12/2031" }, [rule("Contract", "before", "2032-01-01")], 1)).toBe(true);
    expect(matchesColumnRules({ Contract: "01/01/2032" }, [rule("Contract", "after", "2031-12-31")], 1)).toBe(true);
    expect(matchesColumnRules({ Contract: "Free" }, [rule("Contract", "before", "2032-01-01")], 1)).toBe(false);
  });
  it("quick search finds terms across columns, including converted amounts", () => {
    const row = { Name: "Alex Young", Club: "North FC", Nation: "ENG", MarketValue: 1000000, attributes: { secret: "hidden" } };
    expect(matchesSearch(row, "Alex North eng", 1)).toBe(true);
    expect(matchesSearch(row, "500000", .5)).toBe(true);
    expect(matchesSearch(row, "hidden", 1)).toBe(false);
    expect(matchesSearch(row, "absent", 1)).toBe(false);
  });
  it("filters derived values after the buying-club scenario and keeps source rows intact", () => {
    const input = [{ Name: "One", Age: 20, CA: 120, PA: 150, MarketValue: 1000000, SaleValue: 2000000, SaleValueForeign: 500000, Consis: 17 }];
    const f = { ...defaults, scenario: "Foreign clubs", columnRules: [rule("ValueDifference", "gt", "0"), rule("Consis", "gte", "16")] };
    expect(filterPlayers(input, f, "2031-01-01", 1)).toHaveLength(1);
    expect(filterPlayers(input, { ...f, scenario: "Any club" }, "2031-01-01", 1)).toHaveLength(0);
    expect(input[0].SaleValue).toBe(2000000);
  });
});
