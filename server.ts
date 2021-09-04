#!/usr/bin/env -S deno run --allow-read=. --allow-net --allow-run=dot --allow-env=PORT

import { http } from "./deps.ts";
import { servePublic, serveTemplatedHtml } from './lib/request-handling.ts';

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
for await (const req of http.serve({ port })) {
  handleReq(req);
}

async function handleReq(req: http.ServerRequest) {
  console.log(req.method, req.url);
  const url = new URL(req.url, 'http://localhost');
  const args = new URLSearchParams(url.search);

  { // feature: dependencies-of
    const match = url.pathname.match(/^\/dependencies-of\/(.*)$/);
    if (match && req.method === 'GET') {
      if (await DependenciesOf.handleRequest(req, match[1], args)) return;
    }
  }

  { // feature: shields
    const match = url.pathname.match(/^\/shields\/([^\/]+)\/(.+)$/);
    if (match && req.method === 'GET') {
      if (await Shields.handleRequest(req, match[1], match[2])) return;
    }
  }

  { // feature: registry-key
    if (url.pathname === '/registry-key' && req.method === 'GET') {
      if (await RegistryKey.handleRequest(req)) return;
    }
  }

  if (url.pathname === '/') {
    await serveTemplatedHtml(req, 'public/index.html');
    return;
  }

  if ([
    '/global.css',
    '/icon-deps.png',
    '/interactive-graph.js',
  ].includes(url.pathname)) {
    await servePublic(req, url.pathname);
    return;
  }

  await req.respond({
    status: 404,
    body: '404 Not Found',
  });
}
