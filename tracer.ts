// TODO: this could be added to /x/observability as a preconfigured SDK

import { DenoTelemetrySdk } from "https://deno.land/x/observability@v0.10.0/sdk.ts";
import { CloudPropagator } from "https://deno.land/x/observability@v0.10.0/otel-platform/propagators/google-cloud.ts";

new DenoTelemetrySdk({
  resourceAttrs: {
    'service.name': 'module-visualizer',
    'service.version': Deno.env.get('K_REVISION')?.slice((Deno.env.get('K_SERVICE')?.length ?? -1)+1),
    'deployment.environment': Deno.env.get('K_SERVICE') ? 'production' : 'local',
  },
  textMapPropagator: new CloudPropagator(),
});
