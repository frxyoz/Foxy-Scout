use crate::{personality, ratings, valuation};
use serde_json::{json, Value};
fn n(p: &Value, k: &str) -> i64 {
    p[k].as_i64().unwrap_or(0)
}
fn foot(v: i64) -> &'static str {
    match v {
        1..=2 => "Very Weak",
        3..=5 => "Weak",
        6..=9 => "Reasonable",
        10..=12 => "Fairly Strong",
        13..=15 => "Strong",
        16..=20 => "Very Strong",
        _ => "",
    }
}
fn commas(n: i64) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',')
        }
        out.push(c)
    }
    out
}
pub fn enrich_players(players: &mut [Value], game_date: &str) {
    let econ = valuation::economy_calibration(players, game_date);
    for p in players {
        let a = p["attributes"].clone();
        let pos = p["positions"].clone();
        let pers = p["personality"].clone();
        let mut top: Vec<_> = pos
            .as_object()
            .map(|o| {
                o.iter()
                    .filter(|(_, v)| v.as_i64().unwrap_or(0) > 1)
                    .collect()
            })
            .unwrap_or_default();
        top.sort_by(|a, b| b.1.as_i64().cmp(&a.1.as_i64()));
        let pos_str = if top.is_empty() {
            "?".into()
        } else {
            top.iter()
                .take(3)
                .map(|(k, _)| k.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        };
        let by = n(p, "birth_year");
        let dob = if by != 0 {
            format!("{:02}/{:02}/{}", n(p, "birth_day"), n(p, "birth_month"), by)
        } else {
            String::new()
        };
        let contract = if let Some(e) = p["contract_end"].as_str().filter(|s| !s.is_empty()) {
            e
        } else {
            match p["contract_type"].as_str() {
                Some("Month To Month") => "M2M",
                Some("None") => "Free",
                _ => "-",
            }
        };
        let wage = if n(p, "wage_annual_usd") != 0 {
            n(p, "wage_annual_usd")
        } else {
            n(p, "wage") * 65
        };
        let mut row = json!({"Name":p["name"],"UID":n(p,"uid"),"Nation":p["nation"].as_str().unwrap_or(""),"Club":p["club"].as_str().filter(|s|!s.is_empty()).unwrap_or("-"),"Age":p["age"],"CA":p["ca"],"PA":p["pa"],"Diff":n(p,"pa")-n(p,"ca"),"Rep":n(p,"reputation"),"BestPos":pos_str,"Height":n(p,"height"),"Weight":if n(p,"weight")==0{Value::Null}else{p["weight"].clone()},"Foot":p["foot"].as_str().unwrap_or(""),"LeftFoot":foot(n(&a,"LF")),"RightFoot":foot(n(&a,"RF")),"DoB":dob,"Contract":contract,"Wage":if wage==0{Value::Null}else{json!(wage)},"Gender":p["gender"].as_str().unwrap_or("M")});
        let report = ratings::player_role_report(&a, &pos, n(p, "ca"), n(p, "pa"), n(p, "age"));
        let listing_flags = p["contract_listing_flags"].as_u64();
        row["TransferListed"] = json!(listing_flags.map(|flags| flags & 1 != 0));
        row["LoanListed"] = json!(listing_flags.map(|flags| flags & 2 != 0));
        row["Role"] = report["best_role"][0].clone();
        row["RoleRtg"] =
            json!((report["best_role"][1].as_f64().unwrap_or(0.0) * 5.0).round_ties_even() as i64);
        row["PotRole"] = report["best_pot_role"][0].clone();
        row["PotRtg"] = json!(
            (report["best_pot_role"][1].as_f64().unwrap_or(0.0) * 5.0).round_ties_even() as i64
        );
        row["RoleReport"] = report;
        let (lo, mid, hi) = valuation::estimate_value(p, &econ);
        row["MarketValue"] = if mid > 0 || p["contract_type"] == "None" {
            json!(mid)
        } else {
            Value::Null
        };
        row["MarketValueLo"] = json!(lo);
        row["MarketValueHi"] = json!(hi);
        for (scenario, suffix) in [
            ("Any club", ""),
            ("Foreign clubs", "Foreign"),
            ("Domestic clubs", "Domestic"),
            ("Domestic higher division", "Higher"),
        ] {
            let (sale, basis, cap) = valuation::estimate_sale_value(p, mid, &econ, scenario);
            row[format!("SaleValue{suffix}")] = json!(sale);
            row[format!("SaleValueBasis{suffix}")] = json!(basis);
            row[format!("ReleaseClause{suffix}")] = json!(cap);
        }
        row["ReleaseClauses"] = json!(p["release_clauses"]
            .as_array()
            .map(|clauses| clauses
                .iter()
                .map(|c| format!(
                    "{}: ${}{}",
                    c["condition"].as_str().unwrap_or(""),
                    commas(n(c, "amount_usd")),
                    if c["parameter"].is_null() {
                        ""
                    } else {
                        " (condition/expiry unresolved)"
                    }
                ))
                .collect::<Vec<_>>()
                .join("; "))
            .unwrap_or_default());
        row["ClauseScenario"] = json!("Any club");
        for k in ATTRS {
            row[*k] = json!(n(&a, k));
        }
        for k in [
            "Adapt", "Ambi", "Loyal", "Press", "Prof", "Sport", "Contr", "Tempr",
        ] {
            row[k] = json!(n(&pers, k));
        }
        let mut personality = pers.clone();
        let label = if pers.as_object().is_some_and(|o| !o.is_empty()) {
            personality["Ldr"] = json!(n(&a, "Lea"));
            personality::personality_label(n(&a, "Det"), &personality)
        } else {
            String::new()
        };
        row["Personality"] = json!(label);
        for k in POSITIONS {
            row[format!("Pos_{k}")] = pos.get(*k).cloned().unwrap_or(json!(1));
        }
        for (k, v) in row.as_object().unwrap() {
            p[k] = v.clone()
        }
    }
}
const ATTRS: &[&str] = &[
    "Consis", "Dirt", "ImpM", "InjP", "Vers", "LF", "RF", "Cor", "Cro", "Dri", "Fin", "FT", "FK",
    "Hea", "LS", "LT", "Mar", "Pas", "PT", "Tac", "Tec", "Agg", "Ant", "Bra", "Com", "Con", "Dec",
    "Det", "Fla", "Lea", "OTB", "Pos", "TW", "Vis", "WR", "Acc", "Agi", "Bal", "JR", "NF", "Pac",
    "Sta", "Str", "1v1", "AA", "CoA", "Comm", "Ecc", "Han", "Kic", "Ref", "RO", "TTP", "Thr",
    "Consis", "Dirt", "ImpM", "InjP", "Vers", "LF", "RF",
];
const POSITIONS: &[&str] = &[
    "GK", "SW", "DL", "DC", "DR", "DM", "ML", "MC", "MR", "AML", "AMC", "AMR", "ST", "WBL", "WBR",
];
#[cfg(test)]
mod parity_tests {
    use super::*;
    #[test]
    fn listing_badges_preserve_independent_flags_and_unknown_status() {
        let mut players: Vec<Value> = [None, Some(0), Some(1), Some(2), Some(3), Some(65)]
            .into_iter().map(|flags| json!({
                "attributes": {}, "positions": {}, "personality": {},
                "ca": 100, "pa": 120, "age": 21, "contract_listing_flags": flags,
            })).collect();
        enrich_players(&mut players, "2031-08-17");
        for (player, (transfer, loan)) in players.iter().zip([
            (None, None), (Some(false), Some(false)),
            (Some(true), Some(false)), (Some(false), Some(true)),
            (Some(true), Some(true)), (Some(true), Some(false)),
        ]) {
            assert_eq!(player["TransferListed"], json!(transfer));
            assert_eq!(player["LoanListed"], json!(loan));
        }
        assert_eq!(players[1]["SaleValue"], players[2]["SaleValue"]);
    }
    #[test]
    #[ignore = "requires local private migration baselines"]
    fn full_dataframe_parity() {
        for i in 0..2 {
            let path = format!("../.cache/migration/baseline-{i}.json");
            let source = std::fs::read_to_string(path).unwrap();
            let baseline: Value = serde_json::from_str(&source).unwrap();
            let mut players: Vec<Value> = baseline["players"].as_array().unwrap().clone();
            enrich_players(&mut players, baseline["game_date"].as_str().unwrap());
            let mut failures = Vec::new();
            for (player, expected) in players.iter().zip(baseline["table"].as_array().unwrap()) {
                for (k, v) in expected.as_object().unwrap() {
                    let actual = &player[k];
                    let equal = if let (Some(a), Some(b)) = (actual.as_f64(), v.as_f64()) {
                        a == b
                    } else {
                        actual == v
                    };
                    if !equal && failures.len() < 20 {
                        failures.push(format!("{} {k}: {actual} != {v}", player["UID"]));
                    }
                }
            }
            assert!(failures.is_empty(), "baseline {i}: {}", failures.join("\n"));
        }
    }
}
