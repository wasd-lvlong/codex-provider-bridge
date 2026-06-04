import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WINDOWS_CMD_LAUNCHER_FILENAME = "Codex Provider Bridge.cmd";
export const WINDOWS_VBS_LAUNCHER_FILENAME = "Codex Provider Bridge.vbs";
export const MACOS_LAUNCH_AGENT_LABEL = "com.codex-provider-bridge.auto";
export const MACOS_LAUNCH_AGENT_PLIST_FILENAME = `${MACOS_LAUNCH_AGENT_LABEL}.plist`;
export const MACOS_AUTO_SYNC_SCRIPT_FILENAME = "codex-provider-bridge-auto.sh";

function resolveLauncherDirectory(explicitDir) {
  return path.resolve(explicitDir ?? path.join(os.homedir(), "Desktop"));
}

function resolveMacosSupportDirectory(explicitDir) {
  return path.resolve(explicitDir ?? path.join(os.homedir(), "Library", "Application Support", "codex-provider-bridge"));
}

function resolveMacosLaunchAgentsDirectory(explicitDir) {
  return path.resolve(explicitDir ?? path.join(os.homedir(), "Library", "LaunchAgents"));
}

function quoteForBatch(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function quoteForVbs(value) {
  return String(value).replace(/"/g, "\"\"");
}

function quoteForPosix(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function escapeForXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function buildBatchScript({ codexHome }) {
  const command = [
    "codex-bridge",
    "sync",
    ...(codexHome ? ["--codex-home", quoteForBatch(codexHome)] : [])
  ].join(" ");

  return [
    "@echo off",
    "setlocal",
    command,
    "exit /b %ERRORLEVEL%"
  ].join("\r\n") + "\r\n";
}

function buildVbsScript({ codexHome }) {
  const syncCommand = [
    "codex-bridge",
    "sync",
    ...(codexHome ? [`--codex-home ""${quoteForVbs(codexHome)}""`] : [])
  ].join(" ");

  return [
    "Option Explicit",
    "",
    'Const TITLE = "Codex Provider Bridge"',
    "Const MAX_OUTPUT = 3000",
    "",
    "Function TruncateOutput(value)",
    "  If Len(value) <= MAX_OUTPUT Then",
    "    TruncateOutput = value",
    "  Else",
    '    TruncateOutput = Left(value, MAX_OUTPUT) & vbCrLf & vbCrLf & "... output truncated ..."',
    "  End If",
    "End Function",
    "",
    "Dim shell, exec, command, stdoutText, stderrText, combined, message, exitCode",
    `command = "cmd.exe /d /c ${syncCommand}"`,
    'Set shell = CreateObject("WScript.Shell")',
    "Set exec = shell.Exec(command)",
    "",
    "Do While exec.Status = 0",
    "  WScript.Sleep 200",
    "Loop",
    "",
    "stdoutText = Trim(exec.StdOut.ReadAll)",
    "stderrText = Trim(exec.StdErr.ReadAll)",
    "combined = stdoutText",
    "",
    "If Len(stderrText) > 0 Then",
    "  If Len(combined) > 0 Then",
    "    combined = combined & vbCrLf & vbCrLf",
    "  End If",
    "  combined = combined & stderrText",
    "End If",
    "",
    "If Len(combined) = 0 Then",
    '  combined = "(no output)"',
    "End If",
    "",
    "exitCode = exec.ExitCode",
    "",
    "If exitCode = 0 Then",
    '  message = "Synchronization finished." & vbCrLf & vbCrLf & TruncateOutput(combined)',
    '  MsgBox message, vbOKOnly + vbInformation, TITLE',
    "Else",
    '  message = "Synchronization failed (exit code " & exitCode & ")." & vbCrLf & vbCrLf & TruncateOutput(combined)',
    '  MsgBox message, vbOKOnly + vbCritical, TITLE',
    "End If",
    ""
  ].join("\r\n");
}

function buildMacosAutoSyncScript({
  codexHome,
  nodePath,
  cliPath,
  logPath
}) {
  return [
    "#!/bin/sh",
    "",
    "set -eu",
    "",
    `CODEX_HOME=${quoteForPosix(codexHome)}`,
    'CONFIG_PATH="$CODEX_HOME/config.toml"',
    'STATE_DIR="$CODEX_HOME/tmp/provider-bridge-auto"',
    'LOCK_DIR="$STATE_DIR/lock"',
    'LAST_PROVIDER_FILE="$STATE_DIR/last-provider"',
    `LOG_FILE=${quoteForPosix(logPath)}`,
    `NODE_BIN=${quoteForPosix(nodePath)}`,
    `CLI_PATH=${quoteForPosix(cliPath)}`,
    "",
    'mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"',
    "",
    "timestamp() {",
    "  date '+%Y-%m-%d %H:%M:%S'",
    "}",
    "",
    "log() {",
    '  printf \'[%s] %s\\n\' "$(timestamp)" "$*" >> "$LOG_FILE"',
    "}",
    "",
    "read_provider() {",
    '  awk -F\'"\' \'/^[[:space:]]*model_provider[[:space:]]*=/ { print $2; exit }\' "$CONFIG_PATH"',
    "}",
    "",
    "cleanup() {",
    '  rmdir "$LOCK_DIR" 2>/dev/null || true',
    "}",
    "",
    "trap cleanup EXIT INT TERM",
    "",
    'if [ ! -f "$CONFIG_PATH" ]; then',
    '  log "skip: missing config.toml"',
    "  exit 0",
    "fi",
    "",
    'if [ ! -x "$NODE_BIN" ]; then',
    '  log "skip: missing node runtime at $NODE_BIN"',
    "  exit 0",
    "fi",
    "",
    'if [ ! -f "$CLI_PATH" ]; then',
    '  log "skip: missing CLI at $CLI_PATH"',
    "  exit 0",
    "fi",
    "",
    'if ! mkdir "$LOCK_DIR" 2>/dev/null; then',
    '  log "skip: another sync is already running"',
    "  exit 0",
    "fi",
    "",
    'provider="$(read_provider || true)"',
    'if [ -z "$provider" ]; then',
    '  provider="openai"',
    "fi",
    "",
    'last_provider=""',
    'if [ -f "$LAST_PROVIDER_FILE" ]; then',
    '  last_provider="$(cat "$LAST_PROVIDER_FILE")"',
    "fi",
    "",
    'if [ "$provider" = "$last_provider" ]; then',
    '  log "skip: provider unchanged ($provider)"',
    "  exit 0",
    "fi",
    "",
    'log "sync start: $last_provider -> $provider"',
    "",
    'if "$NODE_BIN" "$CLI_PATH" sync --provider "$provider" --codex-home "$CODEX_HOME" >> "$LOG_FILE" 2>&1; then',
    '  printf %s "$provider" > "$LAST_PROVIDER_FILE"',
    '  log "sync done: provider=$provider"',
    "else",
    '  log "sync failed: provider=$provider"',
    "  exit 1",
    "fi",
    ""
  ].join("\n");
}

function buildMacosLaunchAgentPlist({
  label,
  scriptPath,
  configPath,
  stdoutPath,
  stderrPath
}) {
  const xmlValues = {
    label: escapeForXml(label),
    scriptPath: escapeForXml(scriptPath),
    configPath: escapeForXml(configPath),
    stdoutPath: escapeForXml(stdoutPath),
    stderrPath: escapeForXml(stderrPath)
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlValues.label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlValues.scriptPath}</string>
  </array>
  <key>WatchPaths</key>
  <array>
    <string>${xmlValues.configPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlValues.stdoutPath}</string>
  <key>StandardErrorPath</key>
  <string>${xmlValues.stderrPath}</string>
</dict>
</plist>
`;
}

export async function installWindowsLauncher({
  dir,
  codexHome
} = {}) {
  const targetDir = resolveLauncherDirectory(dir);
  await fs.mkdir(targetDir, { recursive: true });

  const cmdPath = path.join(targetDir, WINDOWS_CMD_LAUNCHER_FILENAME);
  const vbsPath = path.join(targetDir, WINDOWS_VBS_LAUNCHER_FILENAME);

  await fs.writeFile(cmdPath, buildBatchScript({ codexHome }), "utf8");
  await fs.writeFile(vbsPath, buildVbsScript({ codexHome }), "utf8");

  return {
    targetDir,
    cmdPath,
    vbsPath,
    codexHome: codexHome ? path.resolve(codexHome) : null
  };
}

export async function installMacosLaunchAgent({
  launchAgentsDir,
  supportDir,
  codexHome,
  label = MACOS_LAUNCH_AGENT_LABEL,
  nodePath = process.execPath,
  cliPath = fileURLToPath(new URL("./cli.js", import.meta.url))
} = {}) {
  const resolvedCodexHome = path.resolve(codexHome ?? path.join(os.homedir(), ".codex"));
  const resolvedSupportDir = resolveMacosSupportDirectory(supportDir);
  const resolvedLaunchAgentsDir = resolveMacosLaunchAgentsDirectory(launchAgentsDir);
  const scriptPath = path.join(resolvedSupportDir, MACOS_AUTO_SYNC_SCRIPT_FILENAME);
  const plistPath = path.join(resolvedLaunchAgentsDir, `${label}.plist`);
  const logDir = path.join(resolvedCodexHome, "log");
  const stdoutPath = path.join(logDir, "provider-bridge-auto.launchd.out.log");
  const stderrPath = path.join(logDir, "provider-bridge-auto.launchd.err.log");

  await fs.mkdir(resolvedSupportDir, { recursive: true });
  await fs.mkdir(resolvedLaunchAgentsDir, { recursive: true });
  await fs.mkdir(logDir, { recursive: true });

  await fs.writeFile(scriptPath, buildMacosAutoSyncScript({
    codexHome: resolvedCodexHome,
    nodePath: path.resolve(nodePath),
    cliPath: path.resolve(cliPath),
    logPath: path.join(logDir, "provider-bridge-auto.log")
  }), "utf8");
  await fs.chmod(scriptPath, 0o755);

  await fs.writeFile(plistPath, buildMacosLaunchAgentPlist({
    label,
    scriptPath,
    configPath: path.join(resolvedCodexHome, "config.toml"),
    stdoutPath,
    stderrPath
  }), "utf8");

  return {
    label,
    codexHome: resolvedCodexHome,
    supportDir: resolvedSupportDir,
    launchAgentsDir: resolvedLaunchAgentsDir,
    scriptPath,
    plistPath,
    stdoutPath,
    stderrPath,
    loadCommand: `launchctl bootstrap gui/$(id -u) ${quoteForPosix(plistPath)}`,
    unloadCommand: `launchctl bootout gui/$(id -u) ${quoteForPosix(plistPath)}`
  };
}
