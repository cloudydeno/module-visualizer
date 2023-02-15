import {
  entities,
  readableStreamFromReader,
  readableStreamFromIterable,
  SubProcess,
  type SubprocessErrorData,
} from "../../deps.ts";

import { templateHtml, makeErrorResponse, HtmlHeaders } from '../../lib/request-handling.ts';
import { findModuleSlug, resolveModuleUrl } from "../../lib/resolve.ts";
import { computeGraph, renderGraph } from "./compute.ts";

export async function *handleRequest(req: Request, modSlug: string, args: URLSearchParams) {
  if (modSlug == '') {
    const url = args.get('url');
    if (!url) return;
    args.delete('url');

    // clean up query parameters
    if (args.get('std') == 'combine') args.delete('std');
    if (args.get('rankdir') == 'TB') args.delete('rankdir');
    if (args.get('rankdir') == 'interactive') {
      args.set('renderer', 'interactive');
      args.delete('rankdir');
    }

    const slug = await findModuleSlug(url);
    const location = slug + (args.toString() ? `?${args}` : '');
    yield new Response(`302: ${location}`, {
      status: 302,
      headers: { location },
    });
  }

  const modUrl = await resolveModuleUrl(modSlug);
  if (!modUrl) return;

  switch (args.get('format')) {
    case 'json':
      yield serveBufferedOutput(req, computeGraph(modUrl, args), 'application/json');
      return;
    case 'dot':
      yield serveBufferedOutput(req, computeGraph(modUrl, args), 'text/plain; charset=utf-8');
      return;
    case 'svg':
      yield serveStreamingOutput(req, renderGraph(modUrl, ["-Tsvg"], args), 'image/svg+xml');
      return;
    case null:
      yield serveHtmlGraphPage(req, modUrl, modSlug, args);
      return;
  }
}

async function serveBufferedOutput(req: Request, computation: Promise<string>, contentType: string) {
  return await computation
    .then(buffer => new Response(buffer, {
      status: 200,
      headers: {
        'content-type': contentType,
      },
    }), makeErrorResponse);
}

async function serveStreamingOutput(req: Request, computation: Promise<SubProcess>, contentType: string) {
  return await computation
    .then(proc => {
      proc.status(); // throw this away because not really a way of reporting problems mid-stream
      return new Response(readableStreamFromReader(proc.proc.stdout), {
        status: 200,
        headers: {
          'content-type': contentType,
        }});
    }, makeErrorResponse);
}

const hideLoadMsg = `<style type="text/css">#graph-waiting { display: none; }</style>`;

async function serveHtmlGraphPage(req: Request, modUrl: string, modSlug: string, args: URLSearchParams) {
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
    return makeErrorResponse(err);
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

  : renderGraph(modUrl, ["-Tsvg"], args)
      .then(dotProc => dotProc.captureAllOutput())
      .then(raw => {
        const fullSvg = new TextDecoder().decode(raw);
        const attrs = [`id="graph"`];
        const svgWidth = fullSvg.match(/viewBox="(?:([0-9.-]+) ){3}/)?.[1];
        if (svgWidth) attrs.push(`style="max-width: ${parseInt(svgWidth)*2}px;"`);
        return fullSvg
          .slice(fullSvg.indexOf('<!--'))
          .replace(/<svg width="[^"]+" height="[^"]+"/, '<svg '+attrs.join(' '));
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
    console.error('Graph computation error:', err.stack);
    return `<div id="graph-error">${entities.encode(err.stack)}</div>`;
  });

  // Return the body in two parts, with a comment in between
  return new Response(readableStreamFromIterable((async function*() {
    const encoder = new TextEncoder();
    yield encoder.encode(pageHtml);

    yield encoder.encode("\n<!-- now waiting for graph ... ");
    const d0 = Date.now();
    const graphText = hideLoadMsg + await graphPromise;
    const millis = Date.now() - d0;
    yield encoder.encode(`completed in ${millis}ms -->\n\n`);

    yield encoder.encode(graphText);
  }())), {
    headers: HtmlHeaders,
  });
}
