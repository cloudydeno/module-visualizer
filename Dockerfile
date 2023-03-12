FROM denoland/deno:alpine-1.31.1
RUN apk add --no-cache graphviz
ADD fonts/ /usr/share/fonts/truetype/

WORKDIR /src
ADD deps.ts .
RUN deno check deps.ts
ADD . .
RUN deno check server.ts
ENTRYPOINT ["deno","run","--allow-sys=hostname","--allow-env","--allow-net","--allow-run=deno,dot","--allow-read=.","server.ts"]
