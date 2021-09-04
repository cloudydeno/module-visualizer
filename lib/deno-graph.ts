import {
  createGraph,
  LoadResponse,
  ModuleGraphJson,
  ModuleJson,
} from "./../deno_graph/mod.ts";

export type {
  ModuleGraphJson,
  ModuleJson,
};

// import { SubProcess } from "https://crux.land/Fjf2o#sub-process";

// TODO: use this!
// import { AsyncCache } from "https://crux.land/67XrpW#async-cache";

// import type { DenoInfo, DenoDependency } from "../lib/types.ts";
// import type { DependencyJson } from "../deno_graph/lib/types.d.ts";

// function mapDep(dep: DependencyJson): DenoDependency {
//   return {
//     isDynamic: dep.isDynamic ?? false,
//     specifier: dep.specifier ?? 'BUG',
//     code: dep.code?.specifier,
//     type: dep.type?.specifier,
//   };
// }

export async function fetchModuleGraph(
  modUrl: string,
): Promise<ModuleGraphJson> {
  // const downloadData = await new SubProcess('download', {
  //   cmd: ["deno", "info", "--unstable", "--json", "--", modUrl],
  //   env: { "NO_COLOR": "yas" },
  //   stdin: 'null',
  //   errorPrefix: /^error: /,
  // }).captureAllJsonOutput() as DenoInfo;

  console.log('cache before:', cachedResources.size,
    '-', Math.floor(cacheSize / 1024), 'KiB');

  const denoGraph = await createGraph(modUrl, { load });

  console.log('cache after:', cachedResources.size,
    '-', Math.floor(cacheSize / 1024), 'KiB');

  const denoJson = denoGraph.toJSON();
  // const downloadData: DenoInfo = {
  //   ...denoJson,
  //   modules: denoJson.modules.map(module => module.error ? {
  //     // typeDependency: module.typesDependency,
  //     dependencies: module.dependencies?.map(mapDep) ?? [],
  //     error: module.error ?? '',
  //     specifier: module.specifier,
  //   } : {
  //     // typeDependency: module.typesDependency,
  //     dependencies: module.dependencies?.map(mapDep) ?? [],
  //     // error: module.error,
  //     specifier: module.specifier,
  //   }),
  // };

  return denoJson;
}


const MAX_CACHE_SIZE = 25_000_000;
const cachedResources = new Map<string, LoadResponse>();
let cacheSize = 0;

function checkCache() {
  if (cacheSize > MAX_CACHE_SIZE) {
    const toEvict: string[] = [];
    for (const [specifier, loadResponse] of cachedResources) {
      toEvict.push(specifier);
      cacheSize -= loadResponse.content.length;
      if (cacheSize <= MAX_CACHE_SIZE) {
        break;
      }
    }
    for (const evict of toEvict) {
      cachedResources.delete(evict);
    }
  }
}

const reqHeaders = new Headers({
  'accept': 'application/typescript, application/javascript, */*',
  // 'user-agent': ``,
});

async function load(
  specifier: string,
): Promise<LoadResponse | undefined> {
  const url = new URL(specifier);
  // try {
    switch (url.protocol) {
      case "file:": {
        console.error(`local specifier requested: ${specifier}`);
        return undefined;
      }
      case "http:":
      case "https:": {
        if (cachedResources.has(specifier)) {
          console.log('cache hit ', specifier);
          return cachedResources.get(specifier);
        }
        console.log('cache MISS', specifier);
        const response = await fetch(String(url), {
          redirect: "follow",
          headers: reqHeaders,
        });
        if (response.status !== 200) {
          // ensure that resources are not leaked
          await response.arrayBuffer();
          return undefined;
        }
        const content = await response.text();
        const headers: Record<string, string> = {};
        for (const [key, value] of response.headers) {
          headers[key.toLowerCase()] = value;
        }
        const loadResponse: LoadResponse = {
          specifier: response.url,
          headers,
          content,
        };
        cachedResources.set(specifier, loadResponse);
        // cachedSpecifiers.add(specifier);
        cacheSize += content.length;
        queueMicrotask(checkCache);
        // lastLoad = Date.now();
        return loadResponse;
      }
      default:
        return undefined;
    }
  // } catch (err) {
  //   throw err;
  //   return undefined;
  // }
}

// console.log('before', cachedResources.size, cacheSize);
// const graph = await createGraph("https://esm.sh/qs@6.9.4", { load });
// console.log(JSON.stringify(graph.toJSON(), null, 2));
// console.log('after', cachedResources.size, cacheSize);

if (import.meta.main) {
  console.log(JSON.stringify(await fetchModuleGraph('https://esm.sh/qs@6.9.4'), null, 2));
}
