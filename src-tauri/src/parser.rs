//! Checked, read-only FM24 binary decoding. No unsafe memory access.
use crate::names::{build_name_tables_ex, NameMap};
use chrono::{Datelike, Duration, NaiveDate};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeSet, HashMap, HashSet},
    io::Read,
    path::Path,
};
pub const ATTRS: [&str; 54] = [
    "Cro", "Dri", "Fin", "Hea", "LS", "Mar", "OTB", "Pas", "PT", "Tac", "Vis", "Han", "AA", "CoA",
    "Comm", "Kic", "Thr", "Ant", "Dec", "1v1", "Pos", "Ref", "FT", "Tec", "LF", "RF", "Fla", "Cor",
    "TW", "WR", "LT", "Ecc", "RO", "TTP", "Acc", "FK", "Str", "Sta", "Pac", "JR", "Lea", "Dirt",
    "Bal", "Bra", "Consis", "Agg", "Agi", "ImpM", "InjP", "Vers", "NF", "Det", "Com", "Con",
];
pub const POSITIONS: [&str; 15] = [
    "GK", "SW", "DL", "DC", "DR", "DM", "ML", "MC", "MR", "AML", "AMC", "AMR", "ST", "WBL", "WBR",
];
const PERS: [&str; 8] = [
    "Adapt", "Ambi", "Loyal", "Press", "Prof", "Sport", "Contr", "Tempr",
];
const TAIL: &[u8] = b"\x01\x00\x6c\x07";
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub players: Vec<Value>,
    pub staff: Vec<Value>,
    pub game_year: i32,
    pub game_date: String,
    pub fm_version: i32,
}
pub fn u16_at(d: &[u8], p: usize) -> Option<u16> {
    Some(u16::from_le_bytes(
        d.get(p..p.checked_add(2)?)?.try_into().ok()?,
    ))
}
pub fn u32_at(d: &[u8], p: usize) -> Option<u32> {
    Some(u32::from_le_bytes(
        d.get(p..p.checked_add(4)?)?.try_into().ok()?,
    ))
}
pub fn number(v: &Value, key: &str) -> usize {
    v[key].as_u64().unwrap_or(0) as usize
}
pub fn matches(d: &[u8], p: usize, b: &[u8]) -> bool {
    d.get(p..p.saturating_add(b.len())) == Some(b)
}
pub fn find_all(d: &[u8], needle: &[u8]) -> Vec<usize> {
    memchr::memmem::find_iter(d, needle).collect()
}
fn decode(d: &[u8]) -> Result<Vec<u8>, String> {
    let dec = zstd::stream::read::Decoder::new(d).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    dec.take(500 * 1024 * 1024 + 1)
        .read_to_end(&mut out)
        .map_err(|e| e.to_string())?;
    if out.len() > 500 * 1024 * 1024 {
        return Err("Decompressed frame exceeds 500 MiB".into());
    }
    Ok(out)
}
pub fn decompress_save(path: &Path) -> Result<(Vec<u8>, i32, NaiveDate, i32), String> {
    let size = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > 2 * 1024 * 1024 * 1024 {
        return Err("Compressed save exceeds 2 GiB safety limit".into());
    }
    let raw = std::fs::read(path).map_err(|e| e.to_string())?;
    let fs = find_all(&raw, b"\x28\xb5\x2f\xfd");
    if fs.is_empty() {
        return Err("No zstd frames found. Invalid FM save?".into());
    }
    let frame = |i: usize| decode(&raw[fs[i]..fs.get(i + 1).copied().unwrap_or(raw.len())]);
    let mut detected_version = None;
    if let Ok(header) = frame(0) {
        let re = regex::bytes::Regex::new(r"(\d\d)\.\d+\.\d+\+").unwrap();
        if let Some(c) = re.captures(&header[..header.len().min(200)]) {
            let v = std::str::from_utf8(&c[1])
                .ok()
                .and_then(|s| s.parse::<i32>().ok());
            detected_version = v.filter(|v| [24, 26, 27].contains(v));
        }
    }
    let mut data = Vec::new();
    if fs.len() > 3 {
        if let Ok(d) = frame(3) {
            if detected_version.is_none() {
                let tag = d.get(26..30).unwrap_or_default();
                if tag.len() == 4 && tag.iter().all(u8::is_ascii_digit) {
                    detected_version = std::str::from_utf8(&tag[..2])
                        .ok()
                        .and_then(|s| s.parse::<i32>().ok())
                        .filter(|v| [24, 26, 27].contains(v));
                }
                if detected_version.is_none() {
                    let header = &d[..d.len().min(100)];
                    if memchr::memmem::find(header, b"2600").is_some() {
                        detected_version = Some(26)
                    } else if memchr::memmem::find(header, b"2400").is_some() {
                        detected_version = Some(24)
                    }
                }
            }
            if find_all(&d, TAIL).len() > 1000 {
                data = d;
            }
        }
    }
    let version = detected_version.unwrap_or(24);
    if version != 24 {
        return Err(
            "This edition supports Football Manager 2024 saves only. Select an FM24 .fm file."
                .into(),
        );
    }
    if data.is_empty() {
        for i in 0..fs.len() {
            if let Ok(d) = frame(i) {
                if data.len().saturating_add(d.len()) > 2 * 1024 * 1024 * 1024 {
                    return Err("Decompressed save exceeds 2 GiB safety limit".into());
                }
                data.extend(d)
            }
        }
        if find_all(&data, TAIL).len() < 100 {
            return Err("Too few player markers. Invalid FM save?".into());
        }
    }
    let year = u16_at(&data, 38)
        .filter(|v| (2023..=2160).contains(v))
        .or_else(|| {
            (0..data.len().min(200).saturating_sub(1))
                .step_by(2)
                .filter_map(|p| u16_at(&data, p))
                .find(|v| (2023..=2160).contains(v))
        })
        .unwrap_or(2024) as i32;
    let day = u16_at(&data, 36).unwrap_or(0) & 511;
    let date = if (1..=366).contains(&day) {
        NaiveDate::from_ymd_opt(year, 1, 1).unwrap() + Duration::days(day as i64 - 1)
    } else {
        NaiveDate::from_ymd_opt(year, 7, 1).unwrap()
    };
    Ok((data, year, date, version))
}
#[derive(Debug, Clone, Copy)]
pub struct Boundary {
    pub site: usize,
    pub id: u32,
    pub index: u32,
}
pub fn find_object_boundaries(d: &[u8]) -> Vec<Boundary> {
    let mut loose = Vec::new();
    for s in 20..d.len().saturating_sub(200) {
        if d[s - 7] != 0
            || d[s - 6] != 0
            || d[s - 5] != 0
            || d[s + 8] > 16
            || d[s..s + 4] != d[s + 4..s + 8]
        {
            continue;
        }
        let id = u32_at(d, s).unwrap();
        if id > 0 && id < 0x7fffffff {
            loose.push(Boundary {
                site: s,
                id,
                index: u32_at(d, s - 4).unwrap(),
            })
        }
    }
    let plausible: Vec<Boundary> = loose
        .iter()
        .copied()
        .filter(|b| {
            let yr = u16_at(d, b.site - 14).unwrap();
            let day = u16_at(d, b.site - 16).unwrap();
            (1990..=2200).contains(&yr) && day > 0 && day <= 60000
        })
        .collect();
    let mut tails: Vec<usize> = Vec::new();
    let mut vals = Vec::new();
    let mut parent = vec![usize::MAX; plausible.len()];
    for (i, b) in plausible.iter().enumerate() {
        let k = vals.partition_point(|v| *v < b.index);
        if k > 0 {
            parent[i] = tails[k - 1]
        }
        if k == tails.len() {
            tails.push(i);
            vals.push(b.index)
        } else {
            tails[k] = i;
            vals[k] = b.index
        }
    }
    let mut keep = Vec::new();
    let mut i = tails.last().copied().unwrap_or(usize::MAX);
    while i != usize::MAX {
        keep.push(plausible[i]);
        i = parent[i]
    }
    keep.reverse();
    let mut additions = Vec::new();
    for pair in keep.windows(2) {
        if pair[1].index.saturating_sub(pair[0].index) > 1 {
            let lo = loose.partition_point(|b| b.site <= pair[0].site);
            if let Some(b) = loose[lo..]
                .iter()
                .take_while(|b| b.site < pair[1].site)
                .find(|b| b.index == pair[1].index - 1)
            {
                additions.push(*b)
            }
        }
    }
    keep.extend(additions);
    keep.sort_by_key(|b| b.site);
    keep
}
fn shape(d: &[u8], p: usize) -> bool {
    p + 98 <= d.len()
        && (1..=200).contains(&u16_at(d, p).unwrap_or(0))
        && d[p + 23..p + 38].iter().all(|v| (1..=20).contains(v))
        && d[p + 38..p + 92].iter().all(|v| (1..=100).contains(v))
}
fn nickname(d: &[u8], end: usize) -> Option<String> {
    if ![89, 93, 97].iter().all(|p| matches(d, end + p, TAIL)) {
        return None;
    }
    let n = u32_at(d, end + 101)? as usize;
    if !(2..=80).contains(&n) {
        return None;
    }
    valid_text(d.get(end + 105..end + 105 + n)?)
}
fn valid_text(d: &[u8]) -> Option<String> {
    let s = std::str::from_utf8(d).ok()?;
    if s.chars().all(|c| !c.is_control()) && s.chars().any(char::is_alphabetic) {
        Some(s.into())
    } else {
        None
    }
}
pub fn extract_attribute_records(d: &[u8], boundaries: &[Boundary]) -> Vec<Value> {
    let mut strict = Vec::new();
    let mut near = Vec::new();
    let mut relaxed = Vec::new();
    for ix in find_all(d, TAIL) {
        if ix < 101 {
            continue;
        }
        let p = ix - 101;
        if !shape(d, p) {
            continue;
        }
        let pa = u16_at(d, p + 2).unwrap() as i16;
        if !(-10..=200).contains(&pa) {
            continue;
        }
        let n = d[p + 38..p + 92].iter().filter(|v| **v % 5 == 0).count();
        if n == 54 {
            strict.push(p)
        } else if n >= 45 {
            near.push(p)
        } else {
            relaxed.push(p)
        }
    }
    let demo = strict.len() > 5000;
    let mut chosen: BTreeSet<usize> = strict.into_iter().chain(near).collect();
    let mut pre = HashMap::new();
    for p in relaxed {
        if !demo {
            chosen.insert(p);
        } else if let Some(n) = nickname(d, p + 105) {
            chosen.insert(p);
            pre.insert(p, n);
        }
    }
    let mut objects: HashMap<usize, (u32, usize)> = HashMap::new();
    for pair in boundaries.windows(2) {
        let p = pair[0].site + 15;
        let e = pair[1].site.saturating_sub(16);
        if pair[1].index.checked_sub(pair[0].index) == Some(1)
            && (98..=20000).contains(&e.saturating_sub(p))
            && shape(d, p)
        {
            objects.insert(p, (pair[1].id, e));
            chosen.insert(p);
        }
    }
    let mut taken: HashSet<u32> = objects.values().map(|v| v.0).collect();
    for pair in boundaries.windows(2) {
        let p = pair[0].site + 15;
        if !chosen.contains(&p) || objects.contains_key(&p) {
            continue;
        }
        if pair[1].index.checked_sub(pair[0].index) == pair[1].id.checked_sub(pair[0].id) {
            let uid = pair[0].id + 1;
            if taken.insert(uid) {
                objects.insert(p, (uid, 0));
            }
        }
    }
    chosen.into_iter().map(|p|{let(uid,e)=objects.get(&p).copied().unwrap_or((0,0));let mut pos=serde_json::Map::new();let mut attrs=serde_json::Map::new();let mut best=0;for(i,k)in POSITIONS.iter().enumerate(){let v=d[p+23+i];pos.insert((*k).into(),json!(v));if v>d[p+23+best]{best=i}}for(i,k)in ATTRS.iter().enumerate(){attrs.insert((*k).into(),json!((d[p+38+i]as f64/5.).round()as u8));}let foot=if attrs["LF"].as_u64()>attrs["RF"].as_u64(){"L"}else if attrs["LF"].as_u64()<attrs["RF"].as_u64(){"R"}else{"E"};let(mut h,mut w)=(0,0);if p+127<d.len(){h=d[p+122];w=d[p+120];}let mut v=json!({"offset":p,"obj_end":e,"uid":uid,"ca":u16_at(d,p).unwrap(),"pa":u16_at(d,p+2).unwrap()as i16,"reputation":d[p+8],"positions":pos,"best_position":if d[p+23+best]>1{POSITIONS[best]}else{"?"},"attributes":attrs,"height":h,"weight":w,"foot":foot,"gender":"M"});if let Some(n)=pre.get(&p){v["name"]=json!(n)}v}).collect()
}

pub fn nation(id: i32) -> String {
    match id {
        0 => "ALG".into(),
        1 => "ANG".into(),
        2 => "BEN".into(),
        4 => "BFA".into(),
        6 => "CMR".into(),
        7 => "CPV".into(),
        9 => "CTA".into(),
        10 => "CHD".into(),
        11 => "EGY".into(),
        12 => "EQG".into(),
        13 => "ERI".into(),
        14 => "GAB".into(),
        15 => "GAM".into(),
        16 => "GHA".into(),
        17 => "GUI".into(),
        18 => "GNB".into(),
        19 => "CIV".into(),
        20 => "KEN".into(),
        21 => "LES".into(),
        22 => "LBR".into(),
        23 => "LBY".into(),
        24 => "MAD".into(),
        25 => "MWI".into(),
        26 => "MLI".into(),
        27 => "MRT".into(),
        28 => "MRI".into(),
        29 => "MAR".into(),
        30 => "MOZ".into(),
        31 => "NAM".into(),
        32 => "NIG".into(),
        33 => "NGA".into(),
        34 => "RWA".into(),
        35 => "STP".into(),
        36 => "SEN".into(),
        37 => "SEY".into(),
        38 => "SLE".into(),
        39 => "SOM".into(),
        40 => "RSA".into(),
        41 => "SSD".into(),
        42 => "SWZ".into(),
        43 => "TAN".into(),
        44 => "CGO".into(),
        45 => "TOG".into(),
        46 => "TUN".into(),
        47 => "UGA".into(),
        48 => "COD".into(),
        49 => "ZAM".into(),
        50 => "ZIM".into(),
        51 => "AFG".into(),
        55 => "CHN".into(),
        56 => "TPE".into(),
        57 => "IND".into(),
        58 => "IDN".into(),
        59 => "IRN".into(),
        60 => "IRQ".into(),
        61 => "JPN".into(),
        62 => "JOR".into(),
        63 => "PRK".into(),
        64 => "KAZ".into(),
        65 => "KUW".into(),
        66 => "KGZ".into(),
        67 => "LAO".into(),
        68 => "LBN".into(),
        69 => "MAC".into(),
        70 => "MAS".into(),
        71 => "MDV".into(),
        72 => "MNG".into(),
        73 => "MYA".into(),
        74 => "NEP".into(),
        75 => "OMA".into(),
        76 => "PAK".into(),
        77 => "QAT".into(),
        78 => "KSA".into(),
        79 => "SIN".into(),
        80 => "KOR".into(),
        81 => "SRI".into(),
        82 => "SYR".into(),
        83 => "TJK".into(),
        84 => "TKM".into(),
        85 => "THA".into(),
        86 => "PHI".into(),
        87 => "VIE".into(),
        88 => "UAE".into(),
        89 => "UZB".into(),
        90 => "YEM".into(),
        91 => "HKG".into(),
        92 => "MSR".into(),
        93 => "BHR".into(),
        94 => "BAR".into(),
        95 => "BLZ".into(),
        96 => "BER".into(),
        97 => "CAN".into(),
        98 => "CAY".into(),
        99 => "CRC".into(),
        100 => "CUB".into(),
        101 => "CUW".into(),
        102 => "SLV".into(),
        103 => "GRN".into(),
        104 => "GUA".into(),
        105 => "GUY".into(),
        106 => "HAI".into(),
        107 => "HON".into(),
        108 => "JAM".into(),
        109 => "MEX".into(),
        110 => "AHO".into(),
        111 => "NCA".into(),
        112 => "PAN".into(),
        113 => "PUR".into(),
        114 => "DMA".into(),
        115 => "SKN".into(),
        116 => "AIA".into(),
        117 => "SUR".into(),
        118 => "LCA".into(),
        119 => "TTO".into(),
        120 => "USA".into(),
        121 => "VIR".into(),
        122 => "VGB".into(),
        123 => "ATG".into(),
        124 => "BOT".into(),
        125 => "BRU".into(),
        126 => "ALB".into(),
        127 => "AND".into(),
        128 => "ARM".into(),
        129 => "AUT".into(),
        130 => "AZE".into(),
        131 => "BEL".into(),
        132 => "BLR".into(),
        133 => "BIH".into(),
        134 => "BUL".into(),
        135 => "CRO".into(),
        136 => "CYP".into(),
        137 => "CZE".into(),
        138 => "DEN".into(),
        139 => "ENG".into(),
        140 => "EST".into(),
        141 => "FRO".into(),
        142 => "FIN".into(),
        143 => "FRA".into(),
        144 => "GEO".into(),
        145 => "GER".into(),
        146 => "GRE".into(),
        147 => "HUN".into(),
        148 => "ISL".into(),
        149 => "ISR".into(),
        150 => "ITA".into(),
        151 => "LAT".into(),
        152 => "LIE".into(),
        153 => "LTU".into(),
        154 => "LUX".into(),
        155 => "MKD".into(),
        156 => "MLT".into(),
        157 => "MDA".into(),
        158 => "NED".into(),
        159 => "NIR".into(),
        160 => "NOR".into(),
        161 => "POL".into(),
        162 => "POR".into(),
        163 => "IRL".into(),
        164 => "ROU".into(),
        165 => "RUS".into(),
        166 => "SMR".into(),
        167 => "SCO".into(),
        168 => "SVK".into(),
        169 => "SVN".into(),
        170 => "ESP".into(),
        171 => "SWE".into(),
        172 => "SUI".into(),
        173 => "TUR".into(),
        174 => "UKR".into(),
        175 => "WAL".into(),
        176 => "SRB".into(),
        177 => "AUS".into(),
        178 => "FIJ".into(),
        179 => "NCL".into(),
        180 => "NZL".into(),
        181 => "PNG".into(),
        182 => "SAM".into(),
        183 => "SOL".into(),
        184 => "TAH".into(),
        185 => "TON".into(),
        186 => "VAN".into(),
        187 => "ARG".into(),
        188 => "BOL".into(),
        189 => "BRA".into(),
        190 => "CHI".into(),
        191 => "COL".into(),
        192 => "ECU".into(),
        193 => "PAR".into(),
        194 => "PER".into(),
        195 => "URU".into(),
        196 => "VEN".into(),
        197 => "PAL".into(),
        198 => "BAN".into(),
        199 => "CAM".into(),
        207 => "GUM".into(),
        210 => "SUD".into(),
        212 => "DOM".into(),
        216 => "GIB".into(),
        219 => "KOS".into(),
        226 => "GLP".into(),
        227 => "MTQ".into(),
        228 => "GUF".into(),
        234 => "COM".into(),
        236 => "STP".into(),
        247 => "MNE".into(),
        248 => "SSU".into(),
        // Unknown database IDs are not nationality labels.
        _ => String::new(),
    }
}
#[derive(Clone, Debug)]
pub struct NameEntry {
    pub offset: usize,
    pub name: String,
    pub year: i32,
    pub day: u16,
    pub nation: i32,
    pub pers: Vec<u8>,
}
pub fn build_name_index(d: &[u8], first: &NameMap, sur: &NameMap, year: i32) -> Vec<NameEntry> {
    let mut out = Vec::new();
    for p in find_all(d, b"\xff\xff\xff\xff\x00") {
        if p >= d.len().saturating_sub(30) {
            break;
        }
        let Some(n) = u32_at(d, p + 5) else { continue };
        let n = n as usize;
        if n != 0 && !(2..=80).contains(&n) {
            continue;
        }
        let after = p + 9 + n;
        let inline = if n > 0 {
            let Some(s) = d.get(p + 9..after).and_then(valid_text) else {
                continue;
            };
            s
        } else {
            String::new()
        };
        let Some(day) = u16_at(d, after) else {
            continue;
        };
        let Some(by) = u16_at(d, after + 2) else {
            continue;
        };
        if !(1940..=(year - 14).min(2160)).contains(&(by as i32)) || !(1..=366).contains(&day) {
            continue;
        }
        let mut name = String::new();
        if p >= 10 {
            let f = u32_at(d, p - 10)
                .and_then(|v| v.checked_add(1))
                .and_then(|v| first.get(&v))
                .cloned()
                .unwrap_or_default();
            let s = u32_at(d, p - 5)
                .and_then(|v| v.checked_add(1))
                .and_then(|v| sur.get(&v))
                .cloned()
                .unwrap_or_default();
            name = format!("{} {}", f, s).trim().to_string();
        }
        if name.is_empty() {
            name = inline
        }
        let pers = d
            .get(after + 17..after + 25)
            .filter(|v| v.iter().all(|b| (1..=20).contains(b)))
            .unwrap_or_default()
            .to_vec();
        if name.chars().count() > 1 {
            out.push(NameEntry {
                offset: p,
                name,
                year: by as i32,
                day,
                nation: u16_at(d, after + 9).map(|v| v as i32).unwrap_or(-1),
                pers,
            })
        }
    }
    out
}
pub fn apply_name(r: &mut Value, n: &NameEntry, year: i32) {
    r["name"] = json!(n.name);
    r["birth_year"] = json!(n.year);
    r["age"] = json!(year - n.year);
    r["nation"] = json!(if n.nation >= 0 {
        nation(n.nation)
    } else {
        String::new()
    });
    let date = NaiveDate::from_ymd_opt(n.year, 1, 1).unwrap() + Duration::days(n.day as i64 - 1);
    r["birth_month"] = json!(date.month());
    r["birth_day"] = json!(date.day());
    if n.pers.len() == 8 {
        r["personality"] = json!(PERS
            .iter()
            .zip(n.pers.iter())
            .map(|(k, v)| ((*k).to_string(), json!(v)))
            .collect::<serde_json::Map<String, Value>>());
    }
}
fn birth(r: &mut Value, year: i32, by: i32, day: u16, nid: u16) {
    let n = NameEntry {
        offset: 0,
        name: String::new(),
        year: by,
        day,
        nation: nid as i32,
        pers: Vec::new(),
    };
    let name = r["name"].clone();
    apply_name(r, &n, year);
    if name.is_null() {
        r.as_object_mut().unwrap().remove("name");
    } else {
        r["name"] = name;
    }
}
fn placeholder(r: &mut Value) {
    r["name"] = json!(format!("Player_{}", number(r, "offset")));
    for k in ["birth_year", "age", "birth_month", "birth_day"] {
        r[k] = json!(0)
    }
    r["nation"] = json!("");
}
pub fn resolve_player_names(
    d: &[u8],
    records: &mut [Value],
    first: &NameMap,
    sur: &NameMap,
    common: &NameMap,
    year: i32,
) {
    let names = build_name_index(d, first, sur, year);
    if names.is_empty() {
        for r in records {
            placeholder(r)
        }
        return;
    }
    records.sort_by_key(|r| number(r, "offset"));
    let mut used = HashSet::new();
    for i in 0..records.len() {
        if records[i]["name"]
            .as_str()
            .is_some_and(|s| !s.is_empty() && !s.starts_with("Player_"))
        {
            continue;
        }
        let end = number(&records[i], "offset") + 105;
        let mut next = records
            .get(i + 1)
            .map(|r| number(r, "offset"))
            .unwrap_or(d.len());
        let obj = number(&records[i], "obj_end");
        if obj > 0 {
            next = next.min(obj)
        }
        let lo = names.partition_point(|n| n.offset < end);
        let hi = names.partition_point(|n| n.offset < next);
        let candidates: Vec<usize> = (lo..hi).filter(|j| !used.contains(j)).collect();
        let best = candidates
            .iter()
            .copied()
            .find(|j| u32_at(d, names[*j].offset + 5).is_some_and(|n| (2..=80).contains(&n)))
            .or_else(|| candidates.first().copied());
        if let Some(j) = best {
            used.insert(j);
            apply_name(&mut records[i], &names[j], year)
        }
    }
    for r in records.iter_mut() {
        if !r["name"].is_null() || number(r, "obj_end") > 0 {
            continue;
        }
        let end = number(r, "offset") + 105;
        let i = names.partition_point(|n| n.offset < end);
        let best = (i..(i + 80).min(names.len()))
            .take_while(|j| names[*j].offset <= end + 50000)
            .find(|j| !used.contains(j))
            .or_else(|| {
                ((i.saturating_sub(39))..i)
                    .rev()
                    .take_while(|j| end.saturating_sub(names[*j].offset) <= 15000)
                    .find(|j| !used.contains(j))
            });
        if let Some(j) = best {
            used.insert(j);
            apply_name(r, &names[j], year)
        }
    }
    for i in 0..records.len() {
        let has_name = records[i]["name"]
            .as_str()
            .is_some_and(|s| !s.is_empty() && !s.starts_with("Player_"));
        if has_name && number(&records[i], "birth_year") > 0 {
            continue;
        }
        let end = number(&records[i], "offset") + 105;
        let mut next = records
            .get(i + 1)
            .map(|r| number(r, "offset"))
            .unwrap_or(d.len());
        let obj = number(&records[i], "obj_end");
        if obj > 0 {
            next = next.min(obj)
        }
        let mut nick = nickname(d, end);
        let mut found = false;
        for q in end.saturating_add(15)..next.min(d.len().saturating_sub(8)) {
            if d[q - 1] != 0 || d[q - 6] != 0 || d[q - 11] != 0 {
                continue;
            }
            let n = u32_at(d, q).unwrap_or(u32::MAX) as usize;
            if n != 0 && !(2..=80).contains(&n) {
                continue;
            }
            let after = q + 4 + n;
            let inline = if n > 0 {
                let Some(s) = d.get(q + 4..after).and_then(valid_text) else {
                    continue;
                };
                Some(s)
            } else {
                None
            };
            let Some(day) = u16_at(d, after) else {
                continue;
            };
            let Some(by) = u16_at(d, after + 2) else {
                continue;
            };
            let Some(nid) = u16_at(d, after + 9) else {
                continue;
            };
            if !(1940..=(year - 14).min(2160)).contains(&(by as i32)) || !(1..=366).contains(&day) {
                continue;
            }
            let fr = u32_at(d, q - 15).unwrap();
            let sr = u32_at(d, q - 10).unwrap();
            let cr = u32_at(d, q - 5).unwrap();
            let f = fr
                .checked_add(1)
                .and_then(|v| first.get(&v))
                .cloned()
                .unwrap_or_default();
            let s = sr
                .checked_add(1)
                .and_then(|v| sur.get(&v))
                .cloned()
                .unwrap_or_default();
            let c = cr
                .checked_add(1)
                .and_then(|v| common.get(&v))
                .cloned()
                .unwrap_or_default();
            if !((!f.is_empty() && (!s.is_empty() || sr == u32::MAX)) || !c.is_empty()) {
                continue;
            }
            if c.chars().count() > 1 {
                nick = Some(c)
            } else if cr != u32::MAX && !f.is_empty() && nick.is_none() {
                nick = Some(f.clone())
            }
            if nick.is_none() {
                let rs = format!("{} {}", f, s).trim().to_string();
                nick = if rs.is_empty() { inline } else { Some(rs) }
            }
            birth(&mut records[i], year, by as i32, day, nid);
            found = true;
            break;
        }
        if !found {
            for bp in end.saturating_add(200)..next.saturating_sub(12) {
                let by = u16_at(d, bp).unwrap_or(0);
                let day = u16_at(d, bp - 2).unwrap_or(0);
                let nid = u16_at(d, bp + 7).unwrap_or(u16::MAX);
                if !(1940..=(year - 14).min(2160)).contains(&(by as i32))
                    || !(1..=366).contains(&day)
                    || nation(nid as i32).is_empty()
                {
                    continue;
                }
                if !(bp.saturating_sub(100)..bp.saturating_sub(4))
                    .any(|p| p >= end && matches(d, p, TAIL))
                {
                    continue;
                }
                birth(&mut records[i], year, by as i32, day, nid);
                found = true;
                break;
            }
        }
        if !has_name {
            if let Some(n) = nick {
                records[i]["name"] = json!(n)
            } else if found {
                records[i]["name"] = json!(format!("Player_{}", number(&records[i], "offset")))
            }
        }
        if !records[i]["name"].is_null() && records[i]["birth_year"].is_null() {
            for k in ["birth_year", "age", "birth_month", "birth_day"] {
                records[i][k] = json!(0)
            }
            records[i]["nation"] = json!("");
        }
    }
    for i in 0..records.len() {
        if !records[i]["name"]
            .as_str()
            .is_some_and(|s| s.starts_with("Player_"))
        {
            continue;
        }
        let by = number(&records[i], "birth_year");
        if by == 0 {
            continue;
        }
        let start = number(&records[i], "offset") + 105;
        let next = records
            .get(i + 1)
            .map(|r| number(r, "offset"))
            .unwrap_or(d.len());
        for j in find_all(
            &d[start.min(d.len())..next.min(d.len())],
            b"\x01\x00\x6c\x07\x01\x00\x6c\x07",
        ) {
            let j = j + start;
            let Some(f) = u32_at(d, j + 29)
                .and_then(|v| v.checked_add(1))
                .and_then(|id| first.get(&id))
            else {
                continue;
            };
            if (45..56).any(|delta| u16_at(d, j + delta) == Some(by as u16)) {
                records[i]["name"] = json!(f);
                break;
            }
        }
    }
    for r in records {
        if r["name"].is_null() {
            placeholder(r)
        }
        if r["personality"].is_null() {
            r["personality"] = json!({});
        }
    }
}
pub fn parse_save_file(path: &Path) -> Result<ParseResult, String> {
    let (data, year, date, version) = decompress_save(path)?;
    let (first, sur, common) = build_name_tables_ex(&data);
    let boundaries = find_object_boundaries(&data);
    let mut players = extract_attribute_records(&data, &boundaries);
    resolve_player_names(&data, &mut players, &first, &sur, &common, year);
    crate::contracts::extract_contracts_v2(&data, &mut players, version, year);
    let contract_hits = players
        .iter()
        .filter(|r| !r["contract_offset"].is_null() || r["contract_type"] == "None")
        .count();
    if !players.is_empty() && (contract_hits as f64 / players.len() as f64) < 0.5 {
        crate::contracts::legacy_fallback(&data, &mut players, version, year);
    }
    crate::clubs::annotate_records(&data, &mut players, version);
    for r in &mut players {
        if let Some(born) = NaiveDate::from_ymd_opt(
            number(r, "birth_year") as i32,
            number(r, "birth_month") as u32,
            number(r, "birth_day") as u32,
        ) {
            r["age"] = json!(
                date.year()
                    - born.year()
                    - i32::from((date.month(), date.day()) < (born.month(), born.day()))
            );
        }
    }
    let staff =
        crate::staff::extract_staff_records(&data, &players, &first, &sur, date, &boundaries);
    Ok(ParseResult {
        players,
        staff,
        game_year: year,
        game_date: date.to_string(),
        fm_version: version,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn checked_reads() {
        assert_eq!(u32_at(&[1], 0), None);
        assert_eq!(u16_at(&[1, 2], 0), Some(513));
        assert_eq!(u16_at(&[], usize::MAX), None);
    }
    #[test]
    fn positions_and_attrs() {
        let mut data = vec![0; 250];
        data[0..2].copy_from_slice(&160u16.to_le_bytes());
        data[2..4].copy_from_slice(&190u16.to_le_bytes());
        data[23..38].fill(1);
        data[35] = 20;
        data[38..92].fill(75);
        data[101..105].copy_from_slice(TAIL);
        let r = extract_attribute_records(&data, &[]);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0]["ca"], 160);
        assert_eq!(r[0]["best_position"], "ST");
        assert_eq!(r[0]["attributes"]["Fin"], 15);
    }
}

#[cfg(test)]
mod malformed_tests {
    use super::*;
    #[test]
    fn truncated_and_random_payloads_do_not_panic() {
        let first = NameMap::new();
        let sur = NameMap::new();
        for len in [0, 1, 2, 8, 20, 50, 100, 250, 512, 4096] {
            let mut d = vec![0u8; len];
            let mut seed = 123456789u32;
            for v in &mut d {
                seed ^= seed << 13;
                seed ^= seed >> 17;
                seed ^= seed << 5;
                *v = seed as u8
            }
            let boundaries = find_object_boundaries(&d);
            let mut records = extract_attribute_records(&d, &boundaries);
            resolve_player_names(&d, &mut records, &first, &sur, &first, 2031);
            let _ = build_name_tables_ex(&d);
            let _ = crate::staff::read_staff_sheet(&d, 0, d.len());
        }
    }
    #[test]
    fn rejects_non_save() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("bad.fm");
        std::fs::write(&p, b"invalid").unwrap();
        assert!(decompress_save(&p).is_err());
    }
}

#[cfg(test)]
mod compressed_input_tests {
    use super::*;
    #[test]
    fn rejects_unsupported_version_and_broken_zstd_without_panicking() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("input.fm");
        let frame = zstd::stream::encode_all(&b"Football Manager 26.2.0+0"[..], 1).unwrap();
        std::fs::write(&path, frame).unwrap();
        assert!(decompress_save(&path).unwrap_err().contains("2024"));
        for payload in [
            &b"\x28\xb5\x2f\xfd"[..],
            &b"\x28\xb5\x2f\xfd\x00\xff\xff"[..],
        ] {
            std::fs::write(&path, payload).unwrap();
            assert!(decompress_save(&path).is_err());
        }
    }
    #[test]
    fn masks_header_day_and_detects_version_from_frame_three_tag() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("input.fm");
        let mut payload = vec![0; 64];
        payload[26..30].copy_from_slice(b"2400");
        payload[36..38].copy_from_slice(&(229u16 | 0xA000).to_le_bytes());
        payload[38..40].copy_from_slice(&2031u16.to_le_bytes());
        for _ in 0..1001 {
            payload.extend(TAIL)
        }
        let empty = zstd::stream::encode_all(&b"frame"[..], 1).unwrap();
        let mut raw = empty.repeat(3);
        raw.extend(zstd::stream::encode_all(&payload[..], 1).unwrap());
        std::fs::write(&path, raw).unwrap();
        let (_, year, date, version) = decompress_save(&path).unwrap();
        assert_eq!(year, 2031);
        assert_eq!(version, 24);
        assert_eq!(date.to_string(), "2031-08-17");
        payload[26..30].copy_from_slice(b"2600");
        let mut raw = empty.repeat(3);
        raw.extend(zstd::stream::encode_all(&payload[..], 1).unwrap());
        std::fs::write(&path, raw).unwrap();
        assert!(decompress_save(&path).unwrap_err().contains("2024"));
    }
}

#[cfg(test)]
mod nationality_tests {
    use super::*;

    #[test]
    fn nationality_labels_never_expose_numeric_database_ids() {
        for id in [203, 204, 205, 9999, -1] {
            assert_eq!(nation(id), "", "unresolved nation {id} must stay blank");
        }
        assert_eq!(nation(139), "ENG");
        assert_eq!(nation(143), "FRA");
    }

    #[test]
    fn unresolved_nationalities_stay_blank_through_name_resolution_and_enrichment() {
        for id in [203, 204, 205] {
            let mut row = json!({"attributes": {}, "positions": {}});
            apply_name(&mut row, &NameEntry {
                offset: 0, name: "Example Person".into(), year: 2000,
                day: 1, nation: id, pers: vec![],
            }, 2026);
            // Staff use the resolved name record directly.
            assert_eq!(row["nation"], "");
            let mut players = vec![row];
            crate::enrich::enrich_players(&mut players, "2026-11-11");
            assert_eq!(players[0]["Nation"], "");
        }
    }
}
