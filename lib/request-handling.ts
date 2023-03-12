import { http, file_server, trace, context } from "../deps.ts";

export const HtmlHeaders = new Headers({
  'content-type': 'text/html; charset=utf-8',
});
export const TextHeaders = new Headers({
  'content-type': 'text/text; charset=utf-8',
});


const tracer = trace.getTracer('html-templating');

export function templateHtml(templatePath: string, replacements: Record<string,string> = {}) {
  return tracer.startActiveSpan(`Render ${templatePath}`, {
    attributes: {
      'template_path': templatePath,
    },
  }, span =>
    templateHtmlInner(templatePath, replacements)
      .finally(() => span.end()));
}

async function templateHtmlInner(templatePath: string, replacements: Record<string,string> = {}) {
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

export async function serveTemplatedHtml(req: Request, templatePath: string, replacements: Record<string,string> = {}) {
  return await templateHtml(templatePath, replacements)
    .then(body => new Response(body, {
      headers: HtmlHeaders,
    }))
    .catch(makeErrorResponse);
}

export async function servePublic(req: Request, path: string) {
  return await file_server
    .serveFile(req, 'public/'+path)
    .catch(makeErrorResponse);
}

export async function serveFont(req: Request, path: string) {
  return await file_server
    .serveFile(req, 'fonts/'+path)
    .then(resp => {
      if (resp.status === 200) {
        resp.headers?.set('cache-control', 'public, max-age=2592000'); // 30d
      }
      return resp;
    })
    .catch(makeErrorResponse);
}

export function makeErrorResponse(err: Error): Response {
  if (err.name === 'NotFound') {
    return new Response('404 Not Found', {
      status: 404,
      headers: TextHeaders,
    });
  } else {
    console.log(err.stack);
    return new Response('Internal Server Error:\n' + err.message, {
      status: 500,
      headers: TextHeaders,
    });
  }
}
