import { http, file_server } from "../deps.ts";

export async function serveTemplatedHtml(req: http.ServerRequest, templatePath: string, replacements: Record<string,string> = {}) {
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

export async function servePublic(req: http.ServerRequest, path: string, status = 200) {
  try {
    req.respond({
      ...await file_server.serveFile(req, 'public/'+path),
      status,
    });
  } catch (err) {
    req.respond(makeErrorResponse(err));
  }
}

export function makeErrorResponse(err: Error): http.Response {
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
