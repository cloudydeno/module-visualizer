export { parse as parseFlags } from "https://deno.land/std@0.198.0/flags/mod.ts";
export * as http from "https://deno.land/std@0.198.0/http/server.ts";
export * as file_server from "https://deno.land/std@0.198.0/http/file_server.ts";
export {
  readableStreamFromIterable,
} from "https://deno.land/std@0.198.0/streams/readable_stream_from_iterable.ts";
export {
  readableStreamFromReader,
} from "https://deno.land/std@0.198.0/streams/readable_stream_from_reader.ts";

export * as entities from "https://deno.land/x/html_entities@v1.0/lib/xml-entities.js";

export { SubProcess, type SubprocessErrorData } from "https://crux.land/4KsAxM#sub-process";
export { filesize } from "https://crux.land/6wZ5Sz#filesize@v1";

// maybe someday we actually use deno_graph's code too
export type {
  ModuleGraphJson,
  ModuleJson,
} from "https://deno.land/x/deno_graph@0.43.2/lib/types.d.ts";

export {
  trace,
  context,
  type Context,
} from "https://deno.land/x/observability@v0.4.0/opentelemetry/api.js";
export {
  httpTracer,
} from "https://deno.land/x/observability@v0.4.0/instrumentation/http-server.ts";
