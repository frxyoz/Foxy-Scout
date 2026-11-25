<h1 align="center">Foxy Scout</h1>
<p align="center">A fast, local scouting companion for Football Manager 2024.</p>
<p align="center"><img src="assets/icon.png" alt="Foxy Scout icon" width="256"></p>

Foxy Scout reads an FM24 save on your computer and turns it into a searchable player and staff scouting workspace. The desktop app is built with Rust, Tauri, React and TypeScript.

## Screenshots

![Player scouting](assets/screenshot-players.png)

![Staff scouting](assets/screenshot-staff.png)

## Features

- Filter players by age, ability, position, role rating, nationality, club, contract and estimated price.
- Inspect player reports with attributes, positional familiarity, role ratings, contract details and value estimates.
- Compare up to six players across player attributes and contract information.
- Search staff and review coaching, scouting, medical and mental attributes. Compare up to six staff members side by side.
- Keep named player shortlists, notes and tags in local scouting notebooks. View and remove applied filters above the results.
- Display and export values in euros or US dollars. Edit the USD-per-euro rate in Settings.
- Customize CSV exports: all filtered rows or a row range, current table or all columns, comma/semicolon/tab separators, and optional headers. Review row and column counts before saving.
- Keep save files local. The reader does not modify saves.

## Scouting notebooks

Open **Shortlists & notes** above the player results and create a notebook for your career. Create a named shortlist, then open a player report to add that player, write notes or save comma-separated tags. The shortlist view and tag selector work together with the applied scouting filters; CSV export uses those visible, sorted results.

Notebooks are stored locally in the app. Save paths start separately: under **Manage notebooks**, select an existing notebook when loading another save from the same career. Start a new notebook for a different career, even if you reuse a save filename. Missing players remain on shortlists when a later save no longer contains them. Deleting a shortlist keeps player notes.

In either workspace, enable **Compare**, select two to six rows and choose **Compare selected**. Player and staff selections are independent. Applied-filter buttons remove individual conditions immediately; unapplied changes are still marked separately.

## Currency

FM24 money values are decoded into a normalized USD amount. Settings can display and export euros using an editable exchange rate. The current parser does not extract a native euro denomination from a save; it uses the normalized values produced by the existing FM24 data model.

## Run from source

Install Node.js 20.19+ or 22.12+, Rust stable, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
export PATH="$HOME/.cargo/bin:$PATH"
npm ci
npm run tauri -- dev
```

Build the macOS desktop app:

```sh
./scripts/build_app.sh
```

## License

Football Manager is a trademark of Sports Interactive Limited. Foxy Scout is an unofficial fan project and is not affiliated with Sports Interactive or SEGA.
