import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  installMacosLaunchAgent,
  MACOS_AUTO_SYNC_SCRIPT_FILENAME,
  MACOS_LAUNCH_AGENT_LABEL,
  MACOS_LAUNCH_AGENT_PLIST_FILENAME,
  installWindowsLauncher,
  WINDOWS_CMD_LAUNCHER_FILENAME,
  WINDOWS_VBS_LAUNCHER_FILENAME
} from "../src/launcher.js";

test("installWindowsLauncher creates cmd and vbs launchers", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-provider-launcher-"));
  const codexHome = "C:\\Users\\Example User\\.codex";

  const result = await installWindowsLauncher({ dir, codexHome });

  assert.equal(result.targetDir, dir);
  assert.equal(result.cmdPath, path.join(dir, WINDOWS_CMD_LAUNCHER_FILENAME));
  assert.equal(result.vbsPath, path.join(dir, WINDOWS_VBS_LAUNCHER_FILENAME));
  assert.equal(result.codexHome, path.resolve(codexHome));

  const cmdText = await fs.readFile(result.cmdPath, "utf8");
  const vbsText = await fs.readFile(result.vbsPath, "utf8");

  assert.match(cmdText, /codex-provider sync --codex-home "C:\\Users\\Example User\\.codex"/);
  assert.match(vbsText, /Synchronization finished\./);
  assert.match(vbsText, /Codex Provider Sync/);
  assert.match(vbsText, /codex-provider sync --codex-home ""C:\\Users\\Example User\\.codex""/);
});

test("installMacosLaunchAgent creates a watcher script and plist", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-provider-macos-launcher-"));
  const codexHome = path.join(root, ".codex home");
  const supportDir = path.join(root, "support");
  const launchAgentsDir = path.join(root, "LaunchAgents");
  const nodePath = "/Applications/Codex.app/Contents/Resources/node";
  const cliPath = "/tmp/codex-provider-sync/src/cli.js";

  const result = await installMacosLaunchAgent({
    codexHome,
    supportDir,
    launchAgentsDir,
    nodePath,
    cliPath
  });

  assert.equal(result.label, MACOS_LAUNCH_AGENT_LABEL);
  assert.equal(result.codexHome, path.resolve(codexHome));
  assert.equal(result.supportDir, path.resolve(supportDir));
  assert.equal(result.launchAgentsDir, path.resolve(launchAgentsDir));
  assert.equal(result.scriptPath, path.join(path.resolve(supportDir), MACOS_AUTO_SYNC_SCRIPT_FILENAME));
  assert.equal(result.plistPath, path.join(path.resolve(launchAgentsDir), MACOS_LAUNCH_AGENT_PLIST_FILENAME));

  const scriptText = await fs.readFile(result.scriptPath, "utf8");
  const plistText = await fs.readFile(result.plistPath, "utf8");

  assert.match(scriptText, /sync --provider "\$provider" --codex-home "\$CODEX_HOME"/);
  assert.match(scriptText, /skip: provider unchanged/);
  assert.match(scriptText, /provider-sync-auto\.log/);
  assert.match(scriptText, /\/Applications\/Codex\.app\/Contents\/Resources\/node/);
  assert.match(scriptText, /\/tmp\/codex-provider-sync\/src\/cli\.js/);

  assert.match(plistText, /<string>com\.codex-provider-sync\.auto<\/string>/);
  assert.match(plistText, /<key>WatchPaths<\/key>/);
  assert.match(plistText, /\.codex home\/config\.toml/);
  assert.match(plistText, /provider-sync-auto\.launchd\.out\.log/);
  assert.match(plistText, /provider-sync-auto\.launchd\.err\.log/);
});
