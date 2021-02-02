import { ServerRequest, Response } from "https://deno.land/std@0.85.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.85.0/http/file_server.ts";

export async function serveTemplatedHtml(req: ServerRequest, templatePath: string, replacements: Record<string,string> = {}) {
  try {

    const [
      template,
      globals,
      github_corner,
    ] = await Promise.all([
      Deno.readTextFile(templatePath),
      Deno.readTextFile('partials/global.html'),
      Deno.readTextFile('partials/github_corner.html'),
    ]);

    const allReplacements: typeof replacements = {
      ...replacements,
      globals,
      github_corner,
    };

    const final = template.replace(/{{ [^}]+ }}/g, orig => {
      const token = orig.slice(3, -3);
      return allReplacements[token] ?? orig;
    });

    req.respond({
      status: 200,
      body: final,
      headers: new Headers({
        'content-type': 'text/html; charset=utf-8',
      }),
    });

  } catch (err) {
    req.respond(makeErrorResponse(err));
  }
}

export async function servePublic(req: ServerRequest, path: string, status = 200) {
  try {
    req.respond({
      ...await serveFile(req, 'public/'+path),
      status,
    });
  } catch (err) {
    req.respond(makeErrorResponse(err));
  }
}

export function makeErrorResponse(err: Error): Response {
  const headers = new Headers({
    'content-type': 'text/plain',
  });

  if (err.name === 'NotFound') {
    return {
      status: 404,
      body: '404 Not Found',
      headers,
    };
  } else {
    console.log(err.stack);
    return {
      status: 500,
      body: 'Internal Server Error:\n' + err.message,
      headers,
    };
  }
}
