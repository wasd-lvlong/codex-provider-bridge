export const MINIMUM_NODE_MAJOR_VERSION = 24;

export function getUnsupportedNodeVersionMessage(nodeVersion = process.versions.node) {
  const majorVersion = Number.parseInt(String(nodeVersion).split(".")[0] ?? "", 10);
  if (Number.isInteger(majorVersion) && majorVersion >= MINIMUM_NODE_MAJOR_VERSION) {
    return null;
  }

  const displayVersion = String(nodeVersion).startsWith("v") ? String(nodeVersion) : `v${nodeVersion}`;
  return `codex-provider-bridge requires Node.js ${MINIMUM_NODE_MAJOR_VERSION}+ because it uses node:sqlite. `
    + `Current Node.js version: ${displayVersion}. `
    + "Please upgrade Node.js, then reinstall or rerun codex-bridge.";
}

export function assertSupportedNodeVersion() {
  const message = getUnsupportedNodeVersionMessage();
  if (message) {
    throw new Error(message);
  }
}
