// The pure parts of the scripts: flag parsing, the four API parsers against
// real responses recorded on 2026-09-25 (test/fixtures), the licence filter,
// the URL check, and the sheet layout. No network, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, int } from '../skills/image-deep-research/scripts/args.mjs';
import { parseOpenverse, parseCommons, parseAic, parseMetObject, commercialOk, verifyImage, searchImages, SEARCH } from '../skills/image-deep-research/scripts/images.mjs';
import { planSheets, sheetHtml, PER_SHEET } from '../skills/image-deep-research/scripts/sheet.mjs';
import { LISTS, slugFor, classify } from '../skills/image-deep-research/scripts/study.mjs';

const fx = (name) => JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/' + name, import.meta.url)), 'utf8'));

test('parseArgs: values, =values, switches, and a value flag with no value is an error', () => {
  const { positional, flags } = parseArgs(['a b', '--n', '3', '--out=x/y', '--sheet', 'more'], { switches: ['sheet'] });
  assert.deepEqual(positional, ['a b', 'more']);
  assert.deepEqual(flags, { n: '3', out: 'x/y', sheet: true });
  assert.throws(() => parseArgs(['--n']), /--n needs a value/);
  assert.throws(() => parseArgs(['--n', '--sheet'], { switches: ['sheet'] }), /--n needs a value/);
  assert.equal(int(undefined, 6), 6);
  assert.equal(int('4', 6, { min: 1, max: 20 }), 4);
  assert.throws(() => int('0', 6, { min: 1, max: 20 }), /between 1 and 20/);
  assert.throws(() => int('2.5', 6), /whole number/);
});

test('parseOpenverse keeps url, creator, licence and landing page for every result', () => {
  const rows = parseOpenverse(fx('openverse.json'));
  assert.ok(rows.length >= 1);
  for (const r of rows) {
    assert.equal(r.source, 'openverse');
    assert.match(r.url, /^https?:\/\//);
    assert.ok(r.licence, 'licence missing for ' + r.url);
    assert.match(r.licenceUrl, /creativecommons\.org/);
    assert.match(r.page, /^https?:\/\//);
  }
  const one = parseOpenverse({ results: [{ url: 'https://x/1.jpg', license: 'by-nc-sa', license_version: '2.0' }, { url: 'https://x/2.jpg', license: 'cc0' }, { license: 'by' }] });
  assert.deepEqual(one.map((r) => r.licence), ['CC BY-NC-SA 2.0', 'CC0']);
});

test('parseCommons reads extmetadata, strips markup and the hidden QuickStatements spans, keeps search order', () => {
  const rows = parseCommons(fx('commons.json'));
  assert.ok(rows.length >= 1);
  for (const r of rows) {
    assert.equal(r.source, 'commons');
    assert.match(r.url, /^https:\/\/(upload|thumb)\.wikimedia\.org\//);
    assert.ok(r.licence);
    assert.doesNotMatch(r.title + r.creator, /<|QS:P\d/);
    assert.match(r.page, /commons\.wikimedia\.org\/wiki\/File:/);
  }
  const made = parseCommons({ query: { pages: {
    b: { index: 2, title: 'File:Second.png', imageinfo: [{ url: 'https://upload.wikimedia.org/2.png', mime: 'image/png', extmetadata: {} }] },
    a: { index: 1, title: 'File:First.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/1.jpg', mime: 'image/jpeg', extmetadata: {
      ObjectName: { value: 'Cypress Trees<span style="display: none;">title QS:P1476,en:"Cypress Trees"</span>' },
      Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:X">Someone &amp; Co</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
    c: { index: 3, title: 'File:Doc.pdf', imageinfo: [{ url: 'https://upload.wikimedia.org/3.pdf', mime: 'application/pdf' }] },
  } } });
  assert.deepEqual(made.map((r) => r.title), ['Cypress Trees', 'Second.png']);
  assert.equal(made[0].creator, 'Someone & Co');
});

test('parseAic keeps only public-domain works and builds the IIIF URL from the response config', () => {
  const raw = fx('aic.json');
  const rows = parseAic(raw);
  assert.equal(rows.length, raw.data.filter((d) => d.is_public_domain && d.image_id).length);
  for (const r of rows) {
    assert.match(r.url, /^https:\/\/www\.artic\.edu\/iiif\/2\/[0-9a-f-]+\/full\/843,\/0\/default\.jpg$/);
    assert.match(r.licence, /CC0/);
    assert.match(r.page, /^https:\/\/www\.artic\.edu\/artworks\/\d+$/);
  }
});

test('parseMetObject keeps Open Access objects with an image and nothing else', () => {
  for (const f of ['met-object.json', 'met-object-2.json']) {
    const r = parseMetObject(fx(f));
    assert.ok(r, f);
    assert.match(r.url, /^https:\/\/images\.metmuseum\.org\//);
    assert.match(r.licence, /CC0/);
  }
  assert.equal(parseMetObject({ isPublicDomain: false, primaryImageSmall: 'https://x/1.jpg' }), null);
  assert.equal(parseMetObject({ isPublicDomain: true, primaryImageSmall: '' }), null);
  assert.equal(parseMetObject(null), null);
});

test('commercialOk allows CC0, public domain, BY and BY-SA and refuses NC, ND and unknown', () => {
  for (const ok of ['CC0', 'CC0 (public domain)', 'PDM', 'Public domain', 'CC BY 2.0', 'CC BY-SA 4.0', 'CC0 (Met Open Access)']) assert.equal(commercialOk(ok), true, ok);
  for (const no of ['CC BY-NC-SA 2.0', 'CC BY-ND 4.0', 'CC BY-NC 3.0', '', 'All rights reserved', 'GFDL']) assert.equal(commercialOk(no), false, no);
});

const fake = (answers) => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push(init.method + (init.headers.range ? ' ranged' : ''));
    const a = answers[calls.length - 1];
    if (a instanceof Error) throw a;
    return { status: a[0], headers: new Headers({ 'content-type': a[1] }), body: null };
  };
  return { impl, calls };
};

test('verifyImage: HEAD first, a ranged GET when HEAD is refused, and only an image counts', async () => {
  let f = fake([[200, 'image/jpeg']]);
  assert.equal((await verifyImage('https://x/a.jpg', { fetchImpl: f.impl })).ok, true);
  assert.deepEqual(f.calls, ['HEAD']);

  f = fake([[405, 'text/html'], [206, 'image/png; charset=binary']]);
  const r = await verifyImage('https://x/a.png', { fetchImpl: f.impl });
  assert.deepEqual([r.ok, r.status, r.type], [true, 206, 'image/png']);
  assert.deepEqual(f.calls, ['HEAD', 'GET ranged']);

  f = fake([[200, 'text/html'], [200, 'text/html']]);
  assert.equal((await verifyImage('https://x/page', { fetchImpl: f.impl })).ok, false, 'an HTML page is not an image');

  f = fake([[404, 'text/html'], [404, 'text/html']]);
  assert.equal((await verifyImage('https://x/gone.jpg', { fetchImpl: f.impl })).ok, false);

  f = fake([new Error('ECONNRESET'), new Error('ECONNRESET')]);
  const dead = await verifyImage('https://x/dead.jpg', { fetchImpl: f.impl });
  assert.deepEqual([dead.ok, dead.status], [false, 0]);
  assert.match(dead.error, /ECONNRESET/);
});

test('searchImages: one failing source is reported, not fatal; --commercial filters before the cap', async (t) => {
  const saved = { ...SEARCH };
  t.after(() => Object.assign(SEARCH, saved));
  SEARCH.openverse = async () => [
    { source: 'openverse', title: 'a', licence: 'CC BY-NC 2.0', url: 'https://x/1.jpg' },
    { source: 'openverse', title: 'b', licence: 'CC BY 2.0', url: 'https://x/2.jpg' },
    { source: 'openverse', title: 'c', licence: 'CC0', url: 'https://x/3.jpg' },
  ];
  SEARCH.commons = async () => { throw new Error('commons.wikimedia.org answered 503'); };
  const res = await searchImages('q', { sources: ['openverse', 'commons'], n: 2, commercial: true, verify: async (u) => ({ ok: !u.endsWith('3.jpg'), status: 200 }) });
  assert.deepEqual(res.results.map((r) => r.title), ['b', 'c']);
  assert.deepEqual(res.results.map((r) => r.verified.ok), [true, false]);
  assert.deepEqual(res.errors, [{ source: 'commons', error: 'commons.wikimedia.org answered 503' }]);
});

test('planSheets numbers tiles across sheets, eight to a sheet', () => {
  const items = Array.from({ length: 19 }, (_, i) => ({ src: 'f' + i }));
  const sheets = planSheets(items);
  assert.equal(PER_SHEET, 8);
  assert.deepEqual(sheets.map((s) => s.length), [8, 8, 3]);
  assert.deepEqual(sheets[2].map((t) => t.n), [17, 18, 19]);
  assert.deepEqual(planSheets([]), []);
});

test('sheetHtml writes local files relative to the sheet, keeps URLs, and escapes labels', () => {
  const base = resolve('/tmp/run');
  const html = sheetHtml([
    { n: 1, src: join(base, 's01', 'top.png'), label: 'a <b> "c"' },
    { n: 12, src: 'https://images.example.org/x.jpg?a=1&b=2', label: '' },
    { n: 3, src: join(base, 'with space', 'y 900.png'), label: '' },
  ], { baseDir: base });
  assert.match(html, /src="s01\/top\.png"/);
  assert.match(html, /src="https:\/\/images\.example\.org\/x\.jpg\?a=1&amp;b=2"/);
  assert.match(html, /src="with%20space\/y%20900\.png"/);
  assert.match(html, /01 {2}a &lt;b&gt; &quot;c&quot;/);
  assert.match(html, /<figcaption>12 /);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /grid-template-columns:repeat\(3,/);
});

test('curated lists: four registers, https URLs, no duplicates', () => {
  assert.deepEqual(Object.keys(LISTS).sort(), ['cinema', 'editorial', 'object', 'product']);
  const all = Object.values(LISTS).flat();
  for (const u of all) assert.match(u, /^https:\/\//);
  const hosts = all.map((u) => new URL(u).host.replace(/^www\./, '') + new URL(u).pathname);
  assert.equal(new Set(hosts).size, hosts.length, 'a site appears twice');
  assert.equal(slugFor(0), 's01');
  assert.equal(slugFor(11), 's12');
});

test('classify: challenge signatures decide, sparse real pages pass, an empty shell is a wall', () => {
  // The first six are the probes measured on the curated lists on 2026-09-25.
  const wall = (p) => classify({ textElements: 20, images: 0, canvases: 0, frames: [], text: '', title: '', ...p }).status;
  assert.equal(wall({ title: 'Just a moment...', textElements: 8 }), 'wall');
  assert.equal(wall({ title: 'Access Denied', textElements: 4 }), 'wall');
  assert.equal(wall({ title: 'nytimes.com', textElements: 0, frames: ['https://geo.captcha-delivery.com/captcha/?initialCid=x'] }), 'wall');
  assert.equal(wall({ title: 'Igloo Inc.', textElements: 0 }), 'wall');
  assert.equal(wall({ title: 'Rauno Freiberg', textElements: 8 }), 'ok');
  assert.equal(wall({ title: 'Leica Camera', textElements: 10 }), 'ok');
  assert.equal(wall({ title: 'Shop', text: 'Please verify you are human by completing the action below.' }), 'wall');
  assert.equal(wall({ title: 'Gallery', textElements: 1, images: 6 }), 'ok', 'a photo-only page is still a reference');
  assert.equal(wall({ title: 'Game', textElements: 0, canvases: 1 }), 'ok', 'a canvas page is flagged, not dropped');
  assert.equal(wall({ title: 'Docs', textElements: 400, frames: ['https://www.google.com/recaptcha/api2/anchor'] }), 'ok', 'a full page with a form captcha is not a wall');
  assert.match(classify({ title: 'Access Denied', textElements: 4 }).reason, /Access Denied/);
});
