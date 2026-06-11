import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  installMacosLaunchAgent,
  MACOS_AUTO_SYNC_SCRIPT_FILENAME,
  MACOS_CODEX_NODE_CANDIDATES,
  MACOS_LAUNCH_AGENT_LABEL,
  MACOS_LAUNCH_AGENT_PLIST_FILENAME,
  resolveMacosNodePath,
  installWindowsLauncher,
  WINDOWS_CMD_LAUNCHER_FILENAME,
  WINDOWS_VBS_LAUNCHER_FILENAME
} from "../src/launcher.js";

test("installWindowsLauncher creates cmd and vbs launchers", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-provider-bridge-launcher-"));
  const codexHome = "C:\\Users\\Example User\\.codex";

  const result = await installWindowsLauncher({ dir, codexHome });

  assert.equal(result.targetDir, dir);
  assert.equal(result.cmdPath, path.join(dir, WINDOWS_CMD_LAUNCHER_FILENAME));
  assert.equal(result.vbsPath, path.join(dir, WINDOWS_VBS_LAUNCHER_FILENAME));
  assert.equal(result.codexHome, path.resolve(codexHome));

  const cmdText = await fs.readFile(result.cmdPath, "utf8");
  const vbsText = await fs.readFile(result.vbsPath, "utf8");

  assert.match(cmdText, /codex-bridge sync --codex-home "C:\\Users\\Example User\\.codex"/);
  assert.match(vbsText, /Synchronization finished\./);
  assert.match(vbsText, /Codex Provider Bridge/);
  assert.match(vbsText, /codex-bridge sync --codex-home ""C:\\Users\\Example User\\.codex""/);
});

test("installMacosLaunchAgent creates a watcher script and plist", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-provider-bridge-macos-launcher-"));
  const codexHome = path.join(root, ".codex home");
  const supportDir = path.join(root, "support");
  const launchAgentsDir = path.join(root, "LaunchAgents");
  const nodePath = "/Applications/Codex.app/Contents/Resources/node";
  const cliPath = "/tmp/codex-provider-bridge/src/cli.js";

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
  assert.match(scriptText, /provider-bridge-auto\.log/);
  assert.match(scriptText, /\/Applications\/Codex\.app\/Contents\/Resources\/node/);
  assert.match(scriptText, /\/tmp\/codex-provider-bridge\/src\/cli\.js/);

  assert.match(plistText, /<string>com\.codex-provider-bridge\.auto<\/string>/);
  assert.match(plistText, /<key>WatchPaths<\/key>/);
  assert.match(plistText, /\.codex home\/config\.toml/);
  assert.match(plistText, /provider-bridge-auto\.launchd\.out\.log/);
  assert.match(plistText, /provider-bridge-auto\.launchd\.err\.log/);
});

test("resolveMacosNodePath prefers bundled Codex Node when available", async () => {
  const resolvedNodePath = await resolveMacosNodePath();
  assert.ok(MACOS_CODEX_NODE_CANDIDATES.includes(resolvedNodePath) || resolvedNodePath === process.execPath);
  if (await fs.access(MACOS_CODEX_NODE_CANDIDATES[0], fs.constants.X_OK).then(() => true, () => false)) {
    assert.equal(resolvedNodePath, MACOS_CODEX_NODE_CANDIDATES[0]);
  }
});

test("resolveMacosNodePath preserves explicit node path", async () => {
  assert.equal(
    await resolveMacosNodePath("/tmp/custom-node"),
    path.resolve("/tmp/custom-node")
  );
});
