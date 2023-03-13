import { ModuleGraphJson, SubProcess, trace } from "../../deps.ts";
import { computeDependencies } from "../../lib/module-map.ts";

const tracer = trace.getTracer('dependencies-of')

export async function computeGraph(
  modUrl: string,
  args: URLSearchParams,
  format?: string,
) {
  if (format) args.set('format', format);

  const downloadData = JSON.parse(await new SubProcess('download', {
    cmd: ["deno", "info", "--json", "--", modUrl],
    env: { "NO_COLOR": "yas" },
    stdin: 'null',
    errorPrefix: /^error: /,
  }).captureAllTextOutput()) as ModuleGraphJson;

  return tracer.startActiveSpan('Emit', span => {
    try {
      return computeDependencies(downloadData, args);
    } finally {
      span.end();
    }
  });
}

export async function renderGraph(modUrl: string, dotArgs: string[], args: URLSearchParams) {
  const dotText = await computeGraph(modUrl, args, 'dot');

  const dotProc = new SubProcess('render', {
    cmd: ["dot", ...dotArgs],
    stdin: 'piped',
    errorPrefix: /^Error: /,
  });
  await dotProc.writeInputText(dotText);

  return dotProc;
}
