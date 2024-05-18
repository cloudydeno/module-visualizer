FROM denoland/deno:alpine-1.43.5
RUN apk add --no-cache graphviz
ADD fonts/ /usr/share/fonts/truetype/

ENV DENO_NO_UPDATE_CHECK=1
WORKDIR /src
ADD deps.ts .
RUN deno check deps.ts
ADD . .
RUN deno check entrypoint.ts
ENTRYPOINT ["deno","run","--allow-sys=hostname,osRelease","--allow-env","--allow-net","--allow-run=deno,dot","--allow-read=.","entrypoint.ts"]
