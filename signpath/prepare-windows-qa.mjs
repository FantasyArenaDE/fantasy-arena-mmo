import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [archive, work] = process.argv.slice(2).map(value => path.resolve(value));
assert(archive && work, 'Pass the pinned release ASAR and a fresh QA work directory');
const application = path.join(work, 'app');
const extracted = path.join(work, 'input');
const renderer = path.join(root, 'dist-signpath-renderer');
const sha256 = createHash('sha256');
for await (const chunk of createReadStream(archive)) sha256.update(chunk);
assert.equal(sha256.digest('hex'), '779a2bb9844040131ed6d41cefe24678ae3fca42b401849ccb0529e79ecdab56');

const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve('electron-builder'));
const builderLibRequire = createRequire(builderRequire.resolve('app-builder-lib'));
const asar = builderLibRequire('@electron/asar');
await mkdir(application);
asar.extractAll(archive, extracted);
const dist = path.join(application, 'dist');
await cp(path.join(extracted, 'dist'), dist, { recursive: true, errorOnExist: true, force: false });

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const oldManifest = await readJson(path.join(dist, '.vite/manifest.json'));
const newManifest = await readJson(path.join(renderer, '.vite/manifest.json'));
const generatedFiles = new Set(Object.values(oldManifest).flatMap(entry => [entry.file, ...entry.css ?? []]));
for (const file of generatedFiles) {
  assert(/^assets\/[\w.-]+\.(js|css|wasm)$/.test(file), `Unexpected release output ${file}`);
  await rm(path.join(dist, file));
}

const builtHtml = await readFile(path.join(renderer, 'index.html'), 'utf8');
let brandedHtml = await readFile(path.join(dist, 'index.html'), 'utf8');
const oldEntry = oldManifest['index.html'].file;
const newEntry = newManifest['index.html'].file;
const replaceGroup = (html, tags, replacement) => {
  let seen = false;
  const result = html.replaceAll(tags, () => {
    if (seen) return '';
    seen = true;
    return replacement;
  });
  assert(seen, `Missing release markup ${tags}`);
  return result;
};
const modules = /^ +<script type="module" crossorigin src="\/assets\/[\w.-]+\.js"><\/script>\r?$/gm;
const preloads = /^ +<link rel="modulepreload" crossorigin href="\/assets\/[\w.-]+\.js">\r?$/gm;
const styles = /^ +<link rel="stylesheet" crossorigin href="\/assets\/[\w.-]+\.css">\r?$/gm;
const originalStyles = [...brandedHtml.matchAll(styles)].map(match => match[0]);
for (const tags of [modules, preloads, styles]) {
  const generated = [...builtHtml.matchAll(tags)].map(match => match[0]);
  assert(generated.length, `Missing generated markup ${tags}`);
  if (tags === styles) {
    generated.push(...originalStyles.filter(tag => {
      const file = tag.match(/href="\/([^\"]+)"/)[1];
      return !generatedFiles.has(file);
    }));
  }
  brandedHtml = replaceGroup(brandedHtml, tags, generated.join('\n'));
}
assert(brandedHtml.includes(`/${newEntry}`) && !brandedHtml.includes(`/${oldEntry}`));
await cp(path.join(renderer, 'assets'), path.join(dist, 'assets'), { recursive: true });
await writeFile(path.join(dist, 'index.html'), brandedHtml);
await writeFile(path.join(dist, '.vite/manifest.json'), `${JSON.stringify(newManifest, null, 2)}\n`);
await rm(path.join(dist, '.vite/release-sources.json'), { force: true });

await cp(path.join(root, 'electron'), path.join(application, 'electron'), {
  recursive: true,
  filter: file => !/^(?:host_diag|patcher)$/.test(path.basename(file)),
});
await mkdir(path.join(application, 'build'));
await cp(path.join(dist, 'fantasy-arena/icon-512.png'), path.join(application, 'build/icon.png'));
await mkdir(path.join(application, 'host-diag'));
await cp(path.join(root, 'electron/host_diag/dist/HostDiag.ps1'), path.join(application, 'host-diag/HostDiag.ps1'));
const metadata = await readJson(path.join(extracted, 'package.json'));
assert.equal(metadata.name, 'fantasy-arena-mmo');
assert.equal(metadata.version, (await readJson(path.join(root, 'signpath/renderer-input.json'))).version);
metadata.wocDesktop.autoUpdates = false;
metadata.wocDesktop.startupPatcher = false;
await writeFile(path.join(application, 'package.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Prepared unsigned installer QA input with ${newEntry}`);
