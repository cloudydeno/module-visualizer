import { http, file_server } from "../deps.ts";

export const HtmlHeaders = new Headers({
  'content-type': 'text/html; charset=utf-8',
});
export const TextHeaders = new Headers({
  'content-type': 'text/text; charset=utf-8',
});

export async function templateHtml(templatePath: string, replacements: Record<string,string> = {}) {
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

  return template.replace(/{{ [^}]+ }}/g, orig => {
    const token = orig.slice(3, -3);
    return allReplacements[token] ?? orig;
  });
}

export async function serveTemplatedHtml(req: http.ServerRequest, templatePath: string, replacements: Record<string,string> = {}) {
  await templateHtml(templatePath, replacements)
    .then(body => ({ body,
      headers: HtmlHeaders,
    }))
    .catch(makeErrorResponse)
    .then(resp => req.respond(resp));
}

export async function servePublic(req: http.ServerRequest, path: string) {
  await file_server
    .serveFile(req, 'public/'+path)
    .catch(makeErrorResponse)
    .then(resp => req.respond(resp));
}

export async function serveFont(req: http.ServerRequest, path: string) {
  await file_server
    .serveFile(req, 'fonts/'+path)
    .then(resp => {
      if (resp.status === 200) {
        resp.headers?.set('cache-control', 'public, max-age=2592000'); // 30d
      }
      return resp;
    })
    .catch(makeErrorResponse)
    .then(resp => req.respond(resp));
}

export function makeErrorResponse(err: Error): http.Response {
  if (err.name === 'NotFound') {
    return {
      status: 404,
      body: '404 Not Found',
      headers: TextHeaders,
    };
  } else {
    console.log(err.stack);
    return {
      status: 500,
      body: 'Internal Server Error:\n' + err.message,
      headers: TextHeaders,
    };
  }
}
