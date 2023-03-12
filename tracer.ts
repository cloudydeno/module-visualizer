import {
  DenoTracerProvider,
  OTLPTraceFetchExporter,
  httpTracer,
  DenoFetchInstrumentation,
  SubProcessInstrumentation,
  Resource,
  asyncGeneratorWithContext,
} from "https://raw.githubusercontent.com/cloudydeno/deno-observability/7a96cf859631e81df821ef8c3352b92d7f909739/tracing/mod.ts";
import { GcpBatchSpanExporter } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/7a96cf859631e81df821ef8c3352b92d7f909739/tracing/exporters/google-cloud.ts";
import { GoogleCloudPropagator } from "https://raw.githubusercontent.com/cloudydeno/deno-observability/7a96cf859631e81df821ef8c3352b92d7f909739/tracing/propagators/google-cloud.ts";

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
