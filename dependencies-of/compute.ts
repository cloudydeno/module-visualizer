import { filesize } from "https://cloudydeno.github.io/deno-bitesized/formatting/filesize@v1.ts";

const args = new URLSearchParams(Deno.args[0]);
const isolateStd = args.get('std') === 'isolate';

const rawData = new TextDecoder().decode(await Deno.readAll(Deno.stdin));
if (rawData[0] !== '{') throw new Error(`Expected JSON from "deno info --json"`);
const data = JSON.parse(rawData) as DenoInfo;

interface CodeModule {
  base: string;
  deps: Set<CodeModule>;
  depsUnversioned: Set<CodeModule>;
  totalSize: number;
  files: {
    url: string;
    deps: string[];
    size: number;
  }[];
};
const modules = new Map<string,CodeModule>();

function grabModFor(url: string) {
  const base = determineModuleBase(url);
  let module = modules.get(base);
  if (!module) {
    module = {
      base,
      totalSize: 0,
      deps: new Set(),
      depsUnversioned: new Set(),
      files: new Array(),
    };
    modules.set(base, module);
  }
  return module;
}

for await (const [url, info] of Object.entries(data.files)) {
  // console.log();
  const module = grabModFor(url);
  module.totalSize += info.size;
  module.files.push({
    url: url,
    deps: info.deps,
    size: info.size,
  });
  for (const dep of info.deps) {
    const depMod = grabModFor(dep);
    if (module == depMod) continue;
    module.deps.add(depMod);
  }
}

// Fix deno.land redirections via guesswork
// TODO: `deno cache` should give us this info so it's accurate
for (const [key, module] of modules) {
  if (module.files.length > 0) continue;
  if (module.base.startsWith('https://deno.land') && !module.base.includes('@')) {
    const candidates = Array.from(modules.values()).filter(x => x.base.startsWith(module.base+'@'));
    const latestCandidate = candidates.slice(-1)[0]; // TODO? is this sorted?
    if (latestCandidate) {
      const users = Array.from(modules.values()).filter(x => x.deps.has(module));
      for (const user of users) {
        user.deps.delete(module);
        user.deps.add(latestCandidate);
        user.depsUnversioned.add(latestCandidate);
      }
      modules.delete(key);
      continue;
    }
  }
  console.error('WARN: empty module', module.base);
}

// Collapse jspm weak version imports
const jspmCollapses = new Map<CodeModule, CodeModule>();
for (const [key, module] of modules) {
  if (!key.startsWith('https://dev.jspm.io/') && !key.startsWith('https://jspm.dev/')) continue;
  for (const dep of module.deps.values()) {
    if (dep.base.startsWith(key+'.')) {
      jspmCollapses.set(module, dep);
      break;
    }
  }
}
for (const [before, after] of jspmCollapses) {
  // Add our deps to the new targets
  for (const file of before.files) {
    after.files.push(file);
  }
  after.totalSize += before.totalSize
  // Remap all deps that were to the weak version
  for (const module of modules.values()) {
    if (module.deps.has(before)) {
      module.deps.delete(before);
      module.deps.add(after);
    }
  }
  // Clean up weak version
  modules.delete(before.base);
}

console.log(`digraph "imported modules" {`);
// console.log("  rankdir=LR;");
for (const module of modules.values()) {
  // console.log(module.base, Array.from(module.deps.values()).map(x => x.base));

  const labels = determineModuleLabel(module);
  labels.push(`${module.files.length} files, ${filesize(module.totalSize, {round: 0})}`);
  const nodeAttrs = {
    shape: 'box',
    label: labels.join('\n')+'\n',
    penwidth: `${Math.log(Math.max(module.files.length/2, 1))+1}`,
    fontname: "Pragati Narrow",
    style: 'filled',
    tooltip: module.base,
    ...determineModuleAttrs(module),
  };
  // if (module.files.length >= 5) nodeAttrs.shape = 'box3d';

  const attrPairs = Object
    .entries(nodeAttrs)
    .map(x => `${x[0]}=${JSON.stringify(x[1]).replace(/\\n/g, '\\l')}`);
  console.log(`  "${module.base}"[${attrPairs.join(',')}];`);

  for (const dep of module.deps.values()) {
    console.log(`  "${module.base}" -> "${dep.base}";`);
  }
}
console.log("}");

interface DenoInfo {
  compiled: string;
  depCount: number;
  fileType: string;
  local: string;
  map: unknown;
  module: string;
  totalSize: number;
  files: {[url: string]: {
    deps: string[];
    size: number;
  }};
};

function determineModuleBase(fullUrl: string): string {
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

function determineModuleLabel(module: CodeModule): string[] {
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
function determineModuleAttrs(module: CodeModule): Record<string,string> {
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
