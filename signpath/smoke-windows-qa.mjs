import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [executable, profile, version, receipt] = process.argv.slice(2);
assert(executable && profile && version && receipt);
const client = spawn(path.resolve(executable), [
  '--mute-audio', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${path.resolve(profile)}`, '--lang=de-DE',
], {
  windowsHide: true,
  env: { ...process.env, WOC_DISCORD_APP_ID: 'off' },
  stdio: ['ignore', 'ignore', 'pipe'],
});

let browser;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Installed client did not start: ${stderr}`)), 45_000);
    client.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-4000);
      const url = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[\w:/-]+)/)?.[1];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
    client.once('error', error => { clearTimeout(timer); reject(error); });
    client.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Installed client exited with ${code}: ${stderr}`));
    });
  });
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? await context.waitForEvent('page');
  await page.waitForFunction(() => document.querySelector('#lang-select')?.options.length > 1);
  await page.locator('#lang-select').selectOption('de_DE');
  await page.waitForFunction(() => document.querySelector('#mode-select a[data-i18n="fantasyArena.imprint"]')?.textContent === 'Impressum');
  const shownVersion = await page.locator('#game-version').textContent();
  assert.equal(shownVersion?.trim().split(/\s+/)[0], `v${version}`);
  assert.equal(await page.locator('#server-opt-offline,#btn-offline').count(), 0);
  await page.locator('#lang-select').selectOption('tr_TR');
  await page.waitForFunction(() => document.querySelector('#mode-select a[data-i18n="fantasyArena.imprint"]')?.textContent === 'Yasal bildirim');
  await page.locator('#btn-online').evaluate(button => button.click());
  await page.locator('#login-panel').waitFor({ state: 'visible' });
  await writeFile(receipt, `${JSON.stringify({ version, muted: true, installed: true, loginForm: true, locales: ['de_DE', 'tr_TR'] }, null, 2)}\n`);
} finally {
  try {
    await browser?.close();
  } finally {
    if (client.exitCode === null) client.kill();
  }
}
