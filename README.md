## Deploy

```sh
IMAGE="gcr.io/stardust-156404/deno-module-visualizer:$TAG"
docker build . -t $IMAGE
docker push $IMAGE
gcloud alpha run services update receiver --platform=managed --project=stardust-156404 --region=us-central1 --image=$IMAGE

# or

# update tag in cloud-run.yaml
gcloud alpha run services replace cloud-run.yaml --platform=managed --project=stardust-156404 --region=us-central1
```
