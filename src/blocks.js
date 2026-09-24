// Start marker flags record what --remove needs to undo an install exactly:
//   created-file  this tool created the file, so --remove may delete it
//   no-eol        the file had no trailing newline before the block was appended
const START_RE = /<!-- adda:start((?: [a-z-]+)*) -->/;
const END = '<!-- adda:end -->';

function findBlock(text) {
  const match = START_RE.exec(text);
  if (!match) return null;
  const end = text.indexOf(END, match.index);
  if (end === -1) return null;
  const flags = match[1].trim().split(' ').filter(Boolean);
  return {
    start: match.index,
    end: end + END.length,
    created: flags.includes('created-file'),
    noEol: flags.includes('no-eol'),
  };
}

const startMarker = ({ created, noEol }) =>
  `<!-- adda:start${created ? ' created-file' : ''}${noEol ? ' no-eol' : ''} -->`;

export function blockCreatedFile(text) {
  return Boolean(findBlock(text)?.created);
}

export function upsertBlock(text, body, { createdFile = false } = {}) {
  const found = findBlock(text);
  const block = (flags) => `${startMarker(flags)}\n${body.trim()}\n${END}`;
  if (found) return text.slice(0, found.start) + block(found) + text.slice(found.end);
  if (!text) return `${block({ created: createdFile, noEol: false })}\n`;
  // Keep the user's text byte for byte and add a blank line before the block.
  const noEol = !text.endsWith('\n');
  return `${text}${noEol ? '\n\n' : '\n'}${block({ created: false, noEol })}\n`;
}

export function removeBlock(text) {
  const found = findBlock(text);
  if (!found) return text;
  const before = text.slice(0, found.start);
  const rest = text.slice(found.end);
  // A block at the end of the file: drop exactly the separator the install added.
  if (/^\n?$/.test(rest)) {
    if (!before.trim()) return '';
    if (found.noEol && before.endsWith('\n\n')) return before.slice(0, -2);
    return before.endsWith('\n\n') ? before.slice(0, -1) : before;
  }
  const head = before.trimEnd();
  const after = rest.replace(/^\s+/, '');
  if (!head) return after;
  return `${head}\n\n${after}`;
}

const GITIGNORE_HEADER = '# adda';

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
