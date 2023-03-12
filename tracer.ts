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
} from "https://raw.githubusercontent.com/cloudydeno/deno-observability/4d6794577c18c3eb79318932d56888ae3567b60a/tracing/mod.ts";
import { GcpBatchSpanExporter } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/4d6794577c18c3eb79318932d56888ae3567b60a/tracing/exporters/google-cloud.ts";
import { GoogleCloudPropagator } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/4d6794577c18c3eb79318932d56888ae3567b60a/tracing/propagators/google-cloud.ts";

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
