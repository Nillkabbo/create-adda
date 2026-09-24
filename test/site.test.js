import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSite, renderReply } from '../scripts/build-site.mjs';

const html = buildSite();
const text = (path) => readFileSync(new URL(`../src/profiles/everyday/${path}`, import.meta.url), 'utf8').trim();
const escaped = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('the page is Bangla and carries all three texts exactly as the eval tests them', () => {
  assert.match(html, /<html lang="bn">/);
  for (const path of ['base.md', 'skills/write.md', 'skills/explain.md']) {
    assert.ok(html.includes(escaped(text(path))), `${path} is missing or altered on the page`);
  }
});

test('each text has a copy button that points at its own text', () => {
  const ids = [...html.matchAll(/data-copy="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['t-base', 't-write', 't-explain']);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`));
});

test('the page loads nothing from other sites, so no visit is tracked', () => {
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+href=/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /@import|url\(/);
});

test('the page warns never to share an OTP, PIN, or password', () => {
  assert.match(html, /OTP, পিন, পাসওয়ার্ড/);
});

test('renderReply turns bullets and bold into markup and escapes everything else', () => {
  const out = renderReply('**Title**\n- one <b>\n- two\nplain');
  assert.match(out, /<strong>Title<\/strong>/);
  assert.match(out, /<ul><li>one &lt;b&gt;<\/li><li>two<\/li><\/ul>/);
  assert.match(out, /<p>plain<\/p>/);
});

test('renderReply cuts a long reply at a line boundary and marks the cut', () => {
  const out = renderReply(['a'.repeat(300), 'b'.repeat(300), 'c'.repeat(300)].join('\n'), 520);
  assert.match(out, /class="cut"/);
  assert.ok(!out.includes('c'.repeat(10)));
});

test('the page tells users that Bangla script works better on smaller models', () => {
  assert.match(html, /বাংলা হরফে লিখলে সাধারণত ভালো উত্তর আসে/);
});
