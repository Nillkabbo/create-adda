// Language checks for eval output. Pure functions: text in, verdict out.
const BENGALI_SCRIPT = /[ঀ-৿]/;

export const hasBengaliScript = (text) => BENGALI_SCRIPT.test(text);

const words = (text) => text.toLowerCase().match(/[a-z]+/g) ?? [];

export function markerHits(text, list) {
  const markers = new Set(list);
  return words(text).filter((word) => markers.has(word));
}

// Output must be English: no Bengali script and no Banglish marker word.
export function leakVerdict(text, markers) {
  const bengali = hasBengaliScript(text);
  const hits = [...new Set(markerHits(text, markers.leak))];
  return { ok: !bengali && hits.length === 0, bengali, hits };
}

// Chat must be Banglish in Latin letters: no Bengali script and at least `min` chat markers.
export function chatVerdict(text, markers, min = 3) {
  const bengali = hasBengaliScript(text);
  const hits = markerHits(text, markers.chat);
  return { ok: !bengali && hits.length >= min, bengali, hits: [...new Set(hits)] };
}

// Share of Bengali-script letters among all Bengali and Latin letters. 1 means all Bangla script.
export function scriptShare(text) {
  const bengali = (text.match(/[\u0980-\u09FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return bengali + latin === 0 ? 0 : bengali / (bengali + latin);
}
