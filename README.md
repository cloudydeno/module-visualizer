# Deno Module Visualizer

Live @ https://deno-visualizer.danopia.net

This tool shows a Graphviz rendering of high-level module dependencies.

## CLI Usage

```sh
$ deno install -f -n deno-graph --allow-run=deno,dot https://raw.githubusercontent.com/cloudydeno/module-visualizer/main/feat/dependencies-of/cli.ts
✅ Successfully installed deno-graph

$ deno-graph https://deno.land/x/djwt@v2.4/mod.ts
digraph "imported modules" {
  rankdir="TB";

  "https://deno.land/x/djwt@v2.4"[shape="box",label="/x/djwt@v2.4\l4 files, 9 KB\l",penwidth="1.6931471805599454",fontname="Arial",style="filled",tooltip="https://deno.land/x/djwt@v2.4",fillcolor="lightskyblue",href="https://deno.land/x/djwt@v2.4"];
  "https://deno.land/x/djwt@v2.4" -> "https://deno.land/std@0.105.0";

  "https://deno.land/std@0.105.0"[shape="box",label="/std@0.105.0\l    • /encoding\l2 files, 3 KB\l",penwidth="1",fontname="Arial",style="filled",tooltip="https://deno.land/std@0.105.0",fillcolor="lightgreen",href="https://deno.land/std@0.105.0"];

}
```

## `/dependencies-of/`

The implementation was initially represented by this shell pipeline:

```sh
deno info --unstable --json -- "$moduleUrl" \
| deno run -- compute.ts "$options" \
| dot -T"svg"
```

Several output types are available.
HTML and SVG renderings are the intended way of viewing the graph.
In addition, the dot process can be removed to export raw JSON data from the computation phase.
These are available as hyperlinks from the HTML output.

> Note: Over time, the above pipeline is being consolidated into a Deno-native module.
> * `deno info` will be replaced with `/x/deno_graph` when Deno WASM is more mature and graph loading performance is comparable.
> * `deno run` has been removed already (the JSON is processed in the main process now).
> * `dot -Tsvg` might eventually be replaced with a WebAssembly build of GraphViz :) Font measuring will be a tricky point with that.

## Deploy

These are just notes for me :)

```sh
IMAGE="gcr.io/stardust-156404/deno-module-visualizer:$TAG"
docker build . -t $IMAGE
docker push $IMAGE
gcloud alpha run services update deno-module-visualizer --platform=managed --project=stardust-156404 --region=us-central1 --image=$IMAGE

# or

# update tag in cloud-run.yaml
gcloud alpha run services replace cloud-run.yaml --platform=managed --project=stardust-156404 --region=us-central1
```
