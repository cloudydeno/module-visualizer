import {
  DenoTracerProvider,
  OTLPTraceFetchExporter,
  httpTracer,
  DenoFetchInstrumentation,
  SubProcessInstrumentation,
  Resource,
// } from "../deno-observability/tracing/mod.ts";
// import { GcpBatchSpanExporter } from "../deno-observability/tracing/exporters/google-cloud.ts";
// import { GoogleCloudPropagator } from "../deno-observability/tracing/propagators/google-cloud.ts";
} from "https://raw.githubusercontent.com/cloudydeno/deno-observability/9d996d1ce0ba6b15641cbc882b15fc63992418b9/tracing/mod.ts";
import { GcpBatchSpanExporter } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/9d996d1ce0ba6b15641cbc882b15fc63992418b9/tracing/exporters/google-cloud.ts";
import { GoogleCloudPropagator } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/9d996d1ce0ba6b15641cbc882b15fc63992418b9/tracing/propagators/google-cloud.ts";

export { httpTracer };

export const provider = new DenoTracerProvider({
  resource: new Resource({
    'service.name': 'module-visualizer',
    'service.version': 'adhoc',
    'deployment.environment': 'local',
  }),
  propagator: new GoogleCloudPropagator(),
  instrumentations: [
    new DenoFetchInstrumentation(),
    new SubProcessInstrumentation(),
  ],
  batchSpanProcessors: [
    new GcpBatchSpanExporter(),
    // new OTLPTraceFetchExporter(),
  ],
});
