FROM hayd/alpine-deno:1.7.1
RUN apk add --no-cache graphviz
ADD https://github.com/Omnibus-Type/ArchivoNarrow/raw/master/fonts/ttf/ArchivoNarrow-Regular.ttf https://github.com/matomo-org/travis-scripts/raw/master/fonts/Arial.ttf /usr/share/fonts/truetype/
WORKDIR /src
ADD deps.ts .
RUN deno cache deps.ts
ADD . .
RUN deno cache server.ts
ENTRYPOINT ["deno","run","--allow-env","--allow-net=0.0.0.0","--allow-run","--allow-read=.","server.ts"]
