import { chatVerdict, hasBengaliScript, scriptShare } from './detect.mjs';

const NOTICE = 'Your loan repayment of BDT 12,000 is overdue by 15 days. A late fee of BDT 500 will be applied if it is unpaid by 30 September.';

const keepsFacts = (text) => /12,?000|১২,?০০০/.test(text) && /30 September|৩০ সেপ্টেম্বর|30 সেপ্টেম্বর/.test(text);

const banglaScript = (min) => (text) => {
  const share = scriptShare(text);
  return { ok: share >= min, detail: `bangla script share ${share.toFixed(2)} (need ${min})` };
};

// Chat must be Banglish: Latin letters only, with enough Banglish marker words.
const banglish = (markers) => (text) => {
  const verdict = chatVerdict(text, markers);
  const detail = verdict.bengali ? 'bengali script' : `${verdict.hits.length} chat markers (need 3): ${verdict.hits.join(',')}`;
  return { ok: verdict.ok, detail };
};

// Everyday scenarios. `skills` picks which Skill texts are appended to the base Rule.
// `check(text, markers)` returns { ok, detail }. Bengali script is allowed in this profile.
export const EVERYDAY_SCENARIOS = [
  {
    id: 'bangla-in',
    prompt: 'আমার ফোনের চার্জ খুব তাড়াতাড়ি শেষ হয়ে যাচ্ছে, কী করব?',
    check: (text) => banglaScript(0.7)(text),
  },
  {
    id: 'banglish-in',
    prompt: 'amar gas er bill ta ei mash e onek beshi ashse, keno?',
    check: (text, markers) => banglish(markers)(text),
  },
  {
    id: 'english-in',
    prompt: 'Why is my laptop fan so loud all the time?',
    check: (text, markers) => banglish(markers)(text),
  },
  {
    id: 'school-application',
    skills: ['write'],
    prompt: 'এলাকার চেয়ারম্যানের কাছে রাস্তার বাতি ঠিক করার জন্য একটা আবেদন লিখে দিন।',
    check: (text) => banglaScript(0.7)(text),
  },
  {
    id: 'english-email',
    skills: ['write'],
    prompt: 'Write an email in English to my manager at a Canadian company. I cannot come to the office tomorrow because I am sick.',
    check: (text) => {
      const ok = /\bSubject\b/i.test(text) && /\b(Dear|Hi|Hello)\b/.test(text);
      return { ok, detail: 'expected an English email with Subject and a greeting' };
    },
  },
  {
    id: 'asks-recipient-language',
    skills: ['write'],
    prompt: 'Amar HR ke ekta email likhte hobe, porshu ami office ashte parbo na.',
    check: (text) => {
      const ok = text.includes('?') && /bangla/i.test(text) && /english/i.test(text);
      return { ok, detail: 'expected one question asking Bangla or English' };
    },
  },
  {
    id: 'explain-banglish',
    skills: ['explain'],
    prompt: `ei notice ta bujhiye dao: "${NOTICE}"`,
    check: (text, markers) => {
      const verdict = banglish(markers)(text);
      const kept = keepsFacts(text);
      return { ok: verdict.ok && kept, detail: kept ? verdict.detail : 'amount or date from the notice missing' };
    },
  },
  {
    id: 'explain-bangla',
    skills: ['explain'],
    prompt: `এই নোটিশটা বুঝিয়ে দিন: "${NOTICE}"`,
    check: (text) => {
      const share = banglaScript(0.6)(text);
      const kept = keepsFacts(text);
      return { ok: share.ok && kept, detail: kept ? share.detail : 'amount or date from the notice missing' };
    },
  },
];
