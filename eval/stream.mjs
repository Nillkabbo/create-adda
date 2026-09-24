// Parses `claude -p --output-format stream-json` output into chat text and tool calls.
export function parseStream(stdout) {
  const text = [];
  const tools = [];
  let sessionId;
  let result;
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    sessionId ??= event.session_id;
    if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type === 'text') text.push(block.text);
        if (block.type === 'tool_use') tools.push({ name: block.name, input: block.input ?? {} });
      }
    }
    if (event.type === 'result') result = event;
  }
  const chat = text.length ? text.join('\n') : (result?.result ?? '');
  return { chat, tools, sessionId, isError: Boolean(result?.is_error) || !result };
}
