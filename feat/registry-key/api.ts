import { entities } from "../../deps.ts";

import { serveTemplatedHtml } from '../../lib/request-handling.ts';
import { ModuleColors } from "../../lib/module-registries.ts";

export async function handleRequest(req: Request) {

  const moduleKey = Object
    .entries(ModuleColors)
    .filter(x => x[0].includes('.'))
    .map(([registry, color]) =>
      `<div style="background-color: ${entities.encode(color)}">${entities.encode(registry)}</div>`)
    .join(`\n`);

  const extraKey = Object
    .entries(ModuleColors)
    .filter(x => !x[0].includes('.'))
    .map(([registry, color]) =>
      `<div style="background-color: ${entities.encode(color)}">${entities.encode(registry)}</div>`)
    .join(`\n`);

  return await serveTemplatedHtml(req, 'feat/registry-key/public.html', {
    module_key: moduleKey.replace(/^/gm, '  '),
    extra_key: extraKey.replace(/^/gm, '  '),
  });
}
