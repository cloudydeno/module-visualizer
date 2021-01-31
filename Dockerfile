FROM hayd/alpine-deno:1.7.1
RUN apk add --no-cache graphviz
ADD https://github.com/Omnibus-Type/PragatiNarrow/raw/master/Fonts/PragatiNarrow-Regular.ttf /usr/share/fonts/truetype/
WORKDIR /src
ADD *.ts *.sh ./
RUN deno cache server.ts imports-compute.ts
ADD public ./
ENTRYPOINT ["deno","run","--allow-env","--allow-net=0.0.0.0","--allow-run","--allow-read=.","server.ts"]
