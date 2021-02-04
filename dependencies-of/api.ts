import { http, entities } from "../deps.ts";
import { SubProcess, SubprocessErrorData } from '../lib/subprocess.ts';
import { serveTemplatedHtml, makeErrorResponse } from '../lib/request-handling.ts';

import { DenoInfo } from "./types.ts";
import { computeDependencies } from "./compute.ts";

export function handleRequest(req: http.ServerRequest, modUrl: string, args: URLSearchParams) {
  switch (args.get('format')) {
    case 'json':
      serveBufferedOutput(req, computeGraph(modUrl, args), 'application/json');
      break;
    case 'dot':
      serveBufferedOutput(req, computeGraph(modUrl, args), 'text/plain; charset=utf-8');
      break;
    case 'svg':
      serveStreamingOutput(req, generateSvgStream(modUrl, args), 'image/svg+xml');
      break;
    default:
      serveHtmlGraphPage(req, modUrl, args);
  }
}

export async function computeGraph(
  modUrl: string,
  args: URLSearchParams,
  format?: string,
) {
  if (format) args.set('format', format);

  const downloadData = JSON.parse(await new SubProcess('download', {
    cmd: ["deno", "info", "--unstable", "--json", "--", modUrl],
    stdin: 'null',
    errorPrefix: /^error: /,
  }).captureAllTextOutput()) as DenoInfo;

  return computeDependencies(downloadData, args);
}

async function generateSvgStream(modUrl: string, args: URLSearchParams) {
  const dotText = await computeGraph(modUrl, args, 'dot');

  const dotProc = new SubProcess('render', {
    cmd: ["dot", "-Tsvg"],
    stdin: 'piped',
    errorPrefix: /^Error: /,
  });
  await dotProc.writeInputText(dotText);

  return dotProc;
}

async function serveBufferedOutput(req: http.ServerRequest, computation: Promise<string>, contentType: string) {
  req.respond(await computation
    .then(buffer => ({
      status: 200,
      body: buffer,
      headers: new Headers({
        'content-type': contentType,
      }),
    }), makeErrorResponse));
}

async function serveStreamingOutput(req: http.ServerRequest, computation: Promise<SubProcess>, contentType: string) {
  req.respond(await computation
    .then(proc => proc.toStreamingResponse({
      'content-type': contentType,
    }), makeErrorResponse));
}

async function serveHtmlGraphPage(req: http.ServerRequest, modUrl: string, args: URLSearchParams) {
  args.set('font', 'Archivo Narrow');

  const graphPromise = (args.get('renderer') === 'interactive')

  ? computeGraph(modUrl, args, 'dot')
      .then(data => {
        return `
          <div id="graph"></div>
          <script type="text/javascript" src="https://unpkg.com/vis-network@9.0.1/standalone/umd/vis-network.min.js"></script>
          <script type="text/javascript" src="/interactive-graph.js"></script>
          <template type="text/plain" id="graphviz_data">\n${data
            .replace(/&/g, '&amp;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;')
          }</template>
          <script type="text/javascript">
          window.CreateModuleGraph(document.getElementById('graphviz_data').innerHTML
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&'));
          </script>
          `.replace(/^ {10}/gm, '');
      })

  : generateSvgStream(modUrl, args)
      .then(dotProc => dotProc.captureAllOutput())
      .then(raw => {
        const fullSvg = new TextDecoder().decode(raw);
        return fullSvg
          .slice(fullSvg.indexOf('<!--'))
          .replace(/<svg width="[^"]+" height="[^"]+"/, '<svg id="graph"');
      });

  const graphData = await graphPromise.catch(err => {
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
    graph_data: graphData,
    module_url: entities.encode(modUrl),
    export_prefix: entities.encode(`${req.url}${req.url.includes('?') ? '&' : '?'}format=`),
  });
}
