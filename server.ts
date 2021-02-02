import { serve, ServerRequest } from "https://deno.land/std@0.85.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.85.0/http/file_server.ts";
import * as entities from "https://deno.land/x/html_entities@v1.0/lib/xml-entities.js";

import { SubProcess, SubprocessErrorData } from './subprocess.ts';

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

async function computeGraph(modUrl: string, args: URLSearchParams) {
  const downloadProc = new SubProcess('download', {
    cmd: ["deno", "info", "--unstable", "--json", "--", modUrl],
    stdin: 'null',
    errorPrefix: /^error: /,
  });

  const computeProc = new SubProcess('compute', {
    cmd: ["deno", "run", "--", "dependencies-of/compute.ts", args.toString()],
    stdin: 'piped',
    errorPrefix: /^(Uncaught|error:) /,
  });
  await downloadProc.pipeInto(computeProc);

  return computeProc;
}

async function generateSvgStream(modUrl: string, args: URLSearchParams) {
  args.set('format', 'dot');
  const computeProc = await computeGraph(modUrl, args);

  const dotProc = new SubProcess('render', {
    cmd: ["dot", "-Tsvg"],
    stdin: 'piped',
    errorPrefix: /^Error: /,
  });
  await computeProc.pipeInto(dotProc);

  return dotProc;
}

async function serveSvg(req: ServerRequest, modUrl: string, args: URLSearchParams) {
  req.respond(await generateSvgStream(modUrl, args)
    .then(proc => proc.toStreamingResponse({
      'content-type': 'image/svg+xml',
    }), err => ({
      status: 500,
      body: `Internal Server Error: ${err.message}`,
      headers: new Headers({
        'content-type': 'text/plain',
      }),
    })));
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

  const svgText = await generateSvgStream(modUrl, args)
    .then(dotProc => dotProc.captureAllOutput())
    .then(
      raw => {
        const fullSvg = new TextDecoder().decode(raw);
        return fullSvg
          .slice(fullSvg.indexOf('<!--'))
          .replace(/<svg width="[^"]+" height="[^"]+"/, '<svg id="graph"');
      },
      err => {
        if (err.subproc) {
          const info = err.subproc as SubprocessErrorData;
          return `<div id="graph-error">
          <h2>${entities.encode(info.procLabel.toUpperCase())} FAILED</h2>
          <p>Process: <code>${entities.encode(info.cmdLine.join(' '))}</code></p>
          <p>Exit code: <code>${info.exitCode}</code></p>
          <p>${info.foundError
            ? `<code>${entities.encode(info.foundError)}</code>`
            : `<em>(no output received)</em>`}</p>
          <h5>Sorry about that. Perhaps double check that the given URL is functional, or try another module URL.</h5>
          </div>`;
        }
        return `<div id="graph-error">${entities.encode(err.message)}</div>`;
      });

  await serveTemplatedHtml(req, 'dependencies-of/public.html', {
    graph_svg: svgText,
    module_url: entities.encode(modUrl),
    current_path: entities.encode(req.url),
  });
}
