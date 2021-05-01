import {
  http,
  entities,
  readerFromIterable,
  SubProcess, SubprocessErrorData,
} from "../../deps.ts";

import { templateHtml, makeErrorResponse, HtmlHeaders } from '../../lib/request-handling.ts';
import { DenoInfo } from "../../lib/types.ts";
import { findModuleSlug, resolveModuleUrl } from "../../lib/resolve.ts";
import { computeDependencies } from "../../lib/module-map.ts";

export async function handleRequest(req: http.ServerRequest, modSlug: string, args: URLSearchParams) {
  if (modSlug == '') {
    const url = args.get('url');
    if (!url) return false;
    args.delete('url');

    // clean up query parameters
    if (args.get('std') == 'combine') args.delete('std');
    if (args.get('rankdir') == 'TB') args.delete('rankdir');
    if (args.get('rankdir') == 'interactive') {
      args.set('renderer', 'interactive');
      args.delete('rankdir');
    }

    const slug = await findModuleSlug(url);
    await req.respond({
      status: 302,
      headers: new Headers({
        'location': slug + (args.toString() ? `?${args}` : ''),
      }),
    });
    return true;
  }

  const modUrl = await resolveModuleUrl(modSlug);
  if (!modUrl) return false;

  switch (args.get('format')) {
    case 'json':
      serveBufferedOutput(req, computeGraph(modUrl, args), 'application/json');
      return true;
    case 'dot':
      serveBufferedOutput(req, computeGraph(modUrl, args), 'text/plain; charset=utf-8');
      return true;
    case 'svg':
      serveStreamingOutput(req, generateSvgStream(modUrl, args), 'image/svg+xml');
      return true;
    case null:
      serveHtmlGraphPage(req, modUrl, modSlug, args);
      return true;
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
  await req.respond(await computation
    .then(buffer => ({
      status: 200,
      body: buffer,
      headers: new Headers({
        'content-type': contentType,
      }),
    }), makeErrorResponse));
}

async function serveStreamingOutput(req: http.ServerRequest, computation: Promise<SubProcess>, contentType: string) {
  await req.respond(await computation
    .then(proc => proc.toStreamingResponse({
      'content-type': contentType,
    }), makeErrorResponse));
}

async function serveHtmlGraphPage(req: http.ServerRequest, modUrl: string, modSlug: string, args: URLSearchParams) {
  args.set('font', 'Archivo Narrow');

  // Render the basic page first, so we can error more cleanly if that fails
  let pageHtml = '';
  try {
    pageHtml = await templateHtml('feat/dependencies-of/public.html', {
      module_slug: entities.encode(modSlug),
      module_url: entities.encode(modUrl),
      export_prefix: entities.encode(`${req.url}${req.url.includes('?') ? '&' : '?'}format=`),
    });
  } catch (err) {
    await req.respond(makeErrorResponse(err));
    return;
  }

  const graphPromise = ((args.get('renderer') === 'interactive')

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
      })

  ).catch(err => {
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
    return `<div id="graph-error">${entities.encode(err.stack)}</div>`;
  });

  // Return the body in two parts
  await req.respond({
    headers: HtmlHeaders,
    body: readerFromIterable((async function*() {
      const encoder = new TextEncoder();
      yield encoder.encode(pageHtml);
      yield encoder.encode("\n\n<!-- now waiting for graph ... -->\n");

      const d0 = Date.now();
      const graphText = await graphPromise;
      const millis = Date.now() - d0;
      yield encoder.encode(`<!-- ok, graph rendering completed in ${millis}ms -->\n\n`);

      yield encoder.encode(graphText);
    }())),
  })
}
