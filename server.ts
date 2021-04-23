import { http } from "./deps.ts";

import * as DependenciesOf from './feat/dependencies-of/api.ts';
import * as Shields from './feat/shields/api.ts';

import { servePublic, serveTemplatedHtml } from './lib/request-handling.ts';

let port = 5000;
try {
  port = parseInt(Deno.env.get('PORT') || `${port}`);
} catch (err) {
  console.error(`WARN: failed to read $PORT due to ${err.name}`);
}

console.log('Setting up on', { port });
for await (const req of http.serve({ port })) {
  console.log(req.method, req.url);
  const url = new URL(req.url, 'http://localhost');
  const args = new URLSearchParams(url.search);

  {
    const match = url.pathname.match(/^\/dependencies-of\/(.+)$/);
    if (match && req.method === 'GET') {
      if (await DependenciesOf.handleRequest(req, match[1], args)) continue;
    }
  }

  {
    const match = url.pathname.match(/^\/shields\/([^\/]+)\/(.+)$/);
    if (match && req.method === 'GET') {
      if (await Shields.handleRequest(req, match[1], match[2])) continue;
    }
  }

  if (url.pathname === '/') {
    serveTemplatedHtml(req, 'public/index.html');
  } else if ([
    '/global.css',
    '/icon-deps.png',
    '/interactive-graph.js',
  ].includes(url.pathname)) {
    servePublic(req, url.pathname);
  } else {
    req.respond({
      status: 404,
      body: '404 Not Found',
    });
  }
}
