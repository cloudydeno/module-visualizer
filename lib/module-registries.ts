import { CodeModule } from "./types.ts";

export function determineModuleBase(fullUrl: string, isolateStd: boolean): string {
  const url = new URL(fullUrl);
  const parts = fullUrl.split('/');
  if (url.protocol !== 'https:') return fullUrl;
  switch (url.host) {
    case 'deno.land':
      if (parts[3].startsWith('std') && !isolateStd) return parts.slice(0, 4).join('/');
      return parts.slice(0, 5).join('/');
    case 'cdn.deno.land':
      if (parts[3] === 'std' && isolateStd) return parts.slice(0, 8).join('/');
      return parts.slice(0, 6).join('/');
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
      return parts.slice(0, 5 + (parts[4][0] === '@' ? 1 : 0)).join('/');
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
      if (url.pathname.includes('@')) {
        const verIdx = parts.findIndex(x => x.includes('@'))
        return parts.slice(0, verIdx+1).join('/');
      }
      return fullUrl;
  }
}

export function determineModuleLabel(module: CodeModule, isolateStd: boolean): string[] {
  const url = new URL(module.base);
  const parts = module.base.split('/');
  if (url.protocol !== 'https:') return [module.base];
  switch (url.host) {
    case 'deno.land': {
      let extra = new Array<string>();
      if (parts[3].startsWith('std') && !isolateStd) {
        const folders = new Set(module.files.map(x => x.url.split('/')[4]));
        extra = Array.from(folders).map(x => `    • /${x}`);
      }
      return ['/'+parts.slice(3).join('/'), ...extra];
    }
    case 'cdn.deno.land': {
      let extra = new Array<string>();
      if (parts[3] === 'std' && !isolateStd) {
        const folders = new Set(module.files.map(x => x.url.split('/')[7]));
        extra = Array.from(folders).map(x => `    • /${x}`);
      }
      let modName = `/${parts[3]}@${parts[5]}`;
      if (parts[3] !== 'std') modName = `/x${modName}`;
      return [[modName, ...parts.slice(7)].join('/'), `from ${parts[2]}`, ...extra];
    }
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
      let modName = parts[4];
      if (modName.includes('@')) {
        modName = modName.replace(/-[^@-]+$/, '');
      }
      return [modName, `from ${parts.slice(2,3).join('/')}`];
    case 'dev.jspm.io':
    case 'jspm.dev':
      if (parts[3].startsWith('npm:')) {
        parts[3] = parts[3].slice(4);
      }
      return [parts.slice(3).join('/'), `from ${parts[2]}`];
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
      return [module.base];
  }
}

// CSS color names
// e.g. https://www.rapidtables.com/web/css/css-color.html
export const ModuleColors = {
  "deno.land/std": "lightgreen",
  "deno.land/x": "lightskyblue",
  "cdn.esm.sh": "blanchedalmond",
  "esm.sh": "burlywood",
  "cdn.dreg.dev": "wheat",
  "raw.githubusercontent.com": "chocolate",
  "gist.githubusercontent.com": "violet",
  "cdn.skypack.dev": "darkturquoise",
  "dev.jspm.io": "palevioletred",
  "jspm.dev": "palevioletred",
  "cdn.pagic.org": "rosybrown",
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
    case 'deno.land':
      if (url.pathname.startsWith('/std')) {
        return { fillcolor: ModuleColors["deno.land/std"], href: module.base };
      }
      return { fillcolor: ModuleColors["deno.land/x"], href: module.base };
    case 'cdn.esm.sh':
      return { fillcolor: ModuleColors["cdn.esm.sh"], href: makeNpmHref(parts.slice(2).join('/')) };
    case 'esm.sh':
      return { fillcolor: ModuleColors["esm.sh"], href: makeNpmHref(url.pathname.slice(1)) };
    case 'cdn.dreg.dev':
      return { fillcolor: ModuleColors["cdn.dreg.dev"], href: makeNpmHref(parts.slice(2).join('/')) };
    case 'raw.githubusercontent.com': {
      const href = `https://github.com/${parts[1]}/${parts[2]}/tree/${parts[3]}`;
      return { fillcolor: ModuleColors["raw.githubusercontent.com"], href };
    }
    case 'gist.githubusercontent.com': {
      const href = `https://gist.github.com/${parts[1]}/${parts[2]}/${parts[4]}`;
      return { fillcolor: ModuleColors["gist.githubusercontent.com"], href };
    }
    case 'cdn.skypack.dev':
      // TODO: urls have a random string after the version number
      return { fillcolor: ModuleColors["cdn.skypack.dev"] };
    case 'dev.jspm.io':
      return { fillcolor: ModuleColors["dev.jspm.io"], href: makeNpmHref(url.pathname.slice(5)) };
    case 'jspm.dev':
      return { fillcolor: ModuleColors["jspm.dev"], href: makeNpmHref(url.pathname.slice(5)) };
    case 'cdn.pagic.org':
      return { fillcolor: ModuleColors["cdn.pagic.org"], href: makeNpmHref(url.pathname.slice(1)) };
    case 'unpkg.com':
      return { fillcolor: ModuleColors["unpkg.com"], href: makeNpmHref(url.pathname.slice(1)) };
    case 'aws-api.deno.dev':
      return { fillcolor: ModuleColors["aws-api.deno.dev"], href: module.base };
    default:
      if (url.hostname.endsWith('.github.io')) {
        const username = url.hostname.split('.')[0];
        const href = `https://github.com/${username}/${parts[1]}`;
        return { fillcolor: ModuleColors["github.io"], href };
      }
      return { fillcolor: ModuleColors["unknown"] };
  }
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
  const parts = packageId.slice(1).split('@');
  if (parts.length > 1) {
    url += `/v/${parts[1]}`;
  }
  return url;
}
