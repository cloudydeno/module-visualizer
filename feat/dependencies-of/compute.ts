import { SubProcess } from "https://crux.land/454pqj#sub-process@v2";
export { SubProcess };
export type { SubprocessErrorData } from "https://crux.land/454pqj#sub-process@v2";

import { DenoInfo } from "../../lib/types.ts";
import { computeDependencies } from "../../lib/module-map.ts";

export async function computeGraph(
  modUrl: string,
  args: URLSearchParams,
  format?: string,
) {
  if (format) args.set('format', format);

  const downloadData = JSON.parse(await new SubProcess('download', {
    cmd: ["deno", "info", "--unstable", "--json", "--", modUrl],
    env: { "NO_COLOR": "yas" },
    stdin: 'null',
    errorPrefix: /^error: /,
  }).captureAllTextOutput()) as DenoInfo;

  return computeDependencies(downloadData, args);
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
