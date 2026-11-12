# Foxy Scout working instructions

## Finish in the installed desktop app

After every task that changes this repository, **always rebuild and reinstall Foxy Scout.app before declaring the task complete**. A frontend build, passing tests, a commit, or a push does not update the installed app.

1. Run the checks appropriate to the change.
2. Run `./scripts/build_app.sh` from the repository root. This builds the Tauri release, signs and verifies the bundle, backs up the installed app, and updates the repository, distribution, and `/Applications/Foxy Scout.app` copies.
3. If the app was running, let the script quit and reopen it to load the new executable. Never quit Football Manager or modify an FM save.
4. Confirm the installed bundle passes code-signature verification and its executable matches the newly built executable. Report completion only after installation succeeds.
5. If a build or install is blocked, explain precisely what failed and that the installed app is still old. Request the required sandbox escalation; do not silently stop at source changes.

Do not commit or push unless the user asks.

## Search and filters

- Every scalar column available in player or staff tables must be usable in column filters, including hidden attributes and derived columns.
- Numeric inputs must allow temporary blank values while editing. Do not clamp visible text on each keystroke.
- Apply money filters using the selected display currency; preserve canonical USD amounts in save records.
- Keep unknown values distinct from zero, false, and empty strings. A missing value must not pass a numeric comparison accidentally.
- Keep player and staff filter drafts independent, and ensure export uses the filtered and sorted results.
