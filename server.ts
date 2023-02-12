#!/usr/bin/env -S deno run --check=all --allow-read=. --allow-net=0.0.0.0 --allow-run=deno,dot --allow-env=PORT

import { http } from "./deps.ts";
import { serveFont, servePublic, serveTemplatedHtml } from './lib/request-handling.ts';

// The different HTTP surfaces we expose
import * as DependenciesOf from './feat/dependencies-of/api.ts';
import * as Shields from './feat/shields/api.ts';
import * as RegistryKey from './feat/registry-key/api.ts';

let port = 5000;
try {
  port = parseInt(Deno.env.get('PORT') || port.toString());
} catch (err) {
  console.error(`WARN: failed to read $PORT due to ${err.name}`);
}

console.log('Setting up on', { port });
http.serve(async request => {
  for await (const response of handleReq(request)) {
    return response;
  }
  console.log('reached 404');
  return new Response('404 Not Found', {
    status: 404,
  });
}, {
  port,
});

async function *handleReq(req: Request) {
  console.log(req.method, req.url);
  const url = new URL(req.url, 'http://localhost');
  const args = new URLSearchParams(url.search);

  { // feature: dependencies-of
    const match = url.pathname.match(/^\/dependencies-of\/(.*)$/);
    if (match && req.method === 'GET') {
      yield* DependenciesOf.handleRequest(req, match[1], args);
    }
  }

  { // feature: shields
    const match = url.pathname.match(/^\/shields\/([^\/]+)\/(.+)$/);
    if (match && req.method === 'GET') {
      yield* Shields.handleRequest(req, match[1], match[2]);
    }
  }

  { // feature: registry-key
    if (url.pathname === '/registry-key' && req.method === 'GET') {
      yield RegistryKey.handleRequest(req);
    }
  }

  if (url.pathname === '/') {
    yield serveTemplatedHtml(req, 'public/index.html');
  }

  if ([
    '/global.css',
    '/icon-deps.png',
    '/interactive-graph.js',
  ].includes(url.pathname)) {
    yield servePublic(req, url.pathname);
  }

  if (url.pathname.startsWith('/fonts/') &&
      url.pathname.endsWith('.woff2')) {
    yield serveFont(req, url.pathname.slice(6));
  }
}
