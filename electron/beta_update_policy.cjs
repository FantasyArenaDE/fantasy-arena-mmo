'use strict';

const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const API_ORIGIN = 'https://mmo.fantasy-arena.de';
const BETA_FEED = API_ORIGIN + '/downloads/updates/beta/windows/';
const THUMBPRINT = /^[A-F0-9]{40}$/i;
const SHA512 = /^[A-Za-z0-9+/]{86}==$/;
const INSTALLER = /^[A-Za-z0-9][A-Za-z0-9._-]*\.exe$/i;

function resolveBetaUpdate({ stamp, isPackaged, platform }) {
  if (isPackaged !== true || platform !== 'win32' || stamp?.distribution !== 'website' ||
      stamp.autoUpdates !== true || stamp.apiOrigin !== API_ORIGIN || stamp.loginOrigin !== API_ORIGIN ||
      typeof stamp.updatePublisherName !== 'string' || stamp.updatePublisherName.trim() === '' ||
      typeof stamp.updatePublisherThumbprint !== 'string' || !THUMBPRINT.test(stamp.updatePublisherThumbprint)) return null;

  let feed = BETA_FEED;
  if (stamp.updateTrack === 'beta-pilot') {
    if (typeof stamp.updatePilotFeed !== 'string' ||
        !/^http:\/\/127\.0\.0\.1:[0-9]{1,5}\/[A-Za-z0-9][A-Za-z0-9_-]*\/$/.test(stamp.updatePilotFeed)) return null;
    try {
      if (!new URL(stamp.updatePilotFeed).port) return null;
    } catch {
      return null;
    }
    feed = stamp.updatePilotFeed;
  } else if (stamp.updateTrack !== 'beta' || stamp.updatePilotFeed !== undefined) {
    return null;
  }

  return {
    channel: stamp.updateTrack,
    feed,
    thumbprint: stamp.updatePublisherThumbprint.toUpperCase(),
    publisher: stamp.updatePublisherName,
  };
}

function evaluateBetaOffer({ apiOrigin, channel, info }) {
  if (apiOrigin !== API_ORIGIN || info?.wocApiOrigin !== apiOrigin ||
      !['beta','beta-pilot'].includes(channel) || info.wocUpdateChannel !== channel) return false;
  // Full NSIS installer only. A feed can select a filename in its own directory.
  if (!Array.isArray(info.files) || info.files.length !== 1 ||
      info.packages !== undefined || typeof info.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(info.version)) return false;
  const file = info.files[0];
  return typeof file?.url === 'string' && INSTALLER.test(file.url) &&
    typeof file.sha512 === 'string' && SHA512.test(file.sha512) &&
    (info.path === undefined || info.path === file.url) &&
    (info.sha512 === undefined || info.sha512 === file.sha512);
}

async function verifyAuthenticode(file, thumbprint, run = promisify(execFile)) {
  if (typeof file !== 'string' || !/^[A-Za-z]:\\/.test(file) || !path.win32.isAbsolute(file) || typeof thumbprint !== 'string' ||
      !THUMBPRINT.test(thumbprint)) return false;
  const systemRoot = process.env.SystemRoot;
  if (typeof systemRoot !== 'string' || !/^[A-Za-z]:\\[^\r\n]+$/.test(systemRoot)) return false;
  const powershell = path.win32.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const quoted = file.replaceAll("'", "''");
  const script = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $s=Get-AuthenticodeSignature -LiteralPath '" +
    quoted + "'; [Console]::Write(([string][int]$s.Status)+'|'+$s.SignerCertificate.Thumbprint)";
  try {
    const { stdout, stderr } = await run(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'),
    ], { windowsHide: true, timeout: 20_000 });
    return !stderr && stdout.trim().toUpperCase() === '0|' + thumbprint.toUpperCase();
  } catch {
    return false;
  }
}

async function verifyInstallerDigest(file, expected) {
  if (typeof file !== 'string' || typeof expected !== 'string' || !SHA512.test(expected)) return false;
  try {
    const hash = createHash('sha512');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('base64') === expected;
  } catch {
    return false;
  }
}

module.exports = {
  API_ORIGIN, BETA_FEED, resolveBetaUpdate, evaluateBetaOffer, verifyAuthenticode, verifyInstallerDigest,
};
