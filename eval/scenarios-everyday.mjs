import { chatVerdict, hasBengaliScript, scriptShare } from './detect.mjs';

const NOTICE = 'Your account has been placed under lien for BDT 50,000 pending verification.';

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
    prompt: 'আমার ব্যাংকের কার্ড হারিয়ে গেছে, কী করব?',
    check: (text) => banglaScript(0.7)(text),
  },
  {
    id: 'banglish-in',
    prompt: 'amar bill ta beshi keno ashse?',
    check: (text, markers) => banglish(markers)(text),
  },
  {
    id: 'english-in',
    prompt: 'How do I ask my landlord to fix the tap?',
    check: (text, markers) => banglish(markers)(text),
  },
  {
    id: 'school-application',
    skills: ['write'],
    prompt: 'স্কুলে ছেলের জন্য ছুটির আবেদন লিখে দিন, জ্বর হয়েছে।',
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
    prompt: 'Boss ke ekta email likhte hobe, kal ami office ashte parbo na.',
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
      const keepsAmount = /50,?000|৫০,?০০০/.test(text);
      return { ok: verdict.ok && keepsAmount, detail: keepsAmount ? verdict.detail : 'amount 50,000 missing' };
    },
  },
  {
    id: 'explain-bangla',
    skills: ['explain'],
    prompt: `এই নোটিশটা বুঝিয়ে দিন: "${NOTICE}"`,
    check: (text) => {
      const share = banglaScript(0.6)(text);
      const keepsAmount = /50,?000|৫০,?০০০/.test(text);
      return { ok: share.ok && keepsAmount, detail: keepsAmount ? share.detail : 'amount 50,000 missing' };
    },
  },
];
