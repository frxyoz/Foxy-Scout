//! Staff sheets use distinct validation and scaling from player attributes.
use crate::{
    names::NameMap,
    parser::{apply_name, build_name_index, number, u16_at, Boundary},
};
use chrono::{Datelike, NaiveDate};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
const SLOTS: [(usize, &str); 23] = [
    (4, "Level of Discipline"),
    (12, "Working With Youngsters"),
    (13, "Determination"),
    (27, "GK Shot Stopping"),
    (28, "Judging Player Ability"),
    (29, "Judging Player Potential"),
    (30, "Man Management"),
    (31, "Motivating"),
    (32, "Physiotherapy"),
    (33, "Tactical Knowledge"),
    (34, "Attacking"),
    (35, "Defending"),
    (36, "Fitness"),
    (37, "Mental"),
    (38, "Technical"),
    (39, "Tactical"),
    (41, "GK Handling"),
    (42, "GK Distribution"),
    (44, "Analysing Data"),
    (47, "Sports Science"),
    (49, "Negotiating"),
    (50, "Judging Staff Ability"),
    (51, "Set Pieces"),
];
pub fn read_staff_sheet(d: &[u8], start: usize, end: usize) -> Option<Value> {
    if end < 68 || start > end - 68 {
        return None;
    }
    let mut candidates = Vec::new();
    for p in start..=(start + 140).min(end - 68) {
        let home = u16_at(d, p)?;
        let current = u16_at(d, p + 2)?;
        let world = u16_at(d, p + 4)?;
        let ca = u16_at(d, p + 6)?;
        let pa = u16_at(d, p + 8)?;
        if home > 10000
            || current > 10000
            || world > 10000
            || !(1..=200).contains(&ca)
            || pa < ca
            || pa > 200
        {
            continue;
        }
        let raw = d.get(p + 16..p + 68)?;
        if !raw.iter().all(|v| (1..=100).contains(v))
            || raw[..26]
                .iter()
                .enumerate()
                .any(|(i, v)| i != 13 && *v > 20)
        {
            continue;
        }
        let attrs: SizedMap = SLOTS
            .iter()
            .map(|(i, k)| {
                (
                    (*k).into(),
                    json!(if *i >= 26 || *i == 13 {
                        ((raw[*i] + 2) / 5).clamp(1, 20)
                    } else {
                        raw[*i]
                    }),
                )
            })
            .collect();
        candidates.push(
            json!({"ca":ca,"pa":pa,"reputation":(world+25)/50,"attributes":attrs,"sheet_offset":p}),
        );
    }
    if candidates.len() == 1 {
        candidates.pop()
    } else {
        None
    }
}
type SizedMap = serde_json::Map<String, Value>;
pub fn extract_staff_records(
    d: &[u8],
    players: &[Value],
    first: &NameMap,
    sur: &NameMap,
    date: NaiveDate,
    sites: &[Boundary],
) -> Vec<Value> {
    if sites.len() < 2 {
        return Vec::new();
    }
    let heads: HashSet<usize> = players.iter().map(|r| number(r, "offset")).collect();
    let index = build_name_index(d, first, sur, date.year());
    let mut by_object: HashMap<usize, Vec<usize>> = HashMap::new();
    for (i, n) in index.iter().enumerate() {
        let k = sites.partition_point(|s| s.site <= n.offset);
        if k > 0 && k < sites.len() {
            by_object.entry(k - 1).or_default().push(i);
        }
    }
    let mut keys: Vec<_> = by_object.keys().copied().collect();
    keys.sort();
    let mut result = Vec::new();
    for k in keys {
        let names = &by_object[&k];
        if sites[k + 1].index.checked_sub(sites[k].index) != Some(1)
            || heads.contains(&(sites[k].site + 15))
        {
            continue;
        }
        let start = sites[k].site + 9;
        let end = sites[k + 1].site.saturating_sub(16);
        if !(100..=20000).contains(&end.saturating_sub(start)) || names.len() != 1 {
            continue;
        }
        let Some(mut sheet) = read_staff_sheet(d, start, end.min(index[names[0]].offset)) else {
            continue;
        };
        sheet["offset"] = json!(start);
        sheet["obj_end"] = json!(end);
        sheet["uid"] = json!(sites[k + 1].id);
        apply_name(&mut sheet, &index[names[0]], date.year());
        if let Some(born) = NaiveDate::from_ymd_opt(
            number(&sheet, "birth_year") as i32,
            number(&sheet, "birth_month") as u32,
            number(&sheet, "birth_day") as u32,
        ) {
            let age = date.year()
                - born.year()
                - i32::from((date.month(), date.day()) < (born.month(), born.day()));
            if (16..=100).contains(&age) {
                sheet["age"] = json!(age);
                result.push(sheet)
            }
        }
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_sheet() {
        assert!(read_staff_sheet(&[0; 100], 0, 100).is_none());
        assert!(read_staff_sheet(&[], 0, 0).is_none());
    }
}
