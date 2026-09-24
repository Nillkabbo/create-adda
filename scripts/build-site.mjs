#!/usr/bin/env node
// Builds site/index.html: the Bangla page where everyday users copy the Rule and the Skills.
// The texts come from src/profiles/everyday and the hero pair from eval/golden/hero.json,
// so the page can never drift from what the eval tests. It is noindex until a Bangla speaker has
// reviewed the golden examples (issue #7).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').trim();

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const REPO = 'https://github.com/Nillkabbo/create-adda';

const inline = (text) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

// Renders the start of a real model reply: paragraphs, "- " bullets, and **bold**. Long replies
// are cut at a line boundary so the hero stays short; the caller says the reply is real.
export function renderReply(text, maxChars = 520) {
  const kept = [];
  let used = 0;
  let cut = false;
  for (const line of text.split('\n')) {
    if (used + line.length > maxChars && kept.length) {
      cut = true;
      break;
    }
    kept.push(line);
    used += line.length + 1;
  }
  let html = '';
  let inList = false;
  for (const line of kept) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) html += '<ul>';
      inList = true;
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    if (inList) html += '</ul>';
    inList = false;
    if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return cut ? `${html}<p class="cut">…</p>` : html;
}

const CSS = `
:root {
  --ink: #14302b;
  --paper: #f6f8f4;
  --mist: #e3eee8;
  --river: #1d6b5f;
  --river-ink: #ffffff;
  --holud: #f0b400;
  --danger: #b42318;
  --muted: #4d6660;
  --line: #c9d9d1;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #e6f0ec;
    --paper: #0f1f1c;
    --mist: #17302a;
    --river: #58c4b1;
    --river-ink: #0f1f1c;
    --danger: #ff8a7a;
    --muted: #9db8b0;
    --line: #2a4a42;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: "Noto Sans Bengali", "Hind Siliguri", "Kalpurush", "Nirmala UI", "Bangla Sangam MN", system-ui, sans-serif;
  font-size: 1.125rem;
  line-height: 1.75;
}
main { max-width: 38rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
h1 { font-size: 2rem; line-height: 1.35; margin: 0 0 1rem; }
h2 { font-size: 1.4rem; line-height: 1.4; margin: 3rem 0 0.75rem; }
p { margin: 0 0 1rem; }
a { color: var(--river); text-underline-offset: 0.2em; }
:focus-visible { outline: 3px solid var(--holud); outline-offset: 2px; }
.lede { color: var(--muted); }

.pair { display: grid; gap: 1rem; margin: 2rem 0 0; }
.ask { background: var(--mist); padding: 0.75rem 1rem; border-radius: 0.75rem; margin: 0; }
.reply { padding: 0.25rem 0 0.25rem 1rem; border-left: 4px solid var(--line); }
.reply p { margin: 0 0 0.6rem; }
.reply ul { margin: 0 0 0.6rem; padding-left: 1.25rem; }
.reply .cut { color: var(--muted); margin: 0; }
.note { color: var(--muted); font-size: 1rem; margin: 0.5rem 0 0; }
.reply.with { border-left-color: var(--river); }
.who { font-weight: 700; margin: 0 0 0.25rem; }
.who.without { color: var(--muted); }

.steps { padding-left: 1.5rem; }
.steps li { margin-bottom: 0.5rem; }

details { border-top: 1px solid var(--line); padding: 0.75rem 0; }
details:last-of-type { border-bottom: 1px solid var(--line); }
summary { cursor: pointer; font-weight: 700; min-height: 2.75rem; display: flex; align-items: center; }
details > :not(summary) { margin-top: 0.5rem; }

.text-row { border-top: 1px solid var(--line); padding: 1.25rem 0; }
.text-row:last-of-type { border-bottom: 1px solid var(--line); }
.text-row h3 { font-size: 1.15rem; margin: 0 0 0.25rem; }
.text-row p { color: var(--muted); }
pre {
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--mist);
  padding: 1rem;
  border-radius: 0.75rem;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0.75rem 0 0;
}
.copy {
  min-height: 3rem;
  padding: 0.5rem 1.25rem;
  border: 0;
  border-radius: 0.75rem;
  background: var(--river);
  color: var(--river-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.copy[data-done] { background: var(--holud); color: #14302b; }

.safety { border: 2px solid var(--danger); border-radius: 0.75rem; padding: 1rem 1.25rem; margin: 3rem 0 0; }
.safety h2 { margin-top: 0; color: var(--danger); }
.safety p:last-child { margin-bottom: 0; }
footer { margin-top: 3rem; color: var(--muted); font-size: 1rem; }
@media (min-width: 46rem) { .pair { grid-template-columns: 1fr 1fr; } main { max-width: 44rem; } }
`;

const JS = `
document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy).textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    const label = button.textContent;
    button.textContent = 'কপি হয়েছে';
    button.setAttribute('data-done', '');
    setTimeout(() => { button.textContent = label; button.removeAttribute('data-done'); }, 2000);
  });
});
`;

function textRow({ id, title, when, text }) {
  return `<section class="text-row">
  <h3>${title}</h3>
  <p>${when}</p>
  <button class="copy" type="button" data-copy="${id}">কপি করুন</button>
  <details><summary>লেখাটা দেখুন</summary><pre id="${id}" lang="en">${escapeHtml(text)}</pre></details>
</section>`;
}

export function buildSite() {
  const base = read('src/profiles/everyday/base.md');
  const write = read('src/profiles/everyday/skills/write.md');
  const explain = read('src/profiles/everyday/skills/explain.md');
  const hero = JSON.parse(read('eval/golden/hero.json'));

  return `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>আড্ডা: আপনার এআই এবার বাংলায় কথা বলবে</title>
<meta name="description" content="ChatGPT, Claude বা Gemini-কে স্বাভাবিক বাংলায় কথা বলানোর একটা লেখা। কপি করুন, বসান, শেষ।">
<style>${CSS}</style>
</head>
<body>
<main>
<h1>আপনার এআই এবার বাংলায় কথা বলবে, বন্ধুর মতো।</h1>
<p class="lede">ChatGPT, Claude বা Gemini-তে একবার একটা লেখা কপি করে বসিয়ে দিন। কিছু ইনস্টল করতে হবে না।</p>

<div class="pair">
  <p class="ask">${escapeHtml(hero.prompt)}</p>
  <div>
    <p class="who without">আড্ডা ছাড়া</p>
    <div class="reply">${renderReply(hero.without)}</div>
  </div>
  <div>
    <p class="who">আড্ডা সহ</p>
    <div class="reply with">${renderReply(hero.with)}</div>
  </div>
  <p class="note">দুটোই একই এআই-এর আসল উত্তর। লম্বা হওয়ায় শুরুর অংশ দেখানো হয়েছে।</p>
</div>

<h2>কীভাবে শুরু করবেন</h2>
<ol class="steps">
  <li>নিচে থেকে "মূল লেখা" কপি করুন।</li>
  <li>আপনার এআই-এর সেটিংসে সেটা বসিয়ে সেভ করুন।</li>
  <li>এবার যেভাবে ইচ্ছা বাংলায় লিখুন।</li>
</ol>
<p class="lede">একটা কথা: ছোট বা ফ্রি মডেলে ইংরেজি হরফে (যেমন "kemon acho") লিখলে উত্তর মাঝে মাঝে এলোমেলো হতে পারে। বাংলা হরফে লিখলে সাধারণত ভালো উত্তর আসে।</p>

<details><summary>ChatGPT-তে কোথায় বসাবেন</summary>
<p>Settings-এ গিয়ে Personalization, তারপর Custom instructions খুলে লেখাটা বসান। ফ্রি অ্যাকাউন্টে ১,৫০০ অক্ষরের সীমা আছে, মূল লেখাটা তার মধ্যেই আঁটে।</p>
</details>
<details><summary>Claude-এ কোথায় বসাবেন</summary>
<p>বাঁদিকে নিচে আপনার নামের প্রথম অক্ষরে চাপ দিয়ে Settings-এ যান। Profile অংশে "Instructions for Claude" ঘরে লেখাটা বসান। মেনুর নাম কখনো কখনো বদলে যায়।</p>
</details>
<details><summary>Gemini-তে কোথায় বসাবেন</summary>
<p>gemini.google.com-এ Explore Gems খুলে New Gem বেছে নিন। Instructions ঘরে লেখাটা বসিয়ে Save করুন, তারপর ওই Gem-এ কথা বলুন।</p>
</details>

<h2>লেখাগুলো</h2>
${textRow({ id: 't-base', title: 'মূল লেখা', when: 'একবারই বসাতে হবে। এরপর থেকে আপনার এআই স্বাভাবিক বাংলায় কথা বলবে।', text: base })}
${textRow({ id: 't-write', title: 'চিঠি, আবেদন বা মেসেজ লিখতে', when: 'দরকার হলে এটা চ্যাটে কপি করে পাঠান, তারপর কী লিখতে চান বলুন।', text: write })}
${textRow({ id: 't-explain', title: 'কোনো কাগজ বুঝতে', when: 'দরকার হলে এটা চ্যাটে কপি করে পাঠান, তারপর কাগজের লেখাটা পাঠান।', text: explain })}

<section class="safety">
  <h2>একটা জরুরি কথা</h2>
  <p>OTP, পিন, পাসওয়ার্ড বা এনআইডি নম্বর কোনো এআই-কে কখনো দেবেন না। কাগজ পাঠানোর আগে এসব মুছে নিন।</p>
  <p>স্বাস্থ্য বা আইনের কাগজে এআই শুধু বুঝিয়ে দেয়। সিদ্ধান্ত নেওয়ার আগে ডাক্তার বা উকিলের সঙ্গে কথা বলুন।</p>
</section>

<footer>
  <p>এআই ভুল করতে পারে। কোনো উত্তর বা বাংলা অস্বাভাবিক লাগলে <a href="${REPO}/issues">আমাদের জানান</a>। <a href="${REPO}">সোর্স কোড</a> সবার জন্য খোলা।</p>
</footer>
</main>
<script>${JS}</script>
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = new URL('site/index.html', root);
  mkdirSync(new URL('site/', root), { recursive: true });
  writeFileSync(out, buildSite());
  console.log(`Wrote ${fileURLToPath(out)}`);
}
