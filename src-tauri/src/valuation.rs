use serde_json::Value;
#[derive(Clone, Debug)]
pub struct Economy {
    pub a: f64,
    pub game_date: String,
    pub offset: f64,
}
fn num(v: &Value, key: &str, default: f64) -> f64 {
    let n = v.get(key).and_then(Value::as_f64).unwrap_or(default);
    if n == 0.0 {
        default
    } else {
        n
    }
}
pub fn interp(x: f64, xs: &[f64], ys: &[f64]) -> f64 {
    if x <= xs[0] {
        return ys[0];
    }
    if x >= xs[xs.len() - 1] {
        return ys[ys.len() - 1];
    }
    let i = xs.partition_point(|v| *v <= x) - 1;
    ys[i] + (x - xs[i]) / (xs[i + 1] - xs[i]) * (ys[i + 1] - ys[i])
}
fn date(s: &str) -> Option<(i64, i64, i64)> {
    let s = s.trim();
    for (sep, order) in [('/', [2, 1, 0]), ('-', [0, 1, 2])] {
        let parts: Vec<_> = s
            .chars()
            .take(10)
            .collect::<String>()
            .split(sep)
            .map(str::to_owned)
            .collect();
        if parts.len() == 3 {
            if let (Ok(y), Ok(m), Ok(d)) = (
                parts[order[0]].parse(),
                parts[order[1]].parse(),
                parts[order[2]].parse(),
            ) {
                if y > 1900 && (1..=12).contains(&m) && (1..=31).contains(&d) {
                    return Some((y, m, d));
                }
            }
        }
    }
    None
}
fn days((y, m, d): (i64, i64, i64)) -> i64 {
    let a = (14 - m) / 12;
    let yy = y + 4800 - a;
    let mm = m + 12 * a - 3;
    d + (153 * mm + 2) / 5 + 365 * yy + yy / 4 - yy / 100 + yy / 400
}
pub fn months_left(rec: &Value, game_date: &str) -> f64 {
    if rec["contract_type"] != "Full Contract" {
        return 0.0;
    }
    let end = rec["contract_end"].as_str().and_then(date);
    match (end, date(game_date)) {
        (Some(e), Some(c)) => ((days(e) - days(c)) as f64 / 30.44).max(0.0),
        _ => 0.0,
    }
}
pub fn economy_calibration(records: &[Value], game_date: &str) -> Economy {
    let mut wages: Vec<f64> = records
        .iter()
        .filter(|r| num(r, "ca", 0.0) >= 120.0)
        .map(|r| num(r, "wage_annual_usd", 0.0))
        .filter(|w| *w > 0.0)
        .collect();
    if wages.len() < 10 {
        wages = records
            .iter()
            .map(|r| num(r, "wage_annual_usd", 0.0))
            .filter(|w| *w > 0.0)
            .collect()
    }
    let a = if wages.len() < 10 {
        14.607
    } else {
        wages.sort_by(f64::total_cmp);
        let n = wages.len();
        let med = if n % 2 == 1 {
            wages[n / 2]
        } else {
            0.5 * (wages[n / 2 - 1] + wages[n / 2])
        };
        med.max(1.0).ln().clamp(10.607, 18.607)
    };
    Economy {
        a,
        game_date: game_date.into(),
        offset: 0.60 * (a - 14.607),
    }
}
pub fn estimate_value(rec: &Value, econ: &Economy) -> (i64, i64, i64) {
    let ca = num(rec, "ca", 0.0);
    let wage = num(rec, "wage_annual_usd", 0.0);
    if ca <= 0.0 || wage <= 0.0 || rec["contract_type"] != "Full Contract" {
        return (0, 0, 0);
    }
    let pa = num(rec, "pa", 0.0).abs();
    let age = num(rec, "age", 24.0).clamp(14.0, 45.0);
    let ca = ca.clamp(20.0, 200.0);
    let lw = (wage.ln() - econ.a).clamp(-3.0, 3.0);
    let ml = months_left(rec, &econ.game_date);
    let pot = (pa.min(200.0) - ca).max(0.0) / 10.0 * ((26.0 - age) / 8.0).clamp(0.0, 1.0);
    let pos = match rec["best_position"].as_str().unwrap_or("") {
        "GK" => -0.1769,
        "DC" | "DL" | "DR" | "SW" => -0.0338,
        "AMC" | "AML" | "AMR" => 0.1587,
        "ST" => 0.0822,
        _ => 0.0,
    };
    let z = 17.1624
        + interp(
            ca,
            &[
                40., 92., 97., 102., 107., 112., 117., 122., 127., 132., 137., 142., 147., 152.,
                159., 200.,
            ],
            &[
                -8.7207, -3.5207, -2.8454, -2.7899, -2.0615, -1.6701, -0.8151, -0.4058, -0.1179,
                0.1865, 0.4482, 0.7719, 0.9866, 1.0855, 1.1972, 1.8532,
            ],
        )
        + interp(
            age,
            &[14., 17., 19., 20., 21., 22., 23., 30., 32., 34., 42.],
            &[
                -1.0618, -1.0618, -1.1176, -1.1933, -1.3592, -1.4003, -1.5540, -1.5540, -1.8135,
                -2.6850, -6.1710,
            ],
        )
        + interp(
            ml.min(120.0),
            &[0., 6., 10.9, 22.9, 120.],
            &[0.3, 0.39, 0.4502, 0.7145, 0.7145],
        )
        + 0.476 * lw
        + 0.4001 * pot
        + pos
        + econ.offset;
    let mid = z.min(25.0).exp();
    (
        (mid * 0.9).round_ties_even() as i64,
        mid.round_ties_even() as i64,
        (mid * 1.11).round_ties_even() as i64,
    )
}
pub fn applicable_release_clause(rec: &Value, game_date: &str, scenario: &str) -> Option<i64> {
    let end = rec["contract_end"].as_str().and_then(date)?;
    let today = date(game_date)?;
    if days(end) < days(today) {
        return None;
    }
    let eligible = match scenario {
        "Foreign clubs" => vec![0, 16],
        "Domestic clubs" => vec![0, 18],
        "Domestic higher division" => vec![0, 17, 18],
        _ => vec![0],
    };
    rec["release_clauses"]
        .as_array()?
        .iter()
        .filter(|c| {
            c["kind"].as_i64().is_some_and(|k| eligible.contains(&k)) && c["parameter"].is_null()
        })
        .filter_map(|c| c["amount_usd"].as_f64())
        .filter(|v| *v > 0.0 && *v < 10_000_000_000.0)
        .map(|v| v as i64)
        .min()
}
pub fn estimate_sale_value(
    rec: &Value,
    market: i64,
    econ: &Economy,
    scenario: &str,
) -> (Option<i64>, String, Option<i64>) {
    if rec["contract_type"] == "None" {
        return (Some(0), "Free agent · no transfer fee".into(), None);
    }
    let cap = applicable_release_clause(rec, &econ.game_date, scenario);
    let (price, basis) =
        if let Some(asking) = rec["asking_price_usd"].as_f64().filter(|v| *v >= 0.0) {
            (Some(asking.round_ties_even() as i64), "Stored asking price")
        } else if market > 0 {
            let leverage = interp(
                months_left(rec, &econ.game_date),
                &[0., 6., 12., 24., 48., 72.],
                &[0.85, 1., 1.15, 1.4, 1.7, 1.85],
            );
            let growth = (num(rec, "pa", 0.0) - num(rec, "ca", 0.0)).max(0.0);
            let youth = if num(rec, "age", 30.0) <= 23.0 {
                (growth / 200.0).min(0.3)
            } else {
                0.0
            };
            let mut multiplier = leverage + youth;
            if rec["transfer_listed"] == true {
                multiplier *= 0.7
            }
            if rec["not_for_sale"] == true {
                multiplier *= 1.8
            }
            (
                Some((market as f64 * multiplier).round_ties_even() as i64),
                "Estimated asking price",
            )
        } else {
            (None, "Insufficient valuation data")
        };
    if cap.is_some_and(|c| price.is_none_or(|p| p > c)) {
        return (cap, "Capped by active release clause".into(), cap);
    }
    (price, basis.into(), cap)
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn player() -> Value {
        json!({"contract_type":"Full Contract","contract_end":"30/06/2035","age":21,"ca":140,"pa":175,"release_clauses":[{"kind":0,"amount_usd":4321987,"parameter":null}]})
    }
    #[test]
    fn cap_exact() {
        let r = player();
        let e = economy_calibration(&[], "2031-08-17");
        assert_eq!(
            estimate_sale_value(&r, 20_000_000, &e, "Any club"),
            (
                Some(4321987),
                "Capped by active release clause".into(),
                Some(4321987)
            )
        );
    }
    #[test]
    fn unknown_differs_from_free() {
        let e = economy_calibration(&[], "2031-08-17");
        assert_eq!(
            estimate_sale_value(&json!({"contract_type":"None"}), 0, &e, "Any club").0,
            Some(0)
        );
        assert_eq!(estimate_sale_value(&json!({}), 0, &e, "Any club").0, None);
    }
    #[test]
    fn expired_no_cap() {
        assert_eq!(
            applicable_release_clause(&player(), "2036-01-01", "Any club"),
            None
        );
    }
    #[test]
    fn conditional_clauses_require_matching_buyer_and_resolved_parameters() {
        let mut r = player();
        r["release_clauses"] = json!([
            {"kind":18,"amount_usd":2_000_000,"parameter":null},
            {"kind":16,"amount_usd":8_000_000,"parameter":null},
            {"kind":17,"amount_usd":1_000_000,"parameter":null},
            {"kind":0,"amount_usd":1,"parameter":30},
            {"kind":1,"amount_usd":1,"parameter":null},
            {"kind":2,"amount_usd":1,"parameter":null}
        ]);
        for (scenario, expected) in [
            ("Any club", None),
            ("Foreign clubs", Some(8_000_000)),
            ("Domestic clubs", Some(2_000_000)),
            ("Domestic higher division", Some(1_000_000)),
        ] {
            assert_eq!(
                applicable_release_clause(&r, "2031-08-17", scenario),
                expected
            );
        }
    }
    #[test]
    fn lower_stored_asking_price_is_not_raised_by_release_fee() {
        let mut r = player();
        r["asking_price_usd"] = json!(2_000_000);
        let e = economy_calibration(&[], "2031-08-17");
        assert_eq!(
            estimate_sale_value(&r, 20_000_000, &e, "Any club").0,
            Some(2_000_000)
        );
    }
}
