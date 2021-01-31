FROM hayd/alpine-deno:1.7.1
RUN apk add --no-cache graphviz
ADD https://github.com/Omnibus-Type/PragatiNarrow/raw/master/Fonts/PragatiNarrow-Regular.ttf /usr/share/fonts/truetype/
WORKDIR /src
ADD . .
RUN deno cache server.ts dependencies-of/compute.ts
ENTRYPOINT ["deno","run","--allow-env","--allow-net=0.0.0.0","--allow-run","--allow-read=.","server.ts"]
