use crate::storage::{self, Snapshot};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

fn expand_path(value: &str) -> PathBuf {
    if let Some(rest) = value.strip_prefix("~/") {
        return dirs::home_dir().unwrap_or_default().join(rest);
    }
    PathBuf::from(value)
}

#[derive(Default)]
struct LoadGuard(Arc<AtomicBool>);
struct Loading(Arc<AtomicBool>);
impl Drop for Loading {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[tauri::command]
async fn load_save(
    path: String,
    force: bool,
    state: tauri::State<'_, LoadGuard>,
) -> Result<Snapshot, String> {
    // Serialize loads to bound peak memory when a user repeatedly clicks Load.
    state
        .0
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| "A save is already loading. Please wait.".to_string())?;
    let guard = Loading(state.0.clone());
    // The worker owns all parser buffers; errors cannot leave partial records in the UI.
    let path = expand_path(&path);
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        storage::load_save(&path, force)
    })
    .await
    .map_err(|e| format!("Save reader failed: {e}"))?
}

#[tauri::command]
async fn choose_save() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .add_filter("FM24 save", &["fm"])
        .pick_file()
        .await
        .map(|f| f.path().to_string_lossy().into_owned())
}
#[tauri::command]
fn list_saves(directory: String) -> Result<Vec<String>, String> {
    let directory = expand_path(&directory);
    let path = directory.as_path();
    if !path.is_dir() {
        return Err("Save folder was not found.".into());
    }
    Ok(storage::list_saves(path)
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect())
}
#[tauri::command]
fn recent_saves() -> Vec<String> {
    let mut saves = Vec::new();
    for dir in storage::default_save_folders() {
        saves.extend(storage::list_saves(&dir));
    }
    saves.sort_by_key(|p| std::cmp::Reverse(p.metadata().and_then(|m| m.modified()).ok()));
    saves.dedup();
    saves
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}
#[tauri::command]
async fn export_csv(contents: String, suggested_name: String) -> Result<Option<String>, String> {
    let Some(file) = rfd::AsyncFileDialog::new()
        .set_file_name(&suggested_name)
        .add_filter("CSV", &["csv"])
        .save_file()
        .await
    else {
        return Ok(None);
    };
    let path = file.path().to_path_buf();
    // Never allow an export to overwrite an FM save, even if typed into the dialog.
    if !path
        .extension()
        .is_some_and(|s| s.eq_ignore_ascii_case("csv"))
    {
        return Err("Export must use a .csv filename.".into());
    }
    storage::atomic_write(&path, contents.as_bytes())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}
#[tauri::command]
fn role_report(player: serde_json::Value) -> serde_json::Value {
    let attrs: serde_json::Map<String, serde_json::Value> = crate::parser::ATTRS
        .iter()
        .map(|k| ((*k).to_owned(), player[*k].clone()))
        .collect();
    let positions: serde_json::Map<String, serde_json::Value> = crate::parser::POSITIONS
        .iter()
        .map(|k| ((*k).to_owned(), player[format!("Pos_{k}")].clone()))
        .collect();
    crate::ratings::player_role_report(
        &serde_json::Value::Object(attrs),
        &serde_json::Value::Object(positions),
        player["CA"].as_i64().unwrap_or(0),
        player["PA"].as_i64().unwrap_or(0),
        player["Age"].as_i64().unwrap_or(0),
    )
}
#[tauri::command]
fn load_preferences() -> Option<serde_json::Value> {
    let legacy_root = std::env::var_os("FSS_CACHE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::cache_dir().unwrap_or_default().join("FoxyScout"));
    let bytes = std::fs::read(legacy_root.join("preferences.json")).ok()?;
    let prefs: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    if !matches!(prefs["currency"].as_str(), Some("EUR" | "USD"))
        || !prefs["usd_per_eur"]
            .as_f64()
            .is_some_and(|r| r.is_finite() && r > 0.0)
    {
        return None;
    }
    Some(prefs)
}
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .manage(LoadGuard::default())
        .invoke_handler(tauri::generate_handler![
            load_save,
            choose_save,
            recent_saves,
            list_saves,
            export_csv,
            load_preferences,
            role_report,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("Foxy Scout desktop failed to start");
}
