# Deno Module Visualizer

Live @ https://deno-visualizer.danopia.net

## `/dependencies-of/`

This tool shows a Graphviz rendering of high-level module dependencies.

The implementation is effectively similar to this shell pipeline:

```sh
deno info --unstable --json -- "$moduleUrl" \
| deno run -- compute.ts "$options" \
| dot -T"svg"
```

Several output types are available.
HTML and SVG renderings are the intended way of viewing the graph.
In addition, the dot process can be removed to export raw JSON data from the computation phase.
These are available as hyperlinks from the HTML output.

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
