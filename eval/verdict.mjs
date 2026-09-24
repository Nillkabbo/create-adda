// Decides whether an eval run verified the Rule. Models are noisy on short replies, so a scenario
// passes when most of its runs pass; a single errored run fails it, since nothing was checked.
// results[column][scenarioId] = [{ status: 'pass' | 'fail' | 'na' | 'error', detail }]
export function unverified(results) {
  const problems = [];
  for (const [column, rows] of Object.entries(results)) {
    for (const [id, runs] of Object.entries(rows)) {
      const passed = runs.filter((run) => run.status === 'pass').length;
      if (runs.some((run) => run.status === 'error')) problems.push(`${column} / ${id}: a run errored`);
      else if (passed * 2 <= runs.length) problems.push(`${column} / ${id}: ${passed}/${runs.length} passed`);
    }
  }
  return problems;
}
