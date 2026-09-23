const START = '<!-- banglish-agent:start -->';
const END = '<!-- banglish-agent:end -->';

function findBlock(text) {
  const start = text.indexOf(START);
  if (start === -1) return null;
  const end = text.indexOf(END, start);
  if (end === -1) return null;
  return { start, end: end + END.length };
}

export function upsertBlock(text, body) {
  const inner = `${START}\n${body.trim()}\n${END}`;
  const found = findBlock(text);
  if (found) return text.slice(0, found.start) + inner + text.slice(found.end);
  const existing = text.trimEnd();
  return existing ? `${existing}\n\n${inner}\n` : `${inner}\n`;
}

export function removeBlock(text) {
  const found = findBlock(text);
  if (!found) return text;
  const before = text.slice(0, found.start).trimEnd();
  const after = text.slice(found.end).replace(/^\s+/, '');
  if (!before && !after) return '';
  if (!before) return after;
  if (!after) return `${before}\n`;
  return `${before}\n\n${after}`;
}

const GITIGNORE_HEADER = '# banglish-agent';

function splitLines(text) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function joinLines(lines) {
  return lines.length ? `${lines.join('\n')}\n` : '';
}

// Index range [header, end) of the section: the header plus the non-blank lines after it.
function findSection(lines) {
  const header = lines.indexOf(GITIGNORE_HEADER);
  if (header === -1) return null;
  let end = header + 1;
  while (end < lines.length && lines[end].trim() !== '') end++;
  return { header, end };
}

export function addGitignoreLines(text, entries) {
  const lines = splitLines(text);
  const present = new Set(lines.map((line) => line.trim()));
  const missing = entries.filter((entry) => !present.has(entry));
  if (!missing.length) return text;

  const section = findSection(lines);
  if (section) {
    lines.splice(section.end, 0, ...missing);
    return joinLines(lines);
  }
  while (lines.length && lines.at(-1).trim() === '') lines.pop();
  const separator = lines.length ? [''] : [];
  return joinLines([...lines, ...separator, GITIGNORE_HEADER, ...missing]);
}

export function removeGitignoreLines(text, entries) {
  const lines = splitLines(text);
  const section = findSection(lines);
  if (!section) return text;

  const drop = new Set(entries);
  const kept = lines
    .slice(section.header + 1, section.end)
    .filter((line) => !drop.has(line.trim()));
  if (kept.length) {
    lines.splice(section.header + 1, section.end - section.header - 1, ...kept);
    return joinLines(lines);
  }

  let start = section.header;
  while (start > 0 && lines[start - 1].trim() === '') start--;
  let end = section.end;
  if (start === 0) while (end < lines.length && lines[end].trim() === '') end++;
  lines.splice(start, end - start);
  return joinLines(lines);
}
