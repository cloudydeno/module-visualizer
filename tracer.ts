import { httpTracer, DenoFetchInstrumentation, DenoTracerProvider, OTLPTraceFetchExporter, Resource, SubProcessInstrumentation } from "https://deno.land/x/observability@v0.3.0/mod.ts";
import { GoogleCloudPropagator } from "https://deno.land/x/observability@v0.3.0/tracing/propagators/google-cloud.ts";
export { httpTracer };

export const provider = new DenoTracerProvider({
  resource: new Resource({
    'service.name': 'module-visualizer',
    'service.version': Deno.env.get('K_REVISION')?.slice((Deno.env.get('K_SERVICE')?.length ?? -1)+1),
    'deployment.environment': Deno.env.get('K_SERVICE') ? 'production' : 'local',
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
