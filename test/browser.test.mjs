// The browser half, against pages served from this process so every number
// is known in advance. Skips only when no Chrome, Edge or Chromium exists;
// CI installs one and fails the job on any skip, so there it always runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findBrowser, launch, withBrowser } from '../skills/image-deep-research/scripts/browser.mjs';
import { study } from '../skills/image-deep-research/scripts/study.mjs';
import { renderSheets, CELL_W } from '../skills/image-deep-research/scripts/sheet.mjs';

const noBrowser = !findBrowser();
const paras = Array.from({ length: 30 }, (_, i) => `<p>Paragraph ${i + 1} of the reference page, long enough to read.</p>`).join('\n');
const PAGES = {
  '/ref': `<!doctype html><meta charset="utf-8"><title>Ref</title>
<style>html,body{margin:0;background:#1d2a3a;color:#f2e8d5;font-family:Arial,sans-serif;font-size:18px}
h1{font-family:Georgia,serif;font-size:64px;font-weight:400;margin:0;padding:40px}
p{margin:0 40px 40px}</style><h1>A reference heading</h1>${paras}`,
  '/wall': '<!doctype html><title>Just a moment</title><p>Checking your browser.</p>',
  '/oklch': `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:oklch(0.3 0.05 250);color:oklch(0.95 0.02 85)}</style>${paras}`,
};

function jpegSize(buf) {
  assert.equal(buf.readUInt16BE(0), 0xffd8, 'not a JPEG');
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('no SOF marker');
}

let server, base, out;
test.before(async () => {
  if (noBrowser) return;
  server = createServer((req, res) => {
    const body = PAGES[req.url];
    res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body || 'not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  out = mkdtempSync(join(tmpdir(), 'idr-test-'));
});
test.after(() => {
  if (server) server.close();
  if (out) rmSync(out, { recursive: true, force: true });
});

test('study measures grounds, ink and type, captures both scroll positions, and keeps a wall off the sheet', { skip: noBrowser && 'no browser' }, async () => {
  const report = await study([`${base}/ref`, `${base}/wall`, `${base}/oklch`], { out, wait: 300 });
  const [ref, wall, ok] = report.sites;

  assert.equal(ref.status, 'ok', ref.note);
  assert.equal(ref.probe.grounds[0].color, '#1d2a3a');
  assert.equal(ref.probe.inks[0].color, '#f2e8d5');
  assert.match(ref.probe.type.heading.family, /Georgia/);
  assert.equal(ref.probe.type.heading.size, '64px');
  assert.match(ref.probe.type.body.family, /Arial/);
  assert.equal(ref.probe.textElements, 31);
  assert.deepEqual(ref.shots.map((s) => [s.scroll, s.reached]), [[0, 0], [900, 900]]);
  for (const s of ref.shots) assert.equal(readFileSync(s.file).readUInt32BE(0), 0x89504e47, 'screenshot is not a PNG');

  assert.equal(wall.status, 'wall');
  assert.match(wall.note, /blocked: the page title is "Just a moment"/);

  // A CSS Color 4 value comes back as plain hex, not as rgb(0, 0, 250).
  assert.equal(ok.status, 'ok');
  assert.match(ok.probe.grounds[0].color, /^#[0-9a-f]{6}$/);
  assert.notEqual(ok.probe.grounds[0].color, '#0000fa');

  // Two sites rendered, two shots each: one sheet, four tiles, one row of four.
  assert.equal(report.sheets.length, 1);
  const tiles = report.sheets[0].tiles;
  assert.equal(tiles.length, 4);
  assert.ok(tiles.every((t) => t.loaded), 'a tile did not load');
  assert.ok(tiles.every((t) => !t.label.includes('/wall')), 'the wall reached the sheet');
  const size = jpegSize(readFileSync(report.sheets[0].file));
  assert.equal(size.w, 4 * CELL_W + 5 * 6);
  assert.ok(size.h > 400 && size.h < 460, 'sheet height ' + size.h);
  assert.ok(existsSync(join(out, 'report.json')));
});

test('renderSheets reports a tile that failed to load instead of leaving it grey', { skip: noBrowser && 'no browser' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'idr-sheet-'));
  try {
    // A 1x1 PNG, valid, and a path that does not exist.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    writeFileSync(join(dir, 'one.png'), png);
    const sheets = await withBrowser((s) => renderSheets(s, [{ src: join(dir, 'one.png'), label: 'real' }, { src: join(dir, 'missing.png'), label: 'gone' }], { out: dir }));
    assert.deepEqual(sheets[0].tiles.map((t) => t.loaded), [true, false]);
    assert.equal(jpegSize(readFileSync(sheets[0].file)).w, 2 * CELL_W + 3 * 6);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('close() ends the browser it started', { skip: noBrowser && 'no browser' }, async () => {
  const b = await launch();
  const alive = await fetch(`http://127.0.0.1:${b.port}/json/version`).then((r) => r.ok, () => false);
  assert.equal(alive, true);
  await b.close();
  const after = await fetch(`http://127.0.0.1:${b.port}/json/version`, { signal: AbortSignal.timeout(1000) }).then((r) => r.ok, () => false);
  assert.equal(after, false, 'the browser still answers after close()');
  assert.equal(existsSync(b.udd), false, 'the temporary profile was left behind');
});
