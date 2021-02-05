import { http, filesize, entities } from "../../deps.ts";

import { SubProcess, SubprocessErrorData } from '../../lib/subprocess.ts';
import { serveTemplatedHtml } from '../../lib/request-handling.ts';
import { DenoInfo, CodeModule } from "../../lib/types.ts";
import { resolveModuleUrl } from "../../lib/resolve.ts";
import { processDenoInfo, ModuleMap } from "../../lib/module-map.ts";
import { determineModuleAttrs } from "../../lib/module-registries.ts";

export async function handleRequest(req: http.ServerRequest, shieldId: string, modSlug: string) {
  const modUrl = await resolveModuleUrl(modSlug);
  if (!modUrl) return false;
  switch (shieldId) {

    case 'dep-count':
      computeGraph(modUrl)
        .then(makeDepCountShield)
        .catch(makeErrorShield)
        .then(resp => req.respond(resp));
      return true;

    case 'updates':
      computeGraph(modUrl)
        .then(makeUpdatesShield)
        .catch(makeErrorShield)
        .then(resp => req.respond(resp));
      return true;

    case 'cache-size':
      computeGraph(modUrl)
        .then(makeCacheSizeShield)
        .catch(makeErrorShield)
        .then(resp => req.respond(resp));
      return true;

    case 'latest-version':
      if (modSlug.startsWith('x/')) {
        makeXLatestVersionShield(modSlug.split('/')[1].split('@')[0])
          .catch(makeErrorShield)
          .then(resp => req.respond(resp));
        return true;
      }
      return false;

    case 'setup':
      serveTemplatedHtml(req, 'feat/shields/public.html', {
        module_slug: entities.encode(modSlug),
        module_url: entities.encode(modUrl),
        module_slug_component: encodeURIComponent(modSlug),
      });
      return true;

    default:
      return false;
  }
}

export async function computeGraph(modUrl: string) {
  const downloadData = await new SubProcess('download', {
    cmd: ["deno", "info", "--unstable", "--json", "--", modUrl],
    stdin: 'null',
    errorPrefix: /^error: /,
  }).captureAllTextOutput();
  return processDenoInfo(JSON.parse(downloadData));
}

function makeDepCountShield(map: ModuleMap): http.Response {
  const pkgCount = map.modules.size - 1;
  return {
    status: 200,
    body: JSON.stringify({
      schemaVersion: 1,
      label: "dependencies",
      message: `${pkgCount}`,
      color: "informational",
      cacheSeconds: 4 * 60 * 60,
    }),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  };
}

async function makeUpdatesShield(map: ModuleMap): Promise<http.Response> {
  const mod: CodeModule | null = map.mainModule;
  if (!mod) throw new Error(`No main module found?`);

  const npmVersions = new Map<string,string>();
  let isPureDeno = true;

  for (const module of map.modules.values()) {
    const {href} = determineModuleAttrs(module);
    if (!href) {
      isPureDeno = false;
      continue;
    }

    const parts = href.split('/');
    if (parts[2] === 'deno.land') {
      continue;
    }
    if (module !== map.mainModule) {
      isPureDeno = false;
    }
    if (parts[2] !== 'www.npmjs.com') {
      continue;
    }

    if (parts[4][0] === '@') {
      parts.splice(4, 0, parts.splice(4, 2).join('/'));
    }

    const [pkg, _, version] = parts.slice(4);
    npmVersions.set(pkg, version);
  }

  // console.log('Auditing', npmVersions)
  const audit = npmVersions.size == 0 ? {info: 0, low: 0, moderate: 0, high: 0, critical: 0} : await fetch(`https://registry.npmjs.org/-/npm/v1/security/audits`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'deno_module',
        version: '1.0.0',
        requires: toObject(npmVersions),
        dependencies: toObject(Array.from(npmVersions).map(x => [x[0], {version: x[1]}])),
      }),
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
      },
    }).then(x => x.json()).then(x => x.metadata.vulnerabilities) as {info: number, low: number, moderate: number, high: number, critical: number};
  // console.log(audit);

  const vuln =
      audit.critical ? 'critical'
    : audit.high ? 'high'
    : audit.moderate ? 'moderate'
    : false;
  if (vuln) {
    return {
      status: 200,
      body: JSON.stringify({
        schemaVersion: 1,
        namedLogo: 'npm',
        label: 'dependencies',
        message: `${vuln} vulnerability`,
        color: 'red',
        cacheSeconds: 2 * 60 * 60,
      }),
      headers: new Headers({
        'content-type': 'application/json',
      }),
    };
  }

  const loads = Array.from(mod.deps.values())
    .map(async (x: CodeModule) => {
      const href = determineModuleAttrs(x).href;
      if (!href) return 'todo';

      const parts = href.split('/');
      switch (parts[2]) {
        case 'deno.land': {
          const [modId, version] = parts[parts[3] === 'x' ? 4 : 3].split('@');
          const {latest, versions} = await fetch(`https://cdn.deno.land/${modId}/meta/versions.json`).then(x => x.json()) as {latest: string, versions: string[]};
          console.log({modId, version, latest});
          if (modId === 'std') {
            return versions.slice(0, 5).includes(version);
          } else {
            return version == latest;
          }
        }
        case 'github.com': {
          const [owner, repo, _, version] = parts.slice(3);
          const tags = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`).then(x => x.json()) as {name: string}[];
          console.log({owner, repo, version, tags: tags.map(x => x.name)});
          return !tags.some(x => x.name === version) || tags[0]?.name === version;
        }
        case 'www.npmjs.com': {
          isPureDeno = false;
          if (parts[4][0] === '@') {
            parts.splice(4, 0, parts.splice(4, 2).join('/'));
          }
          const [pkg, _, version] = parts.slice(4);
          const distTags = await fetch(`https://registry.npmjs.org/-/package/${pkg}/dist-tags`).then(x => x.json()) as Record<string,string>;
          // const data = await fetch(`https://registry.npmjs.org/${pkg}`, {
          //   headers: {
          //     accept: 'application/vnd.npm.install-v1+json',
          //   },
          // }).then(x => x.json());
          // console.log({pkg, version, distTags});
          if (!version) return 'latest';
          return Object.values(distTags).includes(version);
        }
        default: {
          isPureDeno = false;
          console.log(href);
          console.log('TODO: latest version info from', parts);
          return 'todo';
        }
      }
    });
  const decisions = await Promise.all(loads);
  const updatedFraction = decisions.filter(x => x).length / decisions.length;

  // like https://david-dm.org/
  return {
    status: 200,
    body: JSON.stringify({
      schemaVersion: 1,
      namedLogo: isPureDeno ? 'deno' : undefined,
      label: 'dependencies',
      message: updatedFraction <= 0.75 ? 'out of date' : 'up to date',
      color: updatedFraction <= 0.5 ? 'red'
           : updatedFraction <= 0.75 ? 'orange'
           : updatedFraction < 1 ? 'yellow'
           : 'green',
      cacheSeconds: 2 * 60 * 60,
    }),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  };
}

function makeCacheSizeShield(map: ModuleMap): http.Response {
  const totalSize = Array.from(map.modules.values())
    .reduce((sum, next) => sum + next.totalSize, 0);

  return {
    status: 200,
    body: JSON.stringify({
      schemaVersion: 1,
      label: "install size",
      message: filesize(totalSize),
      color: "informational",
      cacheSeconds: 4 * 60 * 60,
    }),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  };
}

async function makeXLatestVersionShield(modId: string): Promise<http.Response> {
  const {latest, versions} = await fetch(`https://cdn.deno.land/${modId}/meta/versions.json`).then(x => x.json()) as {latest: string, versions: string[]};

  return {
    status: 200,
    body: JSON.stringify({
      schemaVersion: 1,
      label: "deno.land/x",
      namedLogo: 'deno',
      message: latest,
      color: "informational",
      cacheSeconds: 1 * 60 * 60,
    }),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  };
}

function toObject<T>(iter: Iterable<[string,T]>): Record<string,T> {
  const out: Record<string,T> = Object.create(null);
  for (const [key, val] of iter) {
    out[key] = val;
  }
  return out;
}


export function makeErrorShield(err: Error): http.Response {
  const headers = new Headers({
    'content-type': 'application/json',
  });

  console.log(err.stack);
  return {
    status: 500,
    body: JSON.stringify({
      schemaVersion: 1,
      label: "badge failed",
      message: err.name,
      color: "inactive",
      isError: true,
      cacheSeconds: 4 * 60 * 60,
    }),
    headers,
  };
}
