//! FM24 sequential UTF-8 name tables. Empty and punctuation rows advance the cursor.
use crate::parser::u32_at;
use std::collections::{HashMap, HashSet};
pub type NameMap = HashMap<u32, String>;
fn entry(data: &[u8], p: usize, end: usize) -> Option<(String, u32, usize)> {
    let n = u32_at(data, p)? as usize;
    if n > 80 || p + 8 + n > end {
        return None;
    }
    let s = std::str::from_utf8(data.get(p + 4..p + 4 + n)?).ok()?;
    if s.chars().any(|c| c.is_control()) {
        return None;
    }
    let id = u32_at(data, p + 4 + n)?;
    if id == 0 || id >= 1_000_000 {
        return None;
    }
    Some((s.into(), id, p + 8 + n))
}
pub fn build_name_tables_ex(data: &[u8]) -> (NameMap, NameMap, NameMap) {
    let n = data.len();
    if n < 16 {
        return Default::default();
    }
    let mut end = n * 70 / 100;
    let hard = n * 90 / 100;
    let mut pos = n * 40 / 100;
    let mut blocks: Vec<(usize, usize, u32, u32)> = Vec::new();
    while pos < end {
        let mut ce = (pos + 10_000_000).min(end);
        let mut i = pos;
        while i + 8 <= ce {
            let mut j = i;
            let mut count = 0;
            let mut alpha = 0;
            let mut lo = u32::MAX;
            let mut hi = 0;
            let mut last = j;
            while j + 8 < ce {
                if let Some((s, id, next)) = entry(data, j, ce) {
                    if count > 0 && hi > 50000 && (id as f64) < hi as f64 * 0.3 {
                        break;
                    }
                    count += 1;
                    alpha += usize::from(s.chars().any(char::is_alphabetic));
                    lo = lo.min(id);
                    hi = hi.max(id);
                    last = j;
                    j = next;
                } else {
                    break;
                }
            }
            if count >= 20 && alpha >= 10 {
                blocks.push((i, last, lo, hi));
                i = (i + 1).max(j);
                if last > end.saturating_sub(3_000_000) && end < hard {
                    end = hard.min(end + n * 5 / 100);
                    ce = (pos + 10_000_000).min(end)
                }
            } else {
                i += 1
            }
        }
        pos = if ce < end {
            (pos + 1).max(ce.saturating_sub(88))
        } else {
            ce
        };
    }
    if blocks.is_empty() {
        return Default::default();
    }
    let mut split = None;
    let mut max = 0;
    for (k, b) in blocks.iter().enumerate() {
        if k > 0 && max > 50000 && (b.2 as f64) < max as f64 * 0.3 {
            split = Some(k);
            break;
        }
        max = max.max(b.3)
    }
    if split.is_none() {
        for k in 0..blocks.len().saturating_sub(1) {
            if blocks[k + 1].0.saturating_sub(blocks[k].1) <= 50 {
                continue;
            }
            let collect = |b: (usize, usize, u32, u32)| {
                let mut ids = HashSet::new();
                let mut j = b.0;
                while j < b.1 + 200 && ids.len() < 200 {
                    if let Some((_, id, next)) = entry(data, j, n) {
                        ids.insert(id);
                        j = next
                    } else {
                        break;
                    }
                }
                ids
            };
            if !collect(blocks[k]).is_disjoint(&collect(blocks[k + 1])) {
                split = Some(k + 1);
                break;
            }
        }
    }
    let split = split.unwrap_or(blocks.len() / 2);
    let (mut first, mut sur, mut common) = (NameMap::new(), NameMap::new(), NameMap::new());
    let mut in_common = false;
    let mut max = 0;
    for (k, b) in blocks.iter().enumerate() {
        let mut j = b.0;
        while j < b.1 + 200 {
            if let Some((s, id, next)) = entry(data, j, n) {
                if k >= split {
                    if !in_common && max > 50000 && (id as f64) < max as f64 * 0.3 {
                        in_common = true
                    }
                    max = max.max(id)
                }
                if s.chars().any(char::is_alphabetic) {
                    let target = if k < split {
                        &mut first
                    } else if in_common {
                        &mut common
                    } else {
                        &mut sur
                    };
                    target.entry(id).or_insert(s);
                }
                j = next
            } else {
                break;
            }
        }
    }
    (first, sur, common)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn short_input() {
        assert!(build_name_tables_ex(b"foo").0.is_empty());
    }
}

#[cfg(test)]
mod regression_tests {
    use super::*;
    fn entry(name: &str, id: u32) -> Vec<u8> {
        let mut d = Vec::new();
        d.extend((name.len() as u32).to_le_bytes());
        d.extend(name.as_bytes());
        d.extend(id.to_le_bytes());
        d
    }
    #[test]
    fn punctuation_and_empty_rows_preserve_nearby_regen_names() {
        let mut p = Vec::new();
        for i in 1..81 {
            p.extend(entry(&format!("First{i}"), i))
        }
        for i in 245970..245989 {
            p.extend(entry(&format!("First{i}"), i))
        }
        for (n, id) in [("", 245989), ("Olric", 245990), ("k", 245991), ("", 245992)] {
            p.extend(entry(n, id))
        }
        for i in 245993..246060 {
            p.extend(entry(if i == 246002 { "Tejay" } else { "First" }, i))
        }
        for i in 1..81 {
            p.extend(entry(&format!("Surname{i}"), i))
        }
        for i in 542060..542085 {
            p.extend(entry("Surname", i))
        }
        for (n, id) in [
            ("()", 542085),
            ("Piric-Bego", 542086),
            ("Betrancourt", 542087),
            ("Davies", 542089),
            ("McGrann", 542090),
        ] {
            p.extend(entry(n, id))
        }
        for i in 542091..542150 {
            p.extend(entry("Surname", i))
        }
        for i in 1..81 {
            p.extend(entry("Nickname", i))
        }
        let n = p.len() * 4;
        let mut d = vec![254; n / 2];
        d.extend(p);
        d.resize(n, 254);
        let (f, s, c) = build_name_tables_ex(&d);
        assert_eq!(f[&246002], "Tejay");
        assert_eq!(s[&542090], "McGrann");
        assert_eq!(f[&1], "First1");
        assert_eq!(s[&1], "Surname1");
        assert_eq!(c[&1], "Nickname");
    }
}
