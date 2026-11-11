use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
fn u32_at(d: &[u8], p: usize) -> Option<u32> {
    Some(u32::from_le_bytes(d.get(p..p + 4)?.try_into().ok()?))
}
#[derive(Clone, Debug)]
pub struct ClubEntry {
    pub eidx: u32,
    pub club_id: u32,
    pub league: u32,
    pub name: String,
    pub short: String,
    pub off: usize,
    pub body_start: usize,
}
fn read_entry(data: &[u8], head: usize) -> Option<ClubEntry> {
    if head < 4 || head + 41 > data.len() {
        return None;
    }
    let pair = u32_at(data, head)?;
    if pair == 0 || Some(pair) != u32_at(data, head + 4) || data[head + 8] != 0 {
        return None;
    }
    let fields: Vec<_> = (0..6)
        .map(|i| u32_at(data, head + 9 + i * 4).unwrap())
        .collect();
    if !fields.contains(&u32::MAX) {
        return None;
    }
    let name_len = u32_at(data, head + 35)? as usize;
    if !(1..=100).contains(&name_len) {
        return None;
    }
    let end = head + 39 + name_len;
    let short_len = u32_at(data, end)? as usize;
    if !(1..=60).contains(&short_len) {
        return None;
    }
    let short_end = end + 4 + short_len;
    let name = std::str::from_utf8(data.get(head + 39..end)?)
        .ok()?
        .to_owned();
    let short = std::str::from_utf8(data.get(end + 4..short_end)?)
        .ok()?
        .to_owned();
    if name.trim().is_empty() || short.trim().is_empty() || !name.chars().next()?.is_alphanumeric()
    {
        return None;
    }
    let eidx = u32_at(data, head - 4)?;
    if eidx >= 200000 {
        return None;
    }
    Some(ClubEntry {
        eidx,
        club_id: pair,
        league: if fields[0] != u32::MAX {
            fields[0]
        } else {
            fields[1]
        },
        name,
        short,
        off: head - 4,
        body_start: short_end,
    })
}
pub fn parse_club_entries(data: &[u8]) -> Vec<ClubEntry> {
    let mut out = Vec::new();
    for idx in 33..data.len().saturating_sub(5) {
        if data[idx] != 255 || data[idx + 1] != 255 {
            continue;
        }
        let n = u32_at(data, idx + 2).unwrap_or(0);
        if !(1..=100).contains(&n) {
            continue;
        }
        if let Some(e) = read_entry(data, idx - 33) {
            out.push(e)
        }
    }
    out.sort_by_key(|e| e.off);
    let mut have: HashSet<u32> = out.iter().map(|e| e.eidx).collect();
    let mut found = Vec::new();
    for pair in out.windows(2) {
        let a = &pair[0];
        let b = &pair[1];
        if b.eidx <= a.eidx + 1 || b.eidx - a.eidx > 4000 {
            continue;
        }
        for eidx in a.eidx + 1..b.eidx {
            if have.contains(&eidx) {
                continue;
            }
            let needle = eidx.to_le_bytes();
            for j in a.off..b.off.saturating_sub(3) {
                if data.get(j..j + 4) != Some(needle.as_slice()) {
                    continue;
                }
                if let Some(e) = read_entry(data, j + 4) {
                    if e.eidx == eidx {
                        have.insert(eidx);
                        found.push(e);
                        break;
                    }
                }
            }
        }
    }
    out.extend(found);
    out.sort_by_key(|e| e.off);
    out
}
fn candidates(data: &[u8], lo: usize, hi: usize, group: u8) -> Vec<Vec<u32>> {
    let mut out = Vec::new();
    if lo >= hi || hi > data.len() {
        return out;
    }
    for j in lo..hi.saturating_sub(3) {
        if data[j..j + 3] != [0, 255, group] {
            continue;
        }
        let n = data[j + 3] as usize;
        if !(1..=8).contains(&n) || j + 4 + 4 * n > hi {
            continue;
        }
        let ids: Vec<u32> = (0..n)
            .map(|i| u32_at(data, j + 4 + i * 4).unwrap())
            .collect();
        if ids.iter().any(|i| *i == 0 || *i > 20_000_000)
            || ids.iter().copied().collect::<HashSet<_>>().len() != n
        {
            continue;
        }
        out.push(ids)
    }
    out
}
fn lis_select(cands: &[Vec<Vec<u32>>]) -> Vec<Option<Vec<u32>>> {
    let mut items = Vec::new();
    for (ci, cl) in cands.iter().enumerate() {
        let mut indices: Vec<_> = (0..cl.len()).collect();
        indices.sort_by_key(|i| std::cmp::Reverse(cl[*i][0]));
        for kj in indices {
            items.push((ci, kj, cl[kj][0]))
        }
    }
    let mut tails: Vec<usize> = Vec::new();
    let mut keys = Vec::new();
    let mut parents = vec![None; items.len()];
    for (i, item) in items.iter().enumerate() {
        let k = keys.partition_point(|v| *v < item.2);
        if k > 0 {
            parents[i] = Some(tails[k - 1])
        }
        if k == tails.len() {
            tails.push(i);
            keys.push(item.2)
        } else {
            tails[k] = i;
            keys[k] = item.2
        }
    }
    let mut out = vec![None; cands.len()];
    let mut cur = tails.last().copied();
    while let Some(i) = cur {
        let (ci, kj, _) = items[i];
        out[ci] = Some(cands[ci][kj].clone());
        cur = parents[i]
    }
    out
}
fn unique_entries(data: &[u8]) -> Vec<ClubEntry> {
    let mut seen = HashSet::new();
    parse_club_entries(data)
        .into_iter()
        .filter(|e| seen.insert(e.eidx))
        .collect()
}
fn select_group(data: &[u8], entries: &[ClubEntry], group: u8) -> Vec<Option<Vec<u32>>> {
    let cands: Vec<_> = entries
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let hi = entries
                .get(i + 1)
                .map(|v| v.off)
                .unwrap_or(data.len().min(e.body_start + 60000));
            candidates(data, e.body_start, hi, group)
        })
        .collect();
    lis_select(&cands)
}
pub fn build_club_table(data: &[u8]) -> (Vec<ClubEntry>, Vec<Option<Vec<u32>>>) {
    let entries = unique_entries(data);
    let selected = select_group(data, &entries, 0);
    (entries, selected)
}
pub fn build_cid_to_name(data: &[u8], _fm_version: i32) -> HashMap<u32, String> {
    let entries = unique_entries(data);
    let selected = select_group(data, &entries, 0);
    let mut map = HashMap::new();
    let mut anchors = Vec::new();
    for (i, ids) in selected.iter().enumerate() {
        if let Some(ids) = ids {
            for id in ids {
                map.entry(*id).or_insert_with(|| entries[i].name.clone());
            }
            anchors.push((ids[0], i));
        }
    }
    for (i, ids) in select_group(data, &entries, 1).iter().enumerate() {
        if let Some(ids) = ids {
            for id in ids {
                map.entry(*id).or_insert_with(|| entries[i].name.clone());
            }
        }
    }
    for pair in anchors.windows(2) {
        let (c0, i0) = pair[0];
        let (c1, i1) = pair[1];
        let gap_e = i1 - i0;
        let gap_c = c1 - c0;
        if gap_e <= 1 || gap_c <= 1 || gap_e > 3000 || gap_c > 30000 {
            continue;
        }
        let ratio = gap_c as f64 / gap_e as f64;
        if !(0.2..=8.0).contains(&ratio) {
            continue;
        }
        for k in 1..gap_e {
            let est = c0 + (k as f64 * gap_c as f64 / gap_e as f64).round_ties_even() as u32;
            if c0 < est && est < c1 {
                map.entry(est)
                    .or_insert_with(|| entries[i0 + k].name.clone());
            }
        }
    }
    map.insert(u32::MAX, "Free Agent".into());
    map
}
pub fn annotate_records(
    data: &[u8],
    records: &mut [Value],
    fm_version: i32,
) -> HashMap<u32, String> {
    let map = build_cid_to_name(data, fm_version);
    let club_off = if fm_version >= 26 { 16 } else { 15 };
    for rec in records {
        if let Some(cid) = rec["offset"]
            .as_u64()
            .and_then(|o| u32_at(data, o as usize + club_off))
        {
            rec["club_id"] = json!(cid);
            rec["club"] = json!(map.get(&cid).map(String::as_str).unwrap_or(""));
        }
    }
    map
}
pub fn extract_clubs(data: &[u8], records: &mut [Value]) {
    annotate_records(data, records, 24);
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lis_keeps_one_per_club() {
        let c = vec![vec![vec![5], vec![2]], vec![vec![3]], vec![vec![4]]];
        let r = lis_select(&c);
        assert_eq!(r, vec![Some(vec![2]), Some(vec![3]), Some(vec![4])]);
    }
    #[test]
    fn empty_has_free_agent() {
        assert_eq!(
            build_cid_to_name(&[], 24).get(&u32::MAX).unwrap(),
            "Free Agent"
        );
    }
}
