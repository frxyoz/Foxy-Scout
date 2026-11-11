use serde_json::{json, Value};
use std::sync::OnceLock;
pub fn roles() -> &'static Value {
    static ROLES: OnceLock<Value> = OnceLock::new();
    ROLES.get_or_init(||serde_json::from_str(r#"[{"abbrev": "GK", "name": "Goalkeeper", "duty": "Defend", "positions": ["GK"], "key": ["Agi", "Ref"], "pref": ["AA", "CoA", "Comm", "FT", "Han", "Kic", "1v1", "Thr", "Ant", "Con", "Dec", "Pos"]}, {"abbrev": "SK", "name": "Sweeper Keeper", "duty": "Support", "positions": ["GK"], "key": ["Agi", "Ref", "CoA", "Kic", "1v1", "Ant", "Con", "Pos"], "pref": ["AA", "Comm", "FT", "Han", "Pas", "Thr", "Vis", "Dec", "Acc"]}, {"abbrev": "CD", "name": "Central Defender", "duty": "Defend", "positions": ["DC"], "key": ["Hea", "Mar", "Tac", "Pos", "JR", "Bra", "Con", "Str"], "pref": ["Agg", "Ant", "Com", "Dec", "Acc", "Pac"]}, {"abbrev": "BPD", "name": "Ball Playing Defender", "duty": "Defend", "positions": ["DC"], "key": ["Hea", "Mar", "Pas", "Tac", "Com", "Pos", "JR", "Bra", "Con", "Str"], "pref": ["FT", "Tec", "Vis", "Agg", "Ant", "Dec", "Acc", "Pac"]}, {"abbrev": "NCB", "name": "No-Nonsense Centre Back", "duty": "Defend", "positions": ["DC"], "key": ["Hea", "Mar", "Tac", "Pos", "Bra", "JR", "Str"], "pref": ["Agg", "Ant", "Con", "Com", "Dec"]}, {"abbrev": "WCB", "name": "Wide Centre Back", "duty": "Support", "positions": ["DC"], "key": ["Dri", "Hea", "Mar", "Tac", "Pos", "Agi", "JR", "Pac", "Str"], "pref": ["Cro", "Fin", "FT", "Pas", "Tec", "Ant", "Bra", "Com", "Con", "Dec", "OTB", "WR", "Acc", "Bal", "Sta"]}, {"abbrev": "L", "name": "Libero", "duty": "Support", "positions": ["DC"], "key": ["Hea", "Mar", "Pas", "Tac", "Tec", "Com", "Dec", "Pos", "TW", "JR", "Str"], "pref": ["FT", "Ant", "Bra", "Con", "OTB", "Vis", "Acc", "Agi", "Bal", "Pac", "Sta"]}, {"abbrev": "FB", "name": "Full Back", "duty": "Defend", "positions": ["DL", "DR"], "key": ["Mar", "Tac", "Ant", "Con", "Pos", "TW", "WR"], "pref": ["Cro", "Dri", "Pas", "Tec", "Dec", "Sta", "Acc", "Agi", "Pac"]}, {"abbrev": "IFB", "name": "Inverted Full Back", "duty": "Defend", "positions": ["DL", "DR"], "key": ["Hea", "Mar", "Tac", "Pos", "Con", "JR", "Str"], "pref": ["FT", "Pas", "Ant", "Com", "Dec", "TW", "Acc", "Pac"]}, {"abbrev": "WB", "name": "Wing Back", "duty": "Support", "positions": ["DL", "DR", "WBL", "WBR"], "key": ["Cro", "Dri", "Mar", "Tac", "TW", "WR", "Acc", "Agi", "Pac", "Sta"], "pref": ["FT", "Pas", "Tec", "Ant", "Con", "Dec", "OTB", "Pos", "Bal"]}, {"abbrev": "CWB", "name": "Complete Wing Back", "duty": "Attack", "positions": ["DL", "DR", "WBL", "WBR"], "key": ["Cro", "Dri", "Tec", "Fla", "OTB", "Acc", "Agi", "Pac", "Sta"], "pref": ["FT", "Mar", "Pas", "Tac", "Ant", "Con", "Dec", "TW", "WR", "Bal", "Str"]}, {"abbrev": "IWB", "name": "Inverted Wing Back", "duty": "Support", "positions": ["DL", "DR", "WBL", "WBR"], "key": ["Pas", "Tac", "Com", "Dec", "TW", "Pos", "OTB"], "pref": ["FT", "Mar", "Tec", "Vis", "Ant", "Con", "Cro", "Dri", "Acc", "Agi", "Pac", "Sta", "Bal"]}, {"abbrev": "DM", "name": "Defensive Midfielder", "duty": "Defend", "positions": ["DM"], "key": ["Tac", "Ant", "Con", "Pos", "TW", "WR"], "pref": ["Mar", "Pas", "Agg", "Com", "Dec", "Str"]}, {"abbrev": "A", "name": "Anchor", "duty": "Defend", "positions": ["DM"], "key": ["Mar", "Tac", "Ant", "Con", "Pos", "TW"], "pref": ["Com", "Dec", "WR", "Str", "Agg"]}, {"abbrev": "HB", "name": "Half Back", "duty": "Defend", "positions": ["DM"], "key": ["Mar", "Tac", "Ant", "Con", "Com", "Dec", "Pos", "TW"], "pref": ["FT", "Pas", "Agg", "Bra", "WR", "JR", "Str"]}, {"abbrev": "BWM", "name": "Ball Winning Midfielder", "duty": "Defend", "positions": ["DM", "MC"], "key": ["Tac", "Agg", "Ant", "TW", "WR", "Sta"], "pref": ["Mar", "Bra", "Con", "Pos", "Acc", "Agi", "Str", "Det", "Pac"]}, {"abbrev": "DLP", "name": "Deep Lying Playmaker", "duty": "Support", "positions": ["DM", "MC"], "key": ["FT", "Pas", "Tec", "Com", "Dec", "TW", "Vis"], "pref": ["Ant", "OTB", "Pos", "Bal"]}, {"abbrev": "RGA", "name": "Regista", "duty": "Support", "positions": ["DM"], "key": ["FT", "Pas", "Tec", "Com", "Dec", "Fla", "OTB", "TW", "Vis"], "pref": ["Dri", "Ant", "Bal", "Agi"]}, {"abbrev": "RPM", "name": "Roaming Playmaker", "duty": "Support", "positions": ["DM", "MC"], "key": ["FT", "Pas", "Tec", "Com", "Dec", "OTB", "TW", "Vis", "Acc", "Sta"], "pref": ["Dri", "LS", "Ant", "Con", "Fla", "Pos", "WR", "Agi", "Bal", "Pac"]}, {"abbrev": "SV", "name": "Segundo Volante", "duty": "Support", "positions": ["DM"], "key": ["Fin", "Mar", "Pas", "Tac", "OTB", "Pos", "Acc", "Pac", "Sta", "Str"], "pref": ["FT", "LS", "Tec", "Ant", "Com", "Con", "Dec", "TW", "WR", "Bal", "JR"]}, {"abbrev": "CM", "name": "Central Midfielder", "duty": "Support", "positions": ["MC"], "key": ["FT", "Pas", "Tac", "Dec", "TW", "WR"], "pref": ["Tec", "Ant", "Com", "Con", "OTB", "Vis", "Sta"]}, {"abbrev": "BBM", "name": "Box To Box Midfielder", "duty": "Support", "positions": ["MC"], "key": ["Pas", "Tac", "OTB", "TW", "WR", "Acc", "Pac", "Sta", "Str"], "pref": ["Dri", "Fin", "FT", "LS", "Tec", "Agg", "Ant", "Com", "Dec"]}, {"abbrev": "AP", "name": "Advanced Playmaker", "duty": "Support", "positions": ["AMC", "AML", "AMR", "MC"], "key": ["FT", "Pas", "Tec", "Com", "Dec", "OTB", "TW", "Vis"], "pref": ["Dri", "Ant", "Fla", "Agi"]}, {"abbrev": "MEZ", "name": "Mezzala", "duty": "Support", "positions": ["MC"], "key": ["Pas", "Tec", "Dec", "OTB", "Vis", "Acc"], "pref": ["Dri", "Fin", "FT", "LS", "Tac", "Ant", "Com", "Fla", "WR", "Bal", "Sta"]}, {"abbrev": "CAR", "name": "Carrilero", "duty": "Support", "positions": ["MC"], "key": ["FT", "Pas", "Tac", "Dec", "Pos", "TW", "WR"], "pref": ["Tec", "Ant", "Com", "Con", "OTB", "Vis", "Sta"]}, {"abbrev": "WM", "name": "Wide Midfielder", "duty": "Support", "positions": ["ML", "MR"], "key": ["Cro", "Pas", "Tac", "TW", "WR"], "pref": ["Dri", "FT", "Tec", "Ant", "Dec", "OTB", "Pos", "Acc", "Sta"]}, {"abbrev": "W", "name": "Winger", "duty": "Attack", "positions": ["AML", "AMR", "ML", "MR"], "key": ["Cro", "Dri", "Tec", "Agi", "Acc", "Pac"], "pref": ["FT", "Pas", "OTB", "WR", "Bal", "Sta"]}, {"abbrev": "IW", "name": "Inverted Winger", "duty": "Support", "positions": ["AML", "AMR", "ML", "MR"], "key": ["Cro", "Dri", "Pas", "Tec", "OTB", "Agi", "Acc"], "pref": ["FT", "LS", "Ant", "Com", "Dec", "Fla", "Vis", "WR", "Bal", "Pac"]}, {"abbrev": "IF", "name": "Inside Forward", "duty": "Attack", "positions": ["AML", "AMR"], "key": ["Dri", "Fin", "FT", "Tec", "OTB", "Agi", "Acc", "Pac"], "pref": ["LS", "Pas", "Ant", "Com", "Fla", "Vis", "Bal"]}, {"abbrev": "WP", "name": "Wide Playmaker", "duty": "Support", "positions": ["AML", "AMR", "ML", "MR"], "key": ["Dri", "FT", "Pas", "Tec", "Com", "Dec", "OTB", "TW", "Vis"], "pref": ["Ant", "Fla", "Acc", "Agi", "Bal"]}, {"abbrev": "DW", "name": "Defensive Winger", "duty": "Support", "positions": ["AML", "AMR", "ML", "MR"], "key": ["Cro", "Tac", "Ant", "OTB", "Pos", "TW", "WR", "Acc", "Pac", "Sta"], "pref": ["Dri", "FT", "Mar", "Pas", "Tec", "Agg", "Con", "Dec", "Agi"]}, {"abbrev": "RMD", "name": "Raumdeuter", "duty": "Attack", "positions": ["AML", "AMR"], "key": ["Fin", "Tec", "Ant", "Com", "OTB", "Acc", "Bal"], "pref": ["FT", "Dec", "Fla", "Bra", "Agi", "Pac", "JR"]}, {"abbrev": "AM", "name": "Attacking Midfielder", "duty": "Support", "positions": ["AMC"], "key": ["FT", "LS", "Pas", "Tec", "Dec", "Fla", "OTB", "Vis"], "pref": ["Dri", "Ant", "Com", "Agi", "Bal"]}, {"abbrev": "SS", "name": "Shadow Striker", "duty": "Attack", "positions": ["AMC"], "key": ["Dri", "Fin", "FT", "OTB", "Com", "Acc", "Pac"], "pref": ["Pas", "Tec", "Ant", "Dec", "WR", "Agi", "Bal", "Bra"]}, {"abbrev": "EG", "name": "Enganche", "duty": "Support", "positions": ["AMC"], "key": ["FT", "Pas", "Tec", "Com", "Dec", "Fla", "OTB", "Vis"], "pref": ["Dri", "Ant", "Agi", "Bal"]}, {"abbrev": "T", "name": "Trequartista", "duty": "Attack", "positions": ["AMC", "AML", "AMR", "ST"], "key": ["Dri", "Fin", "FT", "Pas", "Tec", "Com", "Dec", "Fla", "OTB", "Vis"], "pref": ["Ant", "Agi", "Bal"]}, {"abbrev": "AF", "name": "Advanced Forward", "duty": "Attack", "positions": ["ST"], "key": ["Dri", "Fin", "FT", "Tec", "Com", "OTB", "Acc", "Pac"], "pref": ["Pas", "Ant", "Dec", "Fla", "Agi", "Bal", "Sta"]}, {"abbrev": "P", "name": "Poacher", "duty": "Attack", "positions": ["ST"], "key": ["Fin", "OTB", "Ant", "Com", "Acc", "Pac"], "pref": ["FT", "Hea", "Tec", "Dec", "Bal"]}, {"abbrev": "DLF", "name": "Deep Lying Forward", "duty": "Support", "positions": ["ST"], "key": ["Fin", "FT", "Pas", "Tec", "Com", "Dec", "OTB", "TW"], "pref": ["Dri", "Ant", "Fla", "Vis", "Bal", "Str"]}, {"abbrev": "CF", "name": "Complete Forward", "duty": "Support", "positions": ["ST"], "key": ["Dri", "Fin", "FT", "Hea", "LS", "Pas", "Tec", "Com", "Dec", "OTB", "Vis", "Agi", "Str"], "pref": ["Ant", "Fla", "TW", "Acc", "Bal", "JR", "Pac", "Sta"]}, {"abbrev": "TM", "name": "Target Forward", "duty": "Attack", "positions": ["ST"], "key": ["Fin", "Hea", "Bra", "Com", "OTB", "Bal", "JR", "Str"], "pref": ["FT", "Agg", "Ant", "Dec", "TW", "Acc"]}, {"abbrev": "PF", "name": "Pressing Forward", "duty": "Support", "positions": ["ST"], "key": ["Agg", "Ant", "Bra", "TW", "WR", "Acc", "Pac", "Sta"], "pref": ["Fin", "FT", "Com", "Con", "Dec", "OTB", "Str"]}, {"abbrev": "F9", "name": "False Nine", "duty": "Support", "positions": ["ST"], "key": ["Dri", "Fin", "FT", "Pas", "Tec", "Com", "Dec", "OTB", "Vis", "Agi"], "pref": ["Ant", "Fla", "Bal", "Acc"]}]"#).expect("static roles"))
}
fn number(v: &Value, key: &str, default: f64) -> f64 {
    v.get(key).and_then(Value::as_f64).unwrap_or(default)
}
pub fn project_potential_attrs(attrs: &Value, ca: i64, pa: i64, age: i64) -> Value {
    if pa <= 0 || ca <= 0 {
        return attrs.clone();
    }
    let base = ((pa - ca).max(0) as f64 / 80.0).min(1.0);
    let age_factor = if age <= 0 {
        0.5
    } else {
        ((30 - age) as f64 / 13.0).clamp(0.0, 1.0)
    };
    let mut projected = serde_json::Map::new();
    if let Some(attrs) = attrs.as_object() {
        for (a, v) in attrs {
            let w = if ["Acc", "Agi", "Bal", "JR", "NF", "Pac", "Sta", "Str"].contains(&a.as_str())
            {
                0.35
            } else if [
                "Agg", "Ant", "Bra", "Com", "Con", "Dec", "Det", "Fla", "Lea", "OTB", "Pos", "TW",
                "Vis", "WR",
            ]
            .contains(&a.as_str())
            {
                0.65
            } else {
                0.55
            };
            let v = v.as_f64().unwrap_or(0.0);
            projected.insert(
                a.clone(),
                json!((v + (20.0 - v) * base * age_factor * w)
                    .round_ties_even()
                    .clamp(1.0, 20.0) as i64),
            );
        }
    }
    Value::Object(projected)
}
pub fn compute_role_ratings(
    attrs: &Value,
    positions: &Value,
    restrict: bool,
) -> Vec<(String, f64)> {
    let mut scored = Vec::new();
    let mut playable = false;
    for r in roles().as_array().unwrap() {
        let fam = r["positions"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| number(positions, p.as_str().unwrap(), 1.0))
            .fold(1.0, f64::max);
        playable |= fam > 1.0;
        let key = r["key"].as_array().unwrap();
        let pref = r["pref"].as_array().unwrap();
        let total = key
            .iter()
            .map(|k| 5.0 * number(attrs, k.as_str().unwrap(), 0.0))
            .sum::<f64>()
            + pref
                .iter()
                .map(|k| 3.0 * number(attrs, k.as_str().unwrap(), 0.0))
                .sum::<f64>();
        let pure = total / (5 * key.len() + 3 * pref.len()) as f64;
        let duty = r["duty"].as_str().unwrap();
        scored.push((
            format!("{} ({})", r["abbrev"].as_str().unwrap(), &duty[..2]),
            pure,
            pure * fam / 20.0,
            fam,
        ));
    }
    if restrict && playable {
        scored.retain(|s| s.2 > 0.0 && s.3 > 1.0)
    }
    scored.sort_by(|a, b| b.2.total_cmp(&a.2));
    scored.into_iter().map(|s| (s.0, s.1)).collect()
}
pub fn best_role(attrs: &Value, positions: &Value) -> (String, f64) {
    compute_role_ratings(attrs, positions, true)
        .into_iter()
        .next()
        .unwrap_or(("-".into(), 0.0))
}
pub fn player_role_report(attrs: &Value, positions: &Value, ca: i64, pa: i64, age: i64) -> Value {
    let current = compute_role_ratings(attrs, positions, true);
    let potential = compute_role_ratings(
        &project_potential_attrs(attrs, ca, pa, age),
        positions,
        true,
    );
    json!({"best_role":current.first().cloned().unwrap_or(("-".into(),0.0)),"best_pot_role":potential.first().cloned().unwrap_or(("-".into(),0.0)),"current":current,"potential":potential})
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_roles_preserved() {
        assert_eq!(roles().as_array().unwrap().len(), 43);
    }
    #[test]
    fn no_growth_at_peak() {
        let a = json!({"Pas":12,"Acc":10});
        assert_eq!(project_potential_attrs(&a, 120, 200, 30), a);
    }
    #[test]
    fn keeper_scopes_roles() {
        let r = compute_role_ratings(&json!({"Agi":15,"Ref":15}), &json!({"GK":20}), true);
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].0, "GK (De)");
    }
}
