import { serve, ServerRequest } from "https://deno.land/std@0.85.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.85.0/http/file_server.ts";
import * as entities from "https://deno.land/x/html_entities@v1.0/lib/xml-entities.js";

let port = 5000;
try {
  port = parseInt(Deno.env.get('PORT') || `${port}`);
} catch (err) {
  console.error(`WARN: failed to read $PORT due to ${err.name}`);
}

for await (const req of serve({ port })) {
  console.log(req.method, req.url);
  const url = new URL(req.url, 'http://localhost');
  const args = new URLSearchParams(url.search);

  {
    const match = url.pathname.match(/^\/svg\/dependencies-of\/https\/(.+)$/);
    if (match && req.method === 'GET') {
      // TODO: check Origin is us
      const url = 'https://'+decodeURI(match[1]);
      serveSvg(req, url, args);
      continue;
    }
  }

  {
    const match = url.pathname.match(/^\/dependencies-of\/https\/(.+)$/);
    if (match && req.method === 'GET') {
      const url = 'https://'+decodeURI(match[1]);
      serveDependenciesOf(req, url, args);
      continue;
    }
  }

  if (url.pathname === '/') {
    servePublic(req, 'index.html');
  // } else if (['/depends-on.html'].includes(url.pathname)) {
  //   servePublic(req, url.pathname);
  } else {
    servePublic(req, '404.html', 404);
  }
}

async function generateSvg(modUrl: string, args: URLSearchParams) {
  const proc = Deno.run({
    cwd: 'dependencies-of',
    cmd: ["./render.sh", modUrl, "svg", args.toString()],
    stdin: 'null',
    stdout: 'piped',
    stderr: 'inherit',
  });

  const [data, status] = await Promise.all([
    Deno.readAll(proc.stdout),
    proc.status(),
  ]);

  if (status.code !== 0) {
    throw new Error(`Graph rendering resulted in exit code ${status.code}`);
  } else if (data.length < 2) {
    throw new Error(`Unable to build graph. Is there really a module served at that URL?`);
  } else {
    return data;
  }
}

function serveSvg(req: ServerRequest, modUrl: string, args: URLSearchParams) {
  generateSvg(modUrl, args)
    .then(data => ({
      status: 200,
      body: data,
      headers: new Headers({
        'content-type': 'image/svg+xml',
      }),
    }), err => ({
      status: 500,
      body: `Internal Server Error: ${err.message}`,
      headers: new Headers({
        'content-type': 'text/plain',
      }),
    }))
    .then(resp => req.respond(resp));
}

async function servePublic(req: ServerRequest, path: string, status = 200) {
  try {
    req.respond({
      ...await serveFile(req, 'public/'+path),
      status,
    });
  } catch (err) {
    if (err.name === 'NotFound') {
      req.respond({
        status: 404,
        body: '404 Not Found',
      });
    } else {
      req.respond({
        status: 500,
        body: err.message,
      });
    }
  }
}

async function serveDependenciesOf(req: ServerRequest, url: string, args: URLSearchParams) {
  args.set('font', 'Pragati Narrow');

  const [template, fullSvg] = await Promise.all([
    Deno.readTextFile('dependencies-of/public.html'),
    generateSvg(url, args).then(
      raw => new TextDecoder().decode(raw),
      err => `<!-- error -->\n<div id="graph-error">${err.message}</div>`),
  ]);

  const html = template
  .replace(/{{ module_url }}/g, entities.encode(url))
  .replace(/{{ current_path }}/g, entities.encode(req.url));

  const inlineSvg = fullSvg
    .slice(fullSvg.indexOf('<!--'))
    .replace(/<svg width="[^"]+" height="[^"]+"/, '<svg id="graph"');

  req.respond({
    status: 200,
    body: `${html}\n${inlineSvg}`,
    headers: new Headers({
      'content-type': 'text/html; charset=utf-8',
    }),
  });
}
