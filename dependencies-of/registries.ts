import { CodeModule } from "./types.ts";

export function determineModuleBase(fullUrl: string, isolateStd: boolean): string {
  const url = new URL(fullUrl);
  const parts = fullUrl.split('/');
  if (url.protocol !== 'https:') return fullUrl;
  switch (url.host) {
    case 'deno.land':
      if (parts[3].startsWith('std') && !isolateStd) return parts.slice(0, 4).join('/');
      return parts.slice(0, 5).join('/');
    case 'esm.sh':
      return parts.slice(0, 4 + (parts[3][0] === '@' ? 1 : 0)).join('/');
    case 'cdn.esm.sh':
      if (parts[4][0] === '_') return parts.slice(0,4).join('/')+'/_internal';
      return parts.slice(0, 5 + (parts[4][0] === '@' ? 1 : 0)).join('/');
    case 'raw.githubusercontent.com':
      return parts.slice(0, 6).join('/');
    case 'denopkg.com':
      const [repo, version] = parts[4].split('@');
      return `https://raw.githubusercontent.com/${parts[3]}/${repo}/${version||'master'}`;
    case 'cdn.skypack.dev':
      if (parts[3] !== '-') parts.splice(3, 0, '-');
      return parts.slice(0, 5 + (parts[4][0] === '@' ? 1 : 0)).join('/');
    case 'dev.jspm.io':
    case 'jspm.dev':
      if (!parts[3].includes(':')) {
        parts[3] = `npm:${parts[3]}`;
      }
      const path = parts.slice(0, 4 + (parts[3].includes(':@') ? 1 : 0)).join('/');
      return path.split('?')[0];
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
    case 'deno.land':
      let extra = new Array<string>();
      if (parts[3].startsWith('std') && !isolateStd) {
        const folders = new Set(module.files.map(x => x.url.split('/')[4]));
        extra = Array.from(folders).map(x => `    • /${x}`);
      }
      return ['/'+parts.slice(3).join('/'), ...extra];
    case 'esm.sh':
      return [parts.slice(3).join('/'), `from ${parts[2]}`];
    case 'cdn.esm.sh':
      // return [parts.slice(2).join('/')];
      return [parts.slice(4).join('/'), `from ${parts[2]}/${parts[3]}`];
    case 'raw.githubusercontent.com':
      return [parts.slice(4).join('@'), `from github.com/${parts[3]}`];
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
    default:
      return [module.base];
  }
}

// https://graphviz.org/doc/info/colors.html
export function determineModuleAttrs(module: CodeModule): Record<string,string> {
  const url = new URL(module.base);
  const parts = url.pathname.split('/')
  if (url.protocol !== 'https:') return {};
  switch (url.host) {
    case 'deno.land':
      if (url.pathname.startsWith('/std')) return { fillcolor: 'palegreen1', href: module.base };
      return { fillcolor: 'darkslategray1', href: module.base };
    case 'cdn.esm.sh':
      return { fillcolor: 'cornsilk', href: makeNpmHref(parts.slice(2).join('/')) };
    case 'esm.sh':
      return { fillcolor: 'cadetblue1', href: makeNpmHref(url.pathname.slice(1)) };
    case 'raw.githubusercontent.com':
      const href = `https://github.com/${parts[1]}/${parts[2]}/tree/${parts[3]}`;
      return { fillcolor: 'chocolate1', href };
    case 'cdn.skypack.dev':
      // TODO: urls have a random string after the version number
      return { fillcolor: 'darkturquoise' };
    case 'dev.jspm.io':
    case 'jspm.dev':
      return { fillcolor: 'palevioletred', href: makeNpmHref(url.pathname.slice(5)) };
    default:
      if (url.hostname.endsWith('.github.io')) {
        const href = `https://github.com/${url.hostname.split('.')[0]}/${parts[1]}`;
        return { fillcolor: 'cornsilk3', href };
      }
      return { fillcolor: 'cornsilk3' };
  }
}

function makeNpmHref(packageId: string) {
  if (packageId.startsWith('_')) return '';
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
