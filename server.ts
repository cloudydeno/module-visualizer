import { http } from "./deps.ts";

import * as DependenciesOf from './feat/dependencies-of/api.ts';
import { servePublic, serveTemplatedHtml } from './lib/request-handling.ts';

let port = 5000;
try {
  port = parseInt(Deno.env.get('PORT') || `${port}`);
} catch (err) {
  console.error(`WARN: failed to read $PORT due to ${err.name}`);
}

for await (const req of http.serve({ port })) {
  console.log(req.method, req.url);
  const url = new URL(req.url, 'http://localhost');
  const args = new URLSearchParams(url.search);

  {
    const match = url.pathname.match(/^\/dependencies-of\/https\/(.+)$/);
    if (match && req.method === 'GET') {
      const modUrl = 'https://'+decodeURI(match[1]);
      DependenciesOf.handleRequest(req, modUrl, args);
      continue;
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
