import { ColumnRule, SearchColumn, ruleError, isMoney } from "./data";

const textOperators = [["contains", "contains"], ["not_contains", "does not contain"], ["eq", "equals"], ["ne", "does not equal"], ["starts", "starts with"], ["ends", "ends with"]];
export function operatorsFor(column?: SearchColumn) {
  const operators = column?.kind === "number"
    ? [["gte", "at least (≥)"], ["lte", "at most (≤)"], ["number_eq", "equals (=)"], ["number_ne", "does not equal (≠)"], ["gt", "greater than (>)"], ["lt", "less than (<)"]]
    : column?.kind === "boolean" ? [["boolean", "is"]]
    : column?.kind === "date" ? [["before", "before"], ["after", "after"], ...textOperators] : textOperators;
  return [...operators, ["empty", "is missing"], ["present", "is available"]];
}
export function ColumnFilters({ columns, rules, onChange, currency }: {
  columns: SearchColumn[]; rules: ColumnRule[]; onChange: (rules: ColumnRule[]) => void; currency: string;
}) {
  const update = (index: number, patch: Partial<ColumnRule>) => onChange(rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule));
  return <details className="column-filters" open={rules.length > 0 || undefined}>
    <summary>Column filters{rules.length > 0 ? ` (${rules.length})` : ""}</summary>
    <div className="details-content">
      <p className="filter-hint">Match every condition. Search any column, even when it’s hidden from the table.</p>
      {rules.map((rule, index) => {
        const column = columns.find(column => column.key === rule.column);
        const error = ruleError(rule);
        const needsValue = !["empty", "present"].includes(rule.operator);
        return <fieldset className="column-rule" key={index}>
          <legend>Condition {index + 1}</legend>
          <label>Column
            <select aria-label={`Condition ${index + 1} column`} value={rule.column} onChange={e => {
              const next = columns.find(column => column.key === e.target.value);
              update(index, { column: e.target.value, operator: operatorsFor(next)[0][0], value: next?.kind === "boolean" ? "true" : "" });
            }}>
              {columns.map(column => <option value={column.key} key={column.key}>{column.label}</option>)}
            </select>
          </label>
          <label>Match
            <select aria-label={`Condition ${index + 1} operator`} value={rule.operator} onChange={e => update(index, { operator: e.target.value })}>
              {operatorsFor(column).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          {needsValue && <label>{isMoney(rule.column) ? `Value (${currency}, full amount)` : "Value"}
            {rule.operator === "boolean" ? <select aria-label={`Condition ${index + 1} value`} value={rule.value} onChange={e => update(index, { value: e.target.value })}>
              <option value="true">Yes</option><option value="false">No</option>
            </select> : <input aria-label={`Condition ${index + 1} value`} aria-invalid={!!error}
              type={["before", "after"].includes(rule.operator) ? "date" : column?.kind === "number" ? "number" : "text"} step="any"
              placeholder={column?.kind === "number" ? "Enter a number…" : "Enter text…"}
              value={rule.value} onChange={e => update(index, { value: e.target.value })} />}
          </label>}
          {error && <p className="filter-error">{error}</p>}
          <button type="button" className="text-button" aria-label={`Remove condition ${index + 1}`} onClick={() => onChange(rules.filter((_, i) => i !== index))}>Remove condition</button>
        </fieldset>;
      })}
      <button type="button" disabled={!columns.length} onClick={() => {
        const column = columns.find(column => column.key === "CA") || columns[0];
        onChange([...rules, { column: column.key, operator: operatorsFor(column)[0][0], value: "" }]);
      }}>+ Add condition</button>
      {rules.length > 0 && <button type="button" className="text-button" onClick={() => onChange([])}>Clear column filters</button>}
    </div>
  </details>;
}
