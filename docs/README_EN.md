<div align="center">

# codex-provider-bridge

### Keep Codex history visible after switching between providers

[![CI](https://github.com/wasd-lvlong/codex-provider-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/wasd-lvlong/codex-provider-bridge/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](https://github.com/wasd-lvlong/codex-provider-bridge)
[![Node](https://img.shields.io/badge/node-24%2B-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

English | [中文](../README.md)

</div>

## What It Solves

Codex session visibility can break after you switch `model_provider`.

Typical symptom:

- old sessions are visible under one provider
- then disappear after switching to another provider
- `codex resume` and Codex App may disagree because session metadata is stored in both rollout files and SQLite

`codex-provider-bridge` fixes that by updating both:

- `~/.codex/sessions` and `~/.codex/archived_sessions`
- `~/.codex/state_5.sqlite`

## GUI For Windows

If you want a normal Windows app instead of Node/npm, download `CodexProviderBridge.exe` from Releases.

The GUI app:

- scans the current `.codex` home
- shows provider distribution from rollout files and SQLite
- lets you choose a target provider from detected and saved providers
- can optionally update root `model_provider` in `config.toml`
- keeps the latest 5 managed backups by default, with a configurable retention count
- can manually clean old managed backups from the app
- can restore from backup without using a terminal

For GUI-specific usage notes, see [README_GUI_ZH.md](README_GUI_ZH.md).

## Install

```bash
npm install -g git+https://github.com/wasd-lvlong/codex-provider-bridge.git
```

Requirements:

- Node.js `24+`
- Node.js 20/22 can fail with a missing `node:sqlite` built-in module.
- standard `~/.codex` layout
- Windows is the primary tested target for now

For end users, the GUI EXE is the recommended path. The npm CLI remains available for power users and automation.

## Quick Start

GUI:

- download `CodexProviderBridge.exe` from Releases
- open it and click `Refresh`
- choose the target provider
- click `Execute`

If you already switched auth/provider using your usual method:

```bash
codex-bridge sync
```

If you want to change the root `model_provider` and sync history in one step:

```bash
codex-bridge switch openai
codex-bridge switch apigather
```

If you want a different automatic backup retention count for one run:

```bash
codex-bridge sync --keep 5
codex-bridge switch apigather --keep 10
```

Check current state first:

```bash
codex-bridge status
```

Install a Windows double-click launcher (placed on your Desktop by default):

```bash
codex-bridge install-windows-launcher
```

Install a macOS `launchd` watcher that auto-syncs after provider changes:

```bash
codex-bridge install-macos-launch-agent
```

Rollback from a backup:

```bash
codex-bridge restore C:\Users\you\.codex\backups_state\provider-sync\<timestamp>
```

Clean old managed backups manually:

```bash
codex-bridge prune-backups --keep 5
```

## AI Quick Run

If you want an AI assistant to handle this in one shot, copy this prompt:

```text
Help me fix Codex session visibility with codex-provider-bridge.

Steps:
1. Run `codex-bridge status`.
2. If my current provider is already correct, run `codex-bridge sync`.
3. If I explicitly want to switch provider, run `codex-bridge switch <provider-id>` instead.
4. If `state_5.sqlite` is currently in use, tell me to close Codex / Codex App / app-server and retry.
5. If sync skips locked rollout files, tell me which files were skipped and remind me to rerun `codex-bridge sync` later.
6. Summarize the final provider counts in rollout files and SQLite.
```

If the user prefers the GUI, the AI can instead guide these steps:

1. Open `CodexProviderBridge.exe`
2. Confirm the `.codex` path
3. Click `Refresh`
4. Pick the target provider from the list
5. Enable the config checkbox only if root `model_provider` should also change
6. Click `Execute`
7. Read the log panel for backup path, updated rollout files, SQLite rows, and skipped locked files

Quick mapping:

- inspect only: `codex-bridge status`
- fix visibility under current provider: `codex-bridge sync`
- switch provider and sync: `codex-bridge switch openai`
- install a desktop double-click launcher: `codex-bridge install-windows-launcher`
- install a macOS watcher that follows provider switches: `codex-bridge install-macos-launch-agent`
- roll back a mistake: `codex-bridge restore <backup-dir>`

## Commands

- `codex-bridge status`
  - shows current provider and provider distribution in rollout files and SQLite
- `codex-bridge sync`
  - syncs history to the current provider
  - `--provider <id>` overrides the target provider
  - if root `model_provider` is missing, it falls back to `openai`
- `codex-bridge switch <provider-id>`
  - updates root `model_provider` in `config.toml`
  - immediately runs a sync
  - `--keep <n>` overrides how many managed backups are retained after the run
- `codex-bridge prune-backups`
  - manually removes older managed backups and keeps the newest `n`
- `codex-bridge restore <backup-dir>`
  - restores a previous backup
  - use `--no-config`, `--no-db`, or `--no-sessions` to skip a restore target
- `codex-bridge install-windows-launcher`
  - creates two files on the Desktop by default
  - `Codex Provider Bridge.vbs`: hidden double-click launcher with a result popup
  - `Codex Provider Bridge.cmd`: visible console version for troubleshooting
  - use `--dir <path>` to choose another install directory
  - use `--codex-home <path>` to bake a fixed `CODEX_HOME` into the launcher
- `codex-bridge install-macos-launch-agent`
  - creates a `launchd` plist and an auto-sync shell script
  - watches `~/.codex/config.toml` for root `model_provider` changes
  - when the provider changes, runs `codex-bridge sync --provider <current-provider>`
  - use `--launch-agents-dir <path>` and `--support-dir <path>` to change output paths
  - use `--node-path <path>` or `--cli-path <path>` when you want to pin a specific runtime or script location

## Important Limitation

This tool synchronizes history metadata to one target provider at a time. It does not make multiple providers show the same history simultaneously.

That means:

- after syncing to a third-party provider, history becomes visible under that provider
- after switching back to `openai`, history may disappear there until you sync to `openai` again
- if you want that flip to happen automatically on macOS, install `codex-bridge install-macos-launch-agent`

```bash
codex-bridge status
codex-bridge sync
codex-bridge sync --keep 5
codex-bridge sync --provider openai
codex-bridge switch openai
codex-bridge switch apigather
codex-bridge prune-backups --keep 5
codex-bridge install-windows-launcher
codex-bridge install-macos-launch-agent
codex-bridge install-windows-launcher --dir D:\Tools
codex-bridge install-windows-launcher --codex-home C:\Users\you\.codex
codex-bridge restore C:\Users\you\.codex\backups_state\provider-sync\20260319T042708906Z
codex-bridge status --codex-home C:\Users\you\.codex
codex-bridge sync --codex-home C:\Users\you\.codex
codex-bridge switch apigather --codex-home C:\Users\you\.codex
codex-bridge restore C:\Users\you\.codex\backups_state\provider-sync\20260319T042708906Z
```

## Safety

Before each sync, the tool creates a backup under:

```text
~/.codex/backups_state/provider-sync/<timestamp>
```

It also uses:

```text
~/.codex/tmp/provider-sync.lock
```

- It does not replace official `codex`.
- It does not manage `auth.json` or third-party login tools.
- It does not rewrite message history, titles, cwd, or timestamps.
- It keeps the newest 5 managed backups by default; GUI retention settings or CLI `--keep <n>` can override that.
- Manual cleanup and auto-prune only touch backups created by this tool inside `backups_state/provider-sync`.
- `Codex Provider Bridge.vbs` assumes the `codex-bridge` command is already available.
- The macOS launch agent only automates metadata sync after provider switches; it does not manage auth state or third-party switch tools.
- If `state_5.sqlite` is in use, close Codex / Codex App / app-server and retry.
- If `state_5.sqlite` is malformed, the tool reports it as malformed/unreadable and blocks sync; back up, repair, or remove the damaged database before retrying.
- If a live session keeps one rollout file open, `sync` skips that file and reports it. Rerun later.
- If history contains `encrypted_content`, switching across providers/accounts may restore visibility only; continuing or compacting those sessions can still fail with `invalid_encrypted_content` because this tool cannot re-encrypt Codex history.

## EXE double-click troubleshooting

1. Fully extract the release archive before running `CodexProviderBridge.exe`.
2. If no window appears, open PowerShell in the EXE directory and run `./CodexProviderBridge.exe`.
3. Check Windows SmartScreen, Defender, or third-party antivirus blocks.
4. Check `%AppData%\codex-provider-bridge\startup-error.log`; startup exceptions are written there.

## For AI Agents

For a fuller machine-oriented version, see [AGENTS.md](../AGENTS.md).

## Development

```bash
git clone https://github.com/wasd-lvlong/codex-provider-bridge.git
cd codex-provider-bridge
npm test
dotnet test desktop/CodexProviderSync.Core.Tests/CodexProviderSync.Core.Tests.csproj
pwsh ./scripts/publish-gui.ps1
node ./src/cli.js status --codex-home C:\path\to\.codex
```

## License

MIT
