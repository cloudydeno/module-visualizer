import {
  DenoTracerProvider,
  OTLPTraceFetchExporter,
  httpTracer,
  DenoFetchInstrumentation,
  SubProcessInstrumentation,
  Resource,
  asyncGeneratorWithContext,
// } from "../deno-observability/tracing/mod.ts";
// import { GcpBatchSpanExporter } from "../deno-observability/tracing/exporters/google-cloud.ts";
// import { GoogleCloudPropagator } from "../deno-observability/tracing/propagators/google-cloud.ts";
} from "https://raw.githubusercontent.com/cloudydeno/deno-observability/9eb9efdc12eecdd37e15165bb1875e152612cbbf/tracing/mod.ts";
import { GcpBatchSpanExporter } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/9eb9efdc12eecdd37e15165bb1875e152612cbbf/tracing/exporters/google-cloud.ts";
import { GoogleCloudPropagator } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/9eb9efdc12eecdd37e15165bb1875e152612cbbf/tracing/propagators/google-cloud.ts";

export { httpTracer, asyncGeneratorWithContext };

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
