'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { API_ORIGIN } = require('../beta_update_policy.cjs');
const { loadAutoUpdater } = require('../updater.cjs');
const { createStartupUpdate } = require('./update.cjs');

function openStartupPatcher({ policy, version, log }) {
  const localURL = 'app://valhoria-patcher/patcher/index.html';
  const assets = new Map([
    ['/patcher/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/patcher/style.css', ['style.css', 'text/css']],
    ['/patcher/view.js', ['view.js', 'text/javascript']],
    ['/dist/fantasy-arena/portal-background.webp', ['../../dist/fantasy-arena/portal-background.webp', 'image/webp']],
    ['/dist/fantasy-arena/fa-forged-wordmark.webp', ['../../dist/fantasy-arena/fa-forged-wordmark.webp', 'image/webp']],
    ['/build/icon.png', ['../../build/icon.png', 'image/png']],
  ]);
  const locale = app.getLocale().toLowerCase().startsWith('de') ? 'de' : 'en';
  const window = new BrowserWindow({
    width: 1060, height: 670, minWidth: 660, minHeight: 520, center: true, show: false,
    title: 'Fantasy Arena MMO · Valhoria', backgroundColor: '#120d12',
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), partition: 'fa-patcher',
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true,
      allowRunningInsecureContent: false, webviewTag: false, spellcheck: false,
    },
  });
  window.webContents.session.protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const asset = url.hostname === 'valhoria-patcher' && assets.get(url.pathname);
    if (!asset) return new Response(null, { status: 404 });
    const [filename, type] = asset;
    const data = await readFile(path.join(__dirname, filename)).catch(() => null);
    return data ? new Response(data, { headers: { 'Content-Type': type } })
      : new Response(null, { status: 404 });
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  const { promise: ready, resolve: finish } = Promise.withResolvers();
  const run = policy && createStartupUpdate({
    updater: loadAutoUpdater({ isPackaged: true }), policy: { ...policy, apiOrigin: API_ORIGIN },
    version, log,
  });
  let busy = false;
  let installTimeout;
  let state = { phase: 'check', locale, installed: version };
  const report = (next) => {
    state = { ...state, ...next };
    if (!window.isDestroyed()) window.webContents.send('fa-patcher-state', state);
  };
  const check = async () => {
    if (busy || window.isDestroyed()) return;
    busy = true;
    try {
      if (!run) throw Error('The packaged updater configuration is incomplete');
      const outcome = await run(report);
      if (window.isDestroyed()) return;
      if (outcome === 'ready') {
        report({ phase: 'ready', version });
        finish(true);
        return;
      }
      installTimeout = setTimeout(() => {
        if (window.isDestroyed()) return;
        busy = false;
        report({ phase: 'error', detail: 'install' });
      }, 15_000);
    } catch (error) {
      log.warn('[patcher] startup check stopped', error?.message ?? String(error));
      busy = false;
      report({ phase: 'error', detail: !run ? 'config' : state.phase });
    }
  };
  const retry = (event) => {
    if (window.isDestroyed() || event.sender !== window.webContents ||
        event.senderFrame?.url !== localURL || event.senderFrame?.parent ||
        state.phase !== 'error') return;
    report({ phase: 'check', version: undefined, percent: undefined });
    void check();
  };
  ipcMain.on('fa-patcher-retry', retry);
  window.once('closed', () => {
    clearTimeout(installTimeout);
    ipcMain.removeListener('fa-patcher-retry', retry);
    finish(false);
  });
  window.once('ready-to-show', () => window.show());
  window.loadURL(localURL).then(check).catch((error) => {
    log.error('[patcher] could not load local view', error?.message ?? String(error));
    if (!window.isDestroyed()) window.destroy();
  });
  return { window, ready };
}

module.exports = { openStartupPatcher };
