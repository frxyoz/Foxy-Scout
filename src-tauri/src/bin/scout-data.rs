//! Headless Rust reader for reproducible parity checks and performance measurements.
use std::{fs, path::Path, time::Instant};
fn main() {
    if let Err(e) = run() {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 2 {
        return Err("Usage: scout-data SAVE.fm OUTPUT.json [--cache]".into());
    }
    let start = Instant::now();
    let snapshot = if args.iter().any(|s| s == "--cache") {
        serde_json::to_value(foxy_scout::storage::load_save(Path::new(&args[0]), false)?)
            .map_err(|e| e.to_string())?
    } else {
        let mut p = foxy_scout::parser::parse_save_file(Path::new(&args[0]))?;
        let parse_ms = start.elapsed().as_millis();
        // Keep original raw records separately for exact binary-reader comparison.
        let raw = p.players.clone();
        foxy_scout::enrich::enrich_players(&mut p.players, &p.game_date);
        serde_json::json!({"players":raw,"table":p.players,"staff":p.staff,"game_year":p.game_year,"game_date":p.game_date,"fm_version":p.fm_version,"parse_ms":parse_ms,"total_ms":start.elapsed().as_millis()})
    };
    let bytes = serde_json::to_vec(&snapshot).map_err(|e| e.to_string())?;
    fs::write(&args[1], bytes).map_err(|e| e.to_string())?;
    eprintln!(
        "players={} staff={} total={:.3}s",
        snapshot["players"].as_array().map_or(0, Vec::len),
        snapshot["staff"].as_array().map_or(0, Vec::len),
        start.elapsed().as_secs_f64()
    );
    Ok(())
}
