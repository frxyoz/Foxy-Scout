use serde_json::Value;
use std::sync::OnceLock;
/// FM24 personality cascade, first matching rule wins.
pub fn personality_label(det: i64, p: &Value) -> String {
    static RULES: OnceLock<Value> = OnceLock::new();
    let rules=RULES.get_or_init(||serde_json::from_str(r#"[["Leader", {"Ldr": [19, 20]}], ["Professional", {"Prof": [20, 20], "Tempr": [4, 20], "Contr": [15, 16], "Adapt": [9, 20]}], ["Easily Discouraged", {"Det": [1, 1], "Ambi": [5, 9], "Sport": [1, 14]}], ["Spineless", {"Det": [1, 9], "Press": [1, 1]}], ["Temperamental", {"Prof": [1, 10], "Contr": [1, 4]}], ["Slack", {"Det": [1, 10], "Prof": [1, 1]}], ["Loyal", {"Ambi": [6, 7], "Loyal": [18, 20]}], ["Casual", {"Det": [1, 9], "Prof": [1, 4]}], ["Model Professional", {"Prof": [20, 20], "Press": [1, 14], "Sport": [10, 20], "Tempr": [1, 11], "Contr": [10, 20]}], ["Unambitious", {"Det": [1, 17], "Prof": [1, 17], "Ambi": [1, 5], "Loyal": [11, 20]}], ["Low Determination", {"Det": [1, 5], "Ambi": [1, 9], "Loyal": [1, 16], "Sport": [1, 17]}], ["Perfectionist", {"Det": [14, 20], "Prof": [14, 20], "Ambi": [14, 20], "Contr": [1, 9]}], ["Fickle", {"Det": [1, 17], "Prof": [1, 17], "Ambi": [16, 20], "Loyal": [4, 6]}], ["Driven", {"Det": [18, 20], "Prof": [1, 17], "Ambi": [12, 20]}], ["Mercenary", {"Prof": [1, 17], "Ambi": [16, 20], "Loyal": [1, 3]}], ["Realist", {"Det": [11, 17], "Prof": [1, 17], "Sport": [2, 4]}], ["Determined", {"Det": [18, 20], "Prof": [1, 17]}], ["Ambitious", {"Prof": [1, 17], "Ambi": [16, 20], "Loyal": [1, 9]}], ["Unsporting", {"Det": [11, 20], "Sport": [1, 1]}], ["Low Self Belief", {"Det": [1, 9], "Press": [1, 3]}], ["Model Citizen", {"Det": [14, 20], "Prof": [15, 20], "Ambi": [12, 20], "Loyal": [15, 20], "Press": [14, 20], "Sport": [15, 20], "Contr": [15, 20]}], ["Resilient", {"Det": [15, 20], "Prof": [1, 17], "Press": [17, 20]}], ["Jovial", {"Prof": [1, 10], "Press": [15, 20], "Sport": [1, 14], "Contr": [10, 20]}], ["Spirited", {"Prof": [1, 17], "Press": [15, 20], "Sport": [1, 14], "Contr": [10, 20]}], ["Balanced", {"Det": [1, 14], "Prof": [1, 14], "Ambi": [1, 14], "Loyal": [1, 14], "Sport": [1, 14]}], ["Professional", {"Prof": [18, 20], "Contr": [10, 20]}], ["Sporting", {"Det": [1, 9], "Sport": [18, 20]}], ["Light-Hearted", {"Press": [15, 20], "Sport": [15, 20]}], ["Fairly Professional", {"Det": [1, 14], "Prof": [15, 20]}], ["Resolute", {"Prof": [15, 20]}], ["Fairly Determined", {"Det": [15, 20]}], ["Fairly Ambitious", {"Ambi": [15, 20]}], ["Fairly Sporting", {"Loyal": [1, 14]}], ["Fairly Loyal", {"Loyal": [15, 20]}]]"#).expect("static personality rules"));
    for rule in rules.as_array().unwrap() {
        let matches = rule[1].as_object().unwrap().iter().all(|(key, bounds)| {
            let x = if key == "Det" {
                Some(det)
            } else if key == "Ldr" {
                p.get("Ldr")
                    .or_else(|| p.get("Lea"))
                    .and_then(Value::as_i64)
                    .or(Some(0))
            } else {
                p.get(key).and_then(Value::as_i64)
            };
            x.is_some_and(|v| v >= bounds[0].as_i64().unwrap() && v <= bounds[1].as_i64().unwrap())
        });
        if matches {
            return rule[0].as_str().unwrap().to_owned();
        }
    }
    "Balanced".into()
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn leader_takes_precedence() {
        assert_eq!(personality_label(10, &json!({"Ldr":20})), "Leader");
    }
    #[test]
    fn missing_attrs_fall_back() {
        assert_eq!(personality_label(10, &json!({})), "Balanced");
    }
}
