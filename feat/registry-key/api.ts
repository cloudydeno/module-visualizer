import { http, entities } from "../../deps.ts";

import { serveTemplatedHtml } from '../../lib/request-handling.ts';
import { ModuleColors } from "../../lib/module-registries.ts";

export async function handleRequest(req: http.ServerRequest) {

  const moduleKey = Object
    .entries(ModuleColors)
    .map(([registry, color]) =>
      `<div style="background-color: ${entities.encode(color)}">${entities.encode(registry)}</div>`)
    .join(`\n`);

  await serveTemplatedHtml(req, 'feat/registry-key/public.html', {
    module_key: moduleKey.replace(/^/gm, '  '),
  });

  return true;
}
