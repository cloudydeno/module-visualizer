import { http, entities } from "../deps.ts";

import { SubProcess, SubprocessErrorData } from '../lib/subprocess.ts';
import { serveTemplatedHtml, makeErrorResponse } from '../lib/request-handling.ts';

export function handleRequest(req: http.ServerRequest, modUrl: string, args: URLSearchParams) {
  switch (args.get('format')) {
    case 'json':
      serveStreamingOutput(req, computeGraph(modUrl, args), 'application/json');
      break;
    case 'dot':
      serveStreamingOutput(req, computeGraph(modUrl, args), 'text/plain; charset=utf-8');
      break;
    case 'svg':
      serveStreamingOutput(req, generateSvgStream(modUrl, args), 'image/svg+xml');
      break;
    default:
      serveHtmlGraphPage(req, modUrl, args);
  }
}

export async function computeGraph(modUrl: string, args: URLSearchParams) {
  const downloadProc = new SubProcess('download', {
    cmd: ["deno", "info", "--unstable", "--json", "--", modUrl],
    stdin: 'null',
    errorPrefix: /^error: /,
  });

  // TODO: this should probably be in-process instead of being a child
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

async function serveStreamingOutput(req: http.ServerRequest, computation: Promise<SubProcess>, contentType: string) {
  req.respond(await computation
    .then(proc => proc.toStreamingResponse({
      'content-type': contentType,
    }), makeErrorResponse));
}

async function serveHtmlGraphPage(req: http.ServerRequest, modUrl: string, args: URLSearchParams) {
  args.set('font', 'Archivo Narrow');

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
          return `
            <div id="graph-error">
            <h2>${entities.encode(info.procLabel.toUpperCase())} FAILED</h2>
            <p>Process: <code>${entities.encode(info.cmdLine.join(' '))}</code></p>
            <p>Exit code: <code>${info.exitCode}</code></p>
            <p>${info.foundError
              ? `<code>${entities.encode(info.foundError)}</code>`
              : `<em>(no output received)</em>`}</p>
            <h5>Sorry about that. Perhaps double check that the given URL is functional, or try another module URL.</h5>
            </div>`.replace(/^ +/gm, '');
        }
        return `<div id="graph-error">${entities.encode(err.message)}</div>`;
      });

  await serveTemplatedHtml(req, 'dependencies-of/public.html', {
    graph_svg: svgText,
    module_url: entities.encode(modUrl),
    export_prefix: entities.encode(`${req.url}${req.url.includes('?') ? '&' : '?'}format=`),
  });
}
