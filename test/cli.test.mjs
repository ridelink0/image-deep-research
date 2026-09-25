// The command lines as a person types them: every usage mistake is one line
// on stderr and exit code 2, never a stack trace. No network and no browser
// is reached on these paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = (name) => fileURLToPath(new URL(`../skills/image-deep-research/scripts/${name}.mjs`, import.meta.url));
const run = (name, args) => spawnSync(process.execPath, [script(name), ...args], { encoding: 'utf8', timeout: 30000 });

const cases = [
  ['study', [], /usage: node study\.mjs/],
  ['study', ['example.com'], /not a URL: example\.com/],
  ['study', ['--list', 'nope'], /unknown list "nope"/],
  ['study', ['https://example.com', '--width', 'wide'], /whole number/],
  ['study', ['https://example.com', '--out'], /--out needs a value/],
  ['images', [], /usage: node images\.mjs/],
  ['images', ['cats', '--sources', 'openverse,flickr'], /unknown source flickr/],
  ['images', ['cats', '--n', '0'], /--n expected a whole number between 1 and 20/],
];

for (const [name, args, message] of cases) {
  test(`${name} ${args.join(' ') || '(no arguments)'} is a one-line usage error`, () => {
    const r = run(name, args);
    assert.equal(r.status, 2, r.stderr + r.stdout);
    assert.match(r.stderr, message);
    assert.doesNotMatch(r.stderr, /\n\s+at /, 'a stack trace leaked');
  });
}
