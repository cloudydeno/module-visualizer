import { SubProcess } from "https://crux.land/Fjf2o#sub-process";
export { SubProcess };
export type { SubprocessErrorData } from "https://crux.land/Fjf2o#sub-process";

import { DenoInfo } from "../../lib/types.ts";
import { computeDependencies } from "../../lib/module-map.ts";
import { fetchModuleGraph } from "../../lib/deno-graph.ts";


export async function computeGraph(
  modUrl: string,
  args: URLSearchParams,
  format?: string,
) {
  if (format) args.set('format', format);

  const downloadData = await fetchModuleGraph(modUrl);

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
