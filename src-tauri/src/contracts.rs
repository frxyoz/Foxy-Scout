use chrono::{Datelike, Duration, NaiveDate};
use serde_json::{json, Value};
fn u16_at(d: &[u8], p: usize) -> Option<u16> {
    Some(u16::from_le_bytes(d.get(p..p + 2)?.try_into().ok()?))
}
fn u32_at(d: &[u8], p: usize) -> Option<u32> {
    Some(u32::from_le_bytes(d.get(p..p + 4)?.try_into().ok()?))
}
pub fn wage_constant(fm_version: i32) -> f64 {
    if fm_version >= 27 {
        70.0777
    } else if fm_version >= 26 {
        70.2286
    } else {
        64.96525
    }
}
fn condition(kind: u16) -> Option<&'static str> {
    match kind {
        0 => Some("Minimum fee"),
        1 => Some("Relegation"),
        2 => Some("Non-promotion"),
        16 => Some("Foreign clubs"),
        17 => Some("Domestic higher division"),
        18 => Some("Domestic clubs"),
        _ => None,
    }
}
pub fn read_release_clauses(
    data: &[u8],
    anchor: usize,
    lo: usize,
    hi: usize,
    fm_version: i32,
) -> Option<Vec<Value>> {
    if fm_version != 24 || !(lo <= anchor && anchor < hi && hi <= data.len()) {
        return None;
    }
    let marker = [255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0];
    let start = lo.max(anchor.saturating_sub(600));
    let mut pos = anchor;
    while pos >= start + marker.len() {
        let at = data
            .get(start..pos)?
            .windows(marker.len())
            .rposition(|w| w == marker)
            .map(|v| v + start)?;
        pos = at;
        if at + 12 > anchor {
            continue;
        }
        let count = data[at + 11] as usize;
        let row_start = at + 12;
        if count > 64 || row_start + count * 8 > anchor {
            continue;
        }
        let mut rows = Vec::new();
        let mut valid = true;
        for i in 0..count {
            let p = row_start + i * 8;
            let amount = u32_at(data, p)?;
            let parameter = u16_at(data, p + 4)?;
            let kind = u16_at(data, p + 6)?;
            if kind > 0x3f {
                valid = false;
                break;
            }
            if let Some(label) = condition(kind) {
                if amount != 0 && amount != u32::MAX {
                    rows.push(json!({"kind":kind,"condition":label,"amount_raw":amount,"amount_usd":(amount as f64*wage_constant(24)/52.0).round_ties_even() as i64,"parameter":if parameter==u16::MAX{Value::Null}else{json!(parameter)}}));
                }
            }
        }
        if valid {
            return Some(rows);
        }
    }
    None
}
pub fn find_anchor(data: &[u8], lo: usize, hi: usize) -> Option<usize> {
    let tail = [3, 4, 0, 0, 0];
    if lo >= hi || hi > data.len() {
        return None;
    }
    for k in lo + 1..hi.saturating_sub(4) {
        if data.get(k..k + 5) != Some(tail.as_slice()) {
            continue;
        }
        let a = k - 1;
        if a + 48 > data.len() || data.get(a + 12..a + 14) != Some(&[0, 0]) {
            continue;
        }
        let day = u16_at(data, a + 26)?;
        let year = u16_at(data, a + 28)?;
        if (day == 2 && year == 1900) || ((1..=366).contains(&day) && (1990..=2200).contains(&year))
        {
            return Some(a);
        }
    }
    None
}
fn formatted(day: u16, year: u16) -> Option<String> {
    let date = NaiveDate::from_ymd_opt(year as i32, 1, 1)?
        .checked_add_signed(Duration::days(day as i64 - 1))?;
    if date.year() != year as i32 {
        return None;
    }
    Some(date.format("%d/%m/%Y").to_string())
}
pub fn read_contract(data: &[u8], anchor: usize, hi: usize, fm_version: i32) -> Value {
    let mut out = json!({"contract_offset":anchor,"contract_end":null,"contract_end_day":0,"contract_end_year":0,"contract_type":null,"contract_listing_flags":null,"wage":0,"wage_bonus":0,"wage_annual_usd":0,"contract_start_season":0,"release_clauses":read_release_clauses(data,anchor,anchor.saturating_sub(600),hi,fm_version)});
    let Some(day) = u16_at(data, anchor + 26) else {
        return out;
    };
    let Some(year) = u16_at(data, anchor + 28) else {
        return out;
    };
    out["contract_start_season"] = json!(u16_at(data, anchor + 10).unwrap_or(0));
    if day == 2 && year == 1900 {
        out["contract_type"] = json!("Month To Month")
    } else if (1..=366).contains(&day) {
        if let Some(s) = formatted(day, year) {
            out["contract_end"] = json!(s);
            out["contract_end_day"] = json!(day);
            out["contract_end_year"] = json!(year);
            out["contract_type"] = json!("Full Contract")
        }
    }
    // FM24's contract core starts at anchor + 14. Its listing bitfield is
    // core byte 23 (before the variable-length contract event ring).
    // Bits 0 and 1 indicate transfer and loan listings independently.
    // Layout cross-check: https://github.com/Napas/fm-mcp/blob/main/docs/format/contracts.md
    // Local FM24 bytes match that layout; an independent in-game comparison
    // of FM24 listing labels is still pending.
    if fm_version == 24 && !out["contract_type"].is_null() && anchor + 44 <= hi {
        if let Some(flags) = data.get(anchor + 37).filter(|b| **b != u8::MAX) {
            out["contract_listing_flags"] = json!(flags);
        }
    }
    let mut p = anchor + 44;
    let mut count = 0;
    while p < hi && data.get(p) == Some(&7) {
        p += 29;
        count += 1;
        if count > 400 {
            return out;
        }
    }
    if p + 41 <= hi {
        if let Some(wage) = u32_at(data, p + 37).filter(|w| *w > 0 && *w < 100_000_000) {
            out["wage"] = json!(wage);
            out["wage_annual_usd"] =
                json!((wage as f64 * wage_constant(fm_version)).round_ties_even() as i64);
            out["wage_bonus"] = json!(u32_at(data, p + 25).unwrap_or(0));
        }
    }
    out
}
pub fn extract_contracts_v2(data: &[u8], records: &mut [Value], fm_version: i32, _game_year: i32) {
    let size = if fm_version >= 26 { 106 } else { 105 };
    let club_off = if fm_version >= 26 { 16 } else { 15 };
    let mut offsets: Vec<usize> = records
        .iter()
        .filter_map(|r| r["offset"].as_u64().map(|v| v as usize))
        .collect();
    offsets.sort_unstable();
    for rec in records {
        for (k,v)in json!({"release_clauses":null,"contract_end":null,"contract_end_day":0,"contract_end_year":0,"contract_type":null,"contract_offset":null,"contract_listing_flags":null,"contract_start_season":0,"wage":0,"wage_annual_usd":0,"wage_bonus":0,"signed":null}).as_object().unwrap(){rec[k]=v.clone()}
        let off = rec["offset"].as_u64().unwrap_or(0) as usize;
        if off + size >= data.len() {
            continue;
        }
        if u32_at(data, off + club_off) == Some(u32::MAX) {
            rec["contract_type"] = json!("None");
            continue;
        }
        let j = offsets.partition_point(|v| *v <= off);
        let next = offsets.get(j).copied().unwrap_or(off + 4000);
        let hi = next.min(off + 16000).min(data.len().saturating_sub(48));
        let lo = off + size;
        if hi <= lo {
            continue;
        }
        if let Some(anchor) = find_anchor(data, lo, hi) {
            let out = read_contract(data, anchor, hi, fm_version);
            for (k, v) in out.as_object().unwrap() {
                rec[k] = v.clone()
            }
            let clause_hi = rec["obj_end"]
                .as_u64()
                .filter(|v| *v > 0)
                .map(|v| v as usize)
                .unwrap_or(hi)
                .min(hi);
            rec["release_clauses"] = json!(read_release_clauses(
                data, anchor, lo, clause_hi, fm_version
            ));
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fm24_contract_listing_flags_are_before_the_event_ring() {
        // Local FM24 contract prefixes covering low flag bits 0, 1, 2, 3.
        // These check extraction, not independent in-game label verification.
        for (hex, flags) in [
            ("ff030400000000000000f007000000000000ffffffffffffffff6e01f007c12cea0701010300000000000000", 0),
            ("ff030400000000000000ee07000080730000ffffffffffffffffb600f007a800e6071616030107000a000000", 1),
            ("ff030400000007000000ee0700002d000000d80500000c180000b600f0075700e807070e0a02000503000000", 2),
            ("ff030400000004030000ed070000a0060000ffffffffffffffffb600f007e72eec0716160703050304000000", 3),
        ] {
            let bytes: Vec<u8> = (0..hex.len()).step_by(2)
                .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap()).collect();
            let result = read_contract(&bytes, 0, bytes.len(), 24);
            assert_eq!(result["contract_listing_flags"], flags);
            assert!(read_contract(&bytes, 0, 37, 24)["contract_listing_flags"].is_null());
            assert!(read_contract(&bytes, 0, bytes.len(), 26)["contract_listing_flags"].is_null());
        }
        let bytes = vec![0; 44];
        assert!(read_contract(&bytes, 0, bytes.len(), 24)["contract_listing_flags"].is_null());
    }
    #[test]
    fn clauses_exclude_bonus() {
        let mut d = vec![0; 105];
        d.extend([255; 8]);
        d.extend([0; 3]);
        d.push(2);
        for (v, k) in [(1200u32, 0x26u16), (10_000_000, 0)] {
            d.extend(v.to_le_bytes());
            d.extend(u16::MAX.to_le_bytes());
            d.extend(k.to_le_bytes())
        }
        d.extend([0; 7]);
        let anchor = d.len();
        d.extend([0; 76]);
        let r = read_release_clauses(&d, anchor, 105, d.len(), 24).unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0]["amount_raw"], 10_000_000);
        assert!(read_release_clauses(&d, anchor, anchor, d.len(), 24).is_none());
    }
    #[test]
    fn leap_dates() {
        assert_eq!(formatted(366, 2032).as_deref(), Some("31/12/2032"));
        assert_eq!(formatted(366, 2031), None);
    }
}
/// Original reader's compatibility fallback for saves with few structural headers.
pub fn legacy_fallback(data: &[u8], records: &mut [Value], fm_version: i32, game_year: i32) {
    let yr_lo = 2020.max(game_year - 5);
    let yr_hi = 2050.max(game_year + 15);
    let record_size = if fm_version >= 26 { 106 } else { 105 };
    for rec in records {
        rec["contract_end"] = Value::Null;
        rec["contract_end_year"] = json!(0);
        rec["contract_end_day"] = json!(0);
        let off = rec["offset"].as_u64().unwrap_or(0) as usize;
        let end = (off + 5000).min(data.len().saturating_sub(12));
        if off < end {
            for idx in off..end.saturating_sub(11) {
                if data.get(idx..idx + 8) != Some(&[255; 8]) {
                    continue;
                }
                let day = u16_at(data, idx + 8).unwrap_or(0);
                let year = u16_at(data, idx + 10).unwrap_or(0);
                if (1..=366).contains(&day) && (yr_lo..=yr_hi).contains(&(year as i32)) {
                    if let Some(dt) = NaiveDate::from_ymd_opt(year as i32, 1, 1)
                        .and_then(|d| d.checked_add_signed(Duration::days(day as i64 - 1)))
                    {
                        rec["contract_end"] = json!(dt.format("%d/%m/%Y").to_string());
                        rec["contract_end_year"] = json!(year);
                        rec["contract_end_day"] = json!(day);
                        break;
                    }
                }
            }
        }
        rec["wage"] = json!(0);
        rec["wage_bonus"] = json!(0);
        rec["signed"] = Value::Null;
        let start = off + record_size;
        let end = (start + 5000).min(data.len().saturating_sub(70));
        if start >= end {
            continue;
        }
        let ce_day = rec["contract_end_day"].as_i64().unwrap_or(0);
        let ce_year = rec["contract_end_year"].as_i64().unwrap_or(0);
        let ce_ord = ce_year * 366 + ce_day;
        let mut best: Option<(i64, u32, u32, Value)> = None;
        for idx in start..end.saturating_sub(70) {
            if data.get(idx..idx + 8) != Some(&[255; 8])
                || data.get(idx + 46..idx + 50) != Some(&[1, 0, 108, 7])
            {
                continue;
            }
            let day = u16_at(data, idx + 8).unwrap_or(0);
            let year = u16_at(data, idx + 10).unwrap_or(0);
            if !(1..=366).contains(&day) || !(yr_lo..=yr_hi).contains(&(year as i32)) {
                continue;
            }
            let wage = u32_at(data, idx + 63).unwrap_or(0);
            if wage < 100 {
                continue;
            }
            let bonus = u32_at(data, idx + 51).unwrap_or(0);
            let sd = u16_at(data, idx + 12).unwrap_or(0);
            let sy = u16_at(data, idx + 14).unwrap_or(0);
            let signed = if (1..=366).contains(&sd) && (2000..=yr_hi).contains(&(sy as i32)) {
                NaiveDate::from_ymd_opt(sy as i32, 1, 1)
                    .and_then(|d| d.checked_add_signed(Duration::days(sd as i64 - 1)))
                    .map(|dt| json!(dt.format("%d/%m/%Y").to_string()))
                    .unwrap_or(Value::Null)
            } else {
                Value::Null
            };
            let dist = if ce_day != 0 && ce_year != 0 {
                (year as i64 * 366 + day as i64 - ce_ord).abs()
            } else {
                0
            };
            if best.as_ref().is_none_or(|b| dist < b.0) {
                best = Some((dist, wage, bonus, signed));
            }
        }
        if let Some((_, wage, bonus, signed)) = best {
            rec["wage"] = json!(wage);
            rec["wage_bonus"] = json!(bonus);
            rec["signed"] = signed;
        }
    }
}
