//! Versioned local snapshots. Save files are only ever opened for reading.
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Instant, UNIX_EPOCH},
};

const SCHEMA: &str = "foxy-rust-fm24-v2";
#[derive(Serialize, Deserialize, Debug)]
pub struct Snapshot {
    pub players: Vec<Value>,
    pub staff: Vec<Value>,
    pub game_year: i32,
    pub game_date: String,
    pub fm_version: i32,
    pub cache_hit: bool,
    pub elapsed_ms: u128,
}
#[derive(Serialize, Deserialize)]
struct Envelope {
    schema: String,
    key: String,
    snapshot: Snapshot,
}

pub fn cache_root() -> PathBuf {
    std::env::var_os("FSS_CACHE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            dirs::cache_dir()
                .unwrap_or_else(std::env::temp_dir)
                .join("FoxyScout")
                .join("rust")
        })
}

pub fn fingerprint(path: &Path) -> Result<String, String> {
    let path = path
        .canonicalize()
        .map_err(|e| format!("Cannot open save: {e}"))?;
    let meta = path.metadata().map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("Select an FM24 .fm save file.".into());
    }
    let modified = meta
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    #[cfg(unix)]
    let extra = {
        use std::os::unix::fs::MetadataExt;
        format!("{}:{}:{}", meta.ino(), meta.ctime(), meta.ctime_nsec())
    };
    #[cfg(not(unix))]
    let extra = format!("{:?}", meta.created());
    let identity = format!(
        "{SCHEMA}|{}|{}|{modified}|{extra}",
        path.display(),
        meta.len()
    );
    Ok(format!("{:x}", Sha256::digest(identity.as_bytes())))
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Destination has no folder")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.as_file().sync_all())
        .map_err(|e| e.to_string())?;
    file.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_save(path: &Path, force: bool) -> Result<Snapshot, String> {
    load_save_at(path, force, &cache_root(), crate::parser::parse_save_file)
}

fn load_save_at<F>(path: &Path, force: bool, root: &Path, parser: F) -> Result<Snapshot, String>
where
    F: FnOnce(&Path) -> Result<crate::parser::ParseResult, String>,
{
    let start = Instant::now();
    if !path
        .extension()
        .is_some_and(|s| s.eq_ignore_ascii_case("fm"))
    {
        return Err("Select a Football Manager 2024 .fm save file.".into());
    }
    let key = fingerprint(path)?;
    let location = root.join(format!("{key}.json.gz"));
    if !force {
        if let Ok(file) = fs::File::open(&location) {
            let mut bytes = Vec::new();
            let decoded = GzDecoder::new(file)
                .take(2 * 1024 * 1024 * 1024)
                .read_to_end(&mut bytes)
                .ok()
                .and_then(|_| serde_json::from_slice::<Envelope>(&bytes).ok());
            if let Some(mut cached) = decoded {
                if cached.schema == SCHEMA
                    && cached.key == key
                    && cached.snapshot.fm_version == 24
                    && fingerprint(path)? == key
                {
                    cached.snapshot.cache_hit = true;
                    cached.snapshot.elapsed_ms = start.elapsed().as_millis();
                    return Ok(cached.snapshot);
                }
            }
        }
    }
    let mut parsed = parser(path)?;
    if parsed.fm_version != 24 {
        return Err("This app supports Football Manager 2024 saves only.".into());
    }
    crate::enrich::enrich_players(&mut parsed.players, &parsed.game_date);
    // The webview needs table fields only. Decode detailed role reports on demand,
    // avoiding duplicate binary-reader records and thousands of unused role arrays.
    for player in &mut parsed.players {
        if let Some(row) = player.as_object_mut() {
            row.retain(|key, _| {
                key != "RoleReport" && !key.starts_with(|c: char| c.is_ascii_lowercase())
            });
        }
    }
    if fingerprint(path)? != key {
        return Err(
            "The save changed while loading. Finish saving in FM24 and load it again.".into(),
        );
    }
    let result = Snapshot {
        players: parsed.players,
        staff: parsed.staff,
        game_year: parsed.game_year,
        game_date: parsed.game_date,
        fm_version: parsed.fm_version,
        cache_hit: false,
        elapsed_ms: start.elapsed().as_millis(),
    };
    let mut envelope = Envelope {
        schema: SCHEMA.into(),
        key,
        snapshot: result,
    };
    // Cache failure must never prevent reading an otherwise valid save.
    let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
    if let Ok(json) = serde_json::to_vec(&envelope) {
        if encoder.write_all(&json).is_ok() {
            if let Ok(bytes) = encoder.finish() {
                let _ = atomic_write(&location, &bytes);
            }
        }
    }
    envelope.snapshot.elapsed_ms = start.elapsed().as_millis();
    Ok(envelope.snapshot)
}

pub fn list_saves(directory: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(directory) else {
        return vec![];
    };
    let mut paths: Vec<_> = entries
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.extension().is_some_and(|s| s.eq_ignore_ascii_case("fm")))
        .collect();
    paths.sort_by_key(|p| std::cmp::Reverse(p.metadata().and_then(|m| m.modified()).ok()));
    paths
}

pub fn default_save_folders() -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_default();
    let mut folders = vec![
        home.join("Library/Application Support/Sports Interactive/Football Manager 2024/games")
    ];
    if let Some(docs) = dirs::document_dir() {
        folders.push(docs.join("Sports Interactive/Football Manager 2024/games"));
    }
    folders.push(home.join(".local/share/Sports Interactive/Football Manager 2024/games"));
    folders
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(_: &Path) -> Result<crate::parser::ParseResult, String> {
        Ok(crate::parser::ParseResult {
            players: vec![],
            staff: vec![],
            game_year: 2031,
            game_date: "2031-08-17".into(),
            fm_version: 24,
        })
    }
    #[test]
    fn snapshots_survive_sessions_and_corrupt_caches_rebuild() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("save.fm");
        let cache = dir.path().join("cache");
        fs::write(&path, b"save").unwrap();
        assert!(
            !load_save_at(&path, false, &cache, fixture)
                .unwrap()
                .cache_hit
        );
        assert!(
            load_save_at(&path, false, &cache, |_| panic!("must use cache"))
                .unwrap()
                .cache_hit
        );
        let location = cache.join(format!("{}.json.gz", fingerprint(&path).unwrap()));
        fs::write(&location, b"corrupt").unwrap();
        assert!(
            !load_save_at(&path, false, &cache, fixture)
                .unwrap()
                .cache_hit
        );
        assert!(
            !load_save_at(&path, true, &cache, fixture)
                .unwrap()
                .cache_hit
        );
        fs::write(&path, b"changed save").unwrap();
        assert!(
            !load_save_at(&path, false, &cache, fixture)
                .unwrap()
                .cache_hit
        );
    }
    #[test]
    fn changed_or_wrong_version_saves_never_enter_cache() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("save.fm");
        let cache = dir.path().join("cache");
        fs::write(&path, b"save").unwrap();
        let err = load_save_at(&path, false, &cache, |p| {
            fs::write(p, b"FM still saving").unwrap();
            fixture(p)
        })
        .unwrap_err();
        assert!(err.contains("changed"));
        assert!(!cache.exists());
        let err = load_save_at(&path, false, &cache, |p| {
            let mut f = fixture(p)?;
            f.fm_version = 26;
            Ok(f)
        })
        .unwrap_err();
        assert!(err.contains("2024"));
        assert!(!cache.exists());
    }
    #[test]
    fn fingerprints_detect_replaced_and_changed_saves() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("save.fm");
        fs::write(&path, b"first").unwrap();
        let a = fingerprint(&path).unwrap();
        atomic_write(&path, b"second").unwrap();
        assert_ne!(a, fingerprint(&path).unwrap());
    }
    #[test]
    fn atomic_writes_and_folder_listing() {
        let dir = tempfile::tempdir().unwrap();
        atomic_write(&dir.path().join("nested/a.fm"), b"save").unwrap();
        fs::write(dir.path().join("nested/other.txt"), b"no").unwrap();
        assert_eq!(list_saves(&dir.path().join("nested")).len(), 1);
        assert!(list_saves(&dir.path().join("missing")).is_empty());
        assert!(load_save(&dir.path().join("other.txt"), false)
            .unwrap_err()
            .contains(".fm"));
    }
}
