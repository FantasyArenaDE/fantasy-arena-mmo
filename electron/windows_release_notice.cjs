'use strict';

const RELEASE_ORIGIN = 'https://mmo.fantasy-arena.de';
const DOWNLOAD_PAGE = RELEASE_ORIGIN + '/downloads/desktop/index.html#win';
const RELEASE_CHECKSUMS = RELEASE_ORIGIN + '/downloads/desktop/SHA256SUMS.txt';
const VERSION = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/;
const INSTALLER = /^[a-f0-9]{64}[ \t]+\*?fantasy-arena-mmo-([0-9.]+)-win-x64\.exe$/i;

function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function selectWindowsUpdate(installed, checksums) {
  if (!VERSION.test(installed) || typeof checksums !== 'string' || checksums.length > 32768) return null;
  let available = installed;
  for (const line of checksums.split(/\r?\n/)) {
    const version = INSTALLER.exec(line)?.[1];
    if (version && VERSION.test(version) && compareVersions(version, available) > 0) available = version;
  }
  return available === installed ? null : available;
}

function createReleaseCheck({ installed, fetchRelease = fetch }) {
  let inFlight = null;
  return () => {
    if (!inFlight) {
      inFlight = (async () => {
        const response = await fetchRelease(RELEASE_CHECKSUMS, {
          cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) return null;
        return selectWindowsUpdate(installed, await response.text());
      })().catch(() => null).finally(() => { inFlight = null; });
    }
    return inFlight;
  };
}

module.exports = { RELEASE_ORIGIN, DOWNLOAD_PAGE, RELEASE_CHECKSUMS, selectWindowsUpdate, createReleaseCheck };
