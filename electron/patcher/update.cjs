'use strict';

const { evaluateBetaOffer, verifyAuthenticode, verifyInstallerDigest } = require('../beta_update_policy.cjs');

function versionOrder(candidate, installed) {
  const parts = (value) => value.split('.').map(Number);
  const [major, minor, patch] = parts(candidate);
  const [oldMajor, oldMinor, oldPatch] = parts(installed);
  return major - oldMajor || minor - oldMinor || patch - oldPatch;
}

function createStartupUpdate({
  updater, policy, version, log,
  verifySignature = verifyAuthenticode, verifyDigest = verifyInstallerDigest,
}) {
  if (!policy || !updater || typeof updater.verifyUpdateCodeSignature !== 'function') return null;
  const vendorVerify = updater.verifyUpdateCodeSignature;
  updater.logger = log;
  updater.setFeedURL({ provider: 'generic', url: policy.feed, useMultipleRangeRequest: false });
  updater.channel = policy.channel;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.disableWebInstaller = true;
  updater.disableDifferentialDownload = true;
  updater.verifySignature = async (file) => {
    if (!await verifySignature(file, policy.thumbprint)) return 'Authenticode validation failed';
    return vendorVerify.call(updater, [policy.publisher], file);
  };

  updater.on('error', (error) => log.warn('[patcher] updater error', error?.message ?? String(error)));

  return async (report) => {
    const progress = ({ percent, transferred, total }) => {
      const valid = (value) => Number.isFinite(value) && value >= 0;
      if (!valid(percent)) return;
      report({ phase: 'download', percent: Math.min(100, percent),
        transferred: valid(transferred) ? transferred : 0, total: valid(total) ? total : 0 });
    };
    updater.on('download-progress', progress);
    try {
      report({ phase: 'check' });
      const result = await updater.checkForUpdates();
      const info = result?.updateInfo;
      if (!evaluateBetaOffer({ apiOrigin: policy.apiOrigin, channel: policy.channel, info }) || info.files[0].isAdminRightsRequired === true) {
        throw Error('The update feed returned invalid metadata');
      }
      const order = versionOrder(info.version, version);
      if (order === 0 && result.isUpdateAvailable === false) return 'ready';
      if (!(order > 0) || result.isUpdateAvailable !== true) throw Error('The update feed is out of sync');

      report({ phase: 'download', version: info.version, percent: 0 });
      const [file, ...extra] = await updater.downloadUpdate(result.cancellationToken);
      report({ phase: 'verify', version: info.version });
      // Check again here because the vendor can reuse a cached file.
      if (!file || extra.length || updater.installerPath !== file ||
          !await verifyDigest(file, info.files[0].sha512) ||
          !await verifySignature(file, policy.thumbprint)) {
        throw Error('The downloaded installer failed verification');
      }
      report({ phase: 'install', version: info.version });
      updater.quitAndInstall(true, true);
      return 'installing';
    } finally {
      updater.off('download-progress', progress);
    }
  };
}

module.exports = { createStartupUpdate };
