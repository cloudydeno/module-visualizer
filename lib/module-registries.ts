import type { CodeModule } from "./types.ts";

export interface RegistryOpts {
  mainModule: string;
  isolateFiles?: boolean;
  isolateStd?: boolean;
};

export function determineModuleBase(fullUrl: string, opts: RegistryOpts): string {
  const url = new URL(fullUrl);
  const parts = fullUrl.split('/');
  if (url.protocol === 'file:') {
    if (opts.isolateFiles) return fullUrl;
    if (url.pathname.endsWith('deps.ts')) return fullUrl;
    return new URL('.', url).toString();
  }
  if (url.protocol !== 'https:') return fullUrl;
  switch (url.host) {
    case 'deno.land':
      if (parts[3].startsWith('std') && !opts.isolateStd) return parts.slice(0, 4).join('/');
      return parts.slice(0, 5).join('/');
    case 'cdn.deno.land':
      if (parts[3] === 'std' && opts.isolateStd) return parts.slice(0, 8).join('/');
      return parts.slice(0, 6).join('/');
    case 'crux.land':
      if (parts.length == 4) return `${url.origin}/${parts[3]}`;
      return `${url.origin}/${parts[5].split('.')[0]}`;
    case 'esm.sh':
      return parts.slice(0, 4 + (parts[3][0] === '@' ? 1 : 0)).join('/');
    case 'cdn.esm.sh':
      if (parts[4][0] === '_') return parts.slice(0,4).join('/')+'/_internal';
      return parts.slice(0, 5 + (parts[4][0] === '@' ? 1 : 0)).join('/');
    case 'cdn.dreg.dev':
      if (parts[3] !== 'package') return parts.slice(0,4).join('/');
      return parts.slice(0, 5 + (parts[4][0] === '@' ? 1 : 0)).join('/');
    case 'github.com':
      return `https://raw.githubusercontent.com/${parts[3]}/${parts[4]}/${parts[6]}`;
    case 'raw.githubusercontent.com':
      return parts.slice(0, 6).join('/');
    case 'gist.githubusercontent.com':
      return parts.slice(0, 7).join('/');
    case 'denopkg.com':
      const [repo, version] = parts[4].split('@');
      return `https://raw.githubusercontent.com/${parts[3]}/${repo}/${version||'master'}`;
    case 'cdn.skypack.dev':
      if (parts[3] !== '-') parts.splice(3, 0, '-');
      return parts.slice(0, 5 + (parts[4][0] === '@' ? 1 : 0)).join('/')
        .replace(/([^\/]+@[^\/]+)-[^-]+$/, '$1'); // remove hashsum after version
    case 'cdn.pika.dev':
      // skypack precursor, just redirects, so roll with it
      if (parts[3] !== '-') parts.splice(3, 0, '-');
      return 'https://cdn.skypack.dev/'+parts.slice(3, 5 + (parts[4][0] === '@' ? 1 : 0)).join('/');
    case 'dev.jspm.io':
    case 'jspm.dev': {
      if (!parts[3].includes(':')) {
        parts[3] = `npm:${parts[3]}`;
      }
      const path = parts.slice(0, 4 + (parts[3].includes(':@') ? 1 : 0)).join('/');
      return path.split(/[?!]/)[0];
    }
    case 'cdn.jsdelivr.net':
      switch (parts[3]) {
        case 'gh':
          return parts.slice(0, 6).join('/');
        case 'npm':
          return parts.slice(0, 5 + (parts[4][0] == '@' ? 1 : 0)).join('/');
      }; break;
    case 'cdn.pagic.org':
    case 'unpkg.com':
      return parts.slice(0, 4 + (parts[3][0] == '@' ? 1 : 0)).join('/');
    case 'aws-api.deno.dev':
      return parts.slice(0, 5).join('/');
    default:
      if (url.hostname.endsWith('.github.io')) {
        return parts.slice(0, 4).join('/');
      }
      if (url.hostname.endsWith('.arweave.net')) {
        return parts.slice(0, 4).join('/');
      }
  }
  if (url.pathname.includes('@')) {
    const verIdx = parts.findIndex(x => x.includes('@'))
    return parts.slice(0, verIdx+1).join('/');
  }
  return fullUrl;
}

export function determineModuleLabel(module: CodeModule, opts: RegistryOpts): string[] {
  const url = new URL(module.base);
  const parts = module.base.split('/');
  if (url.protocol === 'file:') {
    const mainDir = new URL('.', opts.mainModule).toString();
    const thisDir = module.base;
    if (thisDir.startsWith(mainDir)) {
      return [`./${thisDir.slice(mainDir.length)}`];
    }
    const dirNames = mainDir.split('/');
    dirNames.pop(); // trailing slash
    let steps = 0;
    while (dirNames.length > 5 && ++steps && dirNames.pop()) {
      const joined = dirNames.join('/');
      if (thisDir.startsWith(joined+'/')) {
        const walkUp = new Array(steps).fill('..').join('/');
        return [`${walkUp}/${thisDir.slice(joined.length+1)}`];
      }
    }
    return [thisDir];
  }
  if (url.protocol !== 'https:') return [module.base];
  switch (url.host) {
    case 'deno.land': {
      let extra = new Array<string>();
      if (parts[3].startsWith('std') && !opts.isolateStd) {
        const folders = new Set(module.files.map(x => x.url.split('/')[4]));
        extra = Array.from(folders).map(x => `    • /${x}`);
      }
      return ['/'+parts.slice(3).join('/'), ...extra];
    }
    case 'cdn.deno.land': {
      let extra = new Array<string>();
      if (parts[3] === 'std' && !opts.isolateStd) {
        const folders = new Set(module.files.map(x => x.url.split('/')[7]));
        extra = Array.from(folders).map(x => `    • /${x}`);
      }
      let modName = `/${parts[3]}@${parts[5]}`;
      if (parts[3] !== 'std') modName = `/x${modName}`;
      return [[modName, ...parts.slice(7)].join('/'), `from ${parts[2]}`, ...extra];
    }
    case 'crux.land':
      return [module.base.split('//')[1]];
    case 'esm.sh':
      return [parts.slice(3).join('/'), `from ${parts[2]}`];
    case 'cdn.esm.sh':
      // return [parts.slice(2).join('/')];
      return [parts.slice(4).join('/'), `from ${parts[2]}/${parts[3]}`];
    case 'cdn.dreg.dev':
      if (parts[3] !== 'package') return [parts.slice(0,4).join('/')];
      return [parts.slice(4).join('/'), `from ${parts[2]}`];
    case 'raw.githubusercontent.com':
      if (parts[5].length >= 20) {
        return [parts[4], '  @ '+parts[5], `from github.com/${parts[3]}`];
      }
      return [parts.slice(4).join('@'), `from github.com/${parts[3]}`];
    case 'gist.githubusercontent.com':
      return [`gist: ${parts[3]}/${parts[4]}`, '  @ '+parts[6]];
    case 'cdn.skypack.dev':
      return [parts.slice(4).join('/'), `from ${parts.slice(2,3).join('/')}`];
    case 'dev.jspm.io':
    case 'jspm.dev':
      if (parts[3].startsWith('npm:')) {
        parts[3] = parts[3].slice(4);
      }
      return [parts.slice(3).join('/'), `from ${parts[2]}`];
    case 'cdn.jsdelivr.net':
      switch (parts[3]) {
        case 'gh':
          const [repo, ver] = parts[5].split('@');
          if (ver.length >= 20) {
            return [repo, '  @ '+ver, `from github.com/${parts[4]}`];
          }
          return [parts[5], `from github.com/${parts[4]}`];
        case 'npm':
          return [parts.slice(4).join('/'), `from ${parts.slice(2,4).join('/')}`];
      }; break;
    case 'cdn.pagic.org':
    case 'unpkg.com':
      return [parts.slice(3).join('/'), `from ${parts[2]}`];
    case 'aws-api.deno.dev': {
      const services = Array.from(new Set(module.files.map(x => x.url.split('/')[5]?.split('.')[0])));
      const namedServices = services.filter(x => x.length < 8).slice(0, 3);
      if (namedServices.length < 1) namedServices.push(services[0]);
      const unnamedCount = services.length - namedServices.length;
      const svcList = '    ' + namedServices.join(', ') + (unnamedCount ? ` + ${unnamedCount} others` : '');
      const modName = module.base.slice(url.protocol.length).replace(/\/services$/, '');
      return [ modName, svcList ];
    }
    default:
      if (url.hostname.endsWith('.github.io')) {
        return [parts.slice(3).join('/'), `from ${url.hostname}`];
      }
  }
  return [module.base];
}

// CSS color names
// e.g. https://www.rapidtables.com/web/css/css-color.html
// gold is still available and looks pretty great, fwiw
export const ModuleColors = {
  "deno.land/std": "lightgreen",
  "deno.land/x": "lightskyblue",
  "crux.land": "greenyellow",
  "cdn.esm.sh": "blanchedalmond",
  "esm.sh": "burlywood",
  "cdn.dreg.dev": "wheat",
  "raw.githubusercontent.com": "chocolate",
  "gist.githubusercontent.com": "violet",
  "cdn.skypack.dev": "darkturquoise",
  "dev.jspm.io": "palevioletred",
  "jspm.dev": "palevioletred",
  "cdn.pagic.org": "rosybrown",
  "cdn.jsdelivr.net": "yellowgreen",
  "unpkg.com": "rosybrown",
  "github.io": "lightsalmon",
  "aws-api.deno.dev": "darkorange",

  "error": "salmon",
  "unknown": "silver",
} as const;

export function determineModuleAttrs(module: CodeModule): Record<string,string> {
  if (module.fragment === '#error') {
    return { fillcolor: ModuleColors["error"] };
  }
  const url = new URL(module.base);
  const parts = url.pathname.split('/');
  if (url.protocol !== 'https:') return {};
  switch (url.host) {
    // Deno natives - direct href
    case 'deno.land':
      if (url.pathname.startsWith('/std')) {
        return { fillcolor: ModuleColors["deno.land/std"], href: module.base };
      }
      return { fillcolor: ModuleColors["deno.land/x"], href: module.base };
    case 'crux.land':
      return { fillcolor: ModuleColors["crux.land"], href: module.base };
    case 'aws-api.deno.dev':
      return { fillcolor: ModuleColors["aws-api.deno.dev"], href: module.base };
    // Github direct links
    case 'raw.githubusercontent.com': {
      const href = `https://github.com/${parts[1]}/${parts[2]}/tree/${parts[3]}`;
      return { fillcolor: ModuleColors["raw.githubusercontent.com"], href };
    }
    case 'gist.githubusercontent.com': {
      const href = `https://gist.github.com/${parts[1]}/${parts[2]}/${parts[4]}`;
      return { fillcolor: ModuleColors["gist.githubusercontent.com"], href };
    }
    // NPM proxies, cdns, repackagers
    case 'cdn.esm.sh':
      return { fillcolor: ModuleColors["cdn.esm.sh"], href: makeNpmHref(parts.slice(2).join('/')) };
    case 'esm.sh':
      return { fillcolor: ModuleColors["esm.sh"], href: makeNpmHref(url.pathname.slice(1)) };
    case 'cdn.dreg.dev':
      return { fillcolor: ModuleColors["cdn.dreg.dev"], href: makeNpmHref(parts.slice(2).join('/')) };
    case 'cdn.skypack.dev':
      // TODO: urls have a random string after the version number
      return { fillcolor: ModuleColors["cdn.skypack.dev"], href: makeNpmHref(url.pathname.slice(3)) };
    case 'dev.jspm.io':
      return { fillcolor: ModuleColors["dev.jspm.io"], href: makeNpmHref(url.pathname.slice(5)) };
    case 'jspm.dev':
      return { fillcolor: ModuleColors["jspm.dev"], href: makeNpmHref(url.pathname.slice(5)) };
    case 'cdn.jsdelivr.net':
      switch (parts[1]) {
        case 'gh':
          const [repo, ver] = parts[3].split('@');
          return { fillcolor: ModuleColors["cdn.jsdelivr.net"],
            href: `https://github.com/${parts[2]}/${repo}${ver ? `/tree/${ver}` : ''}`,
          };
        case 'npm':
          return { fillcolor: ModuleColors["cdn.jsdelivr.net"],
            href: makeNpmHref(url.pathname.slice(5)),
          };
      }; break;
    case 'cdn.pagic.org':
      return { fillcolor: ModuleColors["cdn.pagic.org"], href: makeNpmHref(url.pathname.slice(1)) };
    case 'unpkg.com':
      return { fillcolor: ModuleColors["unpkg.com"], href: makeNpmHref(url.pathname.slice(1)) };
    default:
      if (url.hostname.endsWith('.github.io')) {
        const username = url.hostname.split('.')[0];
        const href = `https://github.com/${username}/${parts[1]}`;
        return { fillcolor: ModuleColors["github.io"], href };
      }
  }
  return { fillcolor: ModuleColors["unknown"] };
}

function makeNpmHref(packageId: string) {
  if (!packageId || packageId.startsWith('_')) return '';
  let url: string;
  if (packageId.startsWith('@')) {
    const parts = packageId.slice(1).split('@');
    url = `https://www.npmjs.com/package/@${parts[0]}`;
  } else {
    const parts = packageId.split('@');
    url = `https://www.npmjs.com/package/${parts[0]}`;
  }
  const parts = packageId.slice(1).split(/@v?/);
  if (parts.length > 1) {
    url += `/v/${parts[1]}`;
  }
  return url;
}
