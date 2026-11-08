import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
Object.assign(process.env, {
  VITE_FA_BROWSER_RELEASE: '1',
  VITE_WALLET_DISABLED: '1',
  VITE_DESKTOP_APP: '1',
  VITE_DESKTOP_API_ORIGIN: 'https://mmo.fantasy-arena.de',
});
const { build, loadConfigFromFile } = await import('vite');
const outDir = path.join(root, 'dist-signpath-renderer');
const { config } = await loadConfigFromFile(
  { command: 'build', mode: 'production' }, path.join(root, 'vite.config.ts'), root, 'warn', undefined, 'runner',
);
const { version } = JSON.parse(await readFile(path.join(root, 'signpath/renderer-input.json'), 'utf8'));
const { main } = config.build.rollupOptions.input;

await build({
  ...config,
  root,
  configFile: false,
  publicDir: false,
  define: {
    ...config.define,
    __APP_VERSION__: JSON.stringify(version),
    __FA_RELEASE_TEXTURE_TIERS__: '[]',
  },
  plugins: [{
    name: 'fantasy-arena-desktop-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const dreamdancer = '<button type="button" class="mini-class" data-class="dreamdancer" data-i18n-aria="classes.dreamdancerAria" data-i18n="classes.dreamdancer" aria-label="Dreamdancer class" aria-pressed="false">Dreamdancer</button>';
        let count = 0;
        const patched = html.replace(/^ *<button[^\r\n]+data-class="druid"[^\r\n]+/gm, line => {
          count += 1;
          return line + '\n' + dreamdancer;
        });
        assert.equal(count, 2);
        return patched;
      },
    },
  }, ...(config.plugins ?? []).map(plugin => {
    if (plugin.name !== 'woc-i18n-modulepreload' || typeof plugin.closeBundle !== 'function') return plugin;
    const closeBundle = plugin.closeBundle;
    return { ...plugin, closeBundle(...args) {
      if (existsSync(path.join(outDir, '.vite/manifest.json'))) return closeBundle.apply(this, args);
    } };
  })],
  build: {
    ...config.build,
    outDir,
    copyPublicDir: false,
    assetsInlineLimit: 0,
    rollupOptions: { ...config.build.rollupOptions, input: { main } },
  },
});
const manifest = JSON.parse(await readFile(path.join(outDir, '.vite/manifest.json'), 'utf8'));
assert(manifest['index.html']?.isEntry, 'The desktop entry was not built');
console.log('Desktop renderer preflight completed from the fork sources.');
