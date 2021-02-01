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
    serveTemplatedHtml(req, 'public/index.html');
  } else if (['/global.css'].includes(url.pathname)) {
    servePublic(req, url.pathname);
  } else {
    req.respond({
      status: 404,
      body: '404 Not Found',
    });
  }
}

async function generateSvg(modUrl: string, args: URLSearchParams) {
  const proc = Deno.run({
    cwd: 'dependencies-of',
    cmd: ["./render.sh", modUrl, "svg", args.toString()],
    env: {'NO_COLOR': 'yas'},
    stdin: 'null',
    stdout: 'piped',
    stderr: 'piped',
  });

  const [data, progress, status] = await Promise.all([
    Deno.readAll(proc.stdout),
    Deno.readAll(proc.stderr),
    proc.status(),
  ]);
  Deno.writeAll(Deno.stderr, progress);

  if (status.code !== 0) {
    throw new Error(`Graph rendering resulted in exit code ${status.code}`);
  } else if (data.length < 2) {
    const error = new TextDecoder().decode(progress).split('\n').find(x => x.startsWith('error: ')) || 'Is there really a module served at that URL?';
    throw new Error(`Unable to build graph. ${error}`);
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

async function serveTemplatedHtml(req: ServerRequest, templatePath: string, replacements: Record<string,string> = {}) {
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

async function serveDependenciesOf(req: ServerRequest, modUrl: string, args: URLSearchParams) {
  args.set('font', 'Pragati Narrow');

  const svgText = await generateSvg(modUrl, args).then(
    raw => {
      const fullSvg = new TextDecoder().decode(raw);
      return fullSvg
        .slice(fullSvg.indexOf('<!--'))
        .replace(/<svg width="[^"]+" height="[^"]+"/, '<svg id="graph"');
    },
    err => `<div id="graph-error">${err.message}</div>`);

  await serveTemplatedHtml(req, 'dependencies-of/public.html', {
    graph_svg: svgText,
    module_url: entities.encode(modUrl),
    current_path: entities.encode(req.url),
  });
}
