import { httpTracer, DenoFetchInstrumentation, DenoTracerProvider, OTLPTraceFetchExporter, Resource, SubProcessInstrumentation } from "https://deno.land/x/observability@v0.2.0/tracing/mod.ts";
import { GoogleCloudPropagator } from "https://deno.land/x/observability@v0.2.0/tracing/propagators/google-cloud.ts";
export { httpTracer };

export const provider = new DenoTracerProvider({
  resource: new Resource({
    'service.name': 'module-visualizer',
    'service.version': Deno.env.get('K_REVISION'),
    'deployment.environment': 'production',
  }),
  propagator: new GoogleCloudPropagator(),
  instrumentations: [
    new DenoFetchInstrumentation(),
    new SubProcessInstrumentation(),
  ],
  batchSpanProcessors: [
    new OTLPTraceFetchExporter(),
  ],
});
