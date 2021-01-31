import { filesize } from "https://cloudydeno.github.io/deno-bitesized/formatting/filesize@v1.ts";

import { CodeModule, DenoInfo } from "./types.ts";
import * as registries from "./registries.ts";

const rawData = new TextDecoder().decode(await Deno.readAll(Deno.stdin));
if (rawData[0] !== '{') throw new Error(`Expected JSON from "deno info --json"`);
const data = JSON.parse(rawData) as DenoInfo;

const args = new URLSearchParams(Deno.args[0]);
const isolateStd = args.get('std') === 'isolate';

const modules = new Map<string,CodeModule>();

function grabModFor(url: string) {
  const base = registries.determineModuleBase(url, isolateStd);
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
console.log(`  rankdir=${JSON.stringify(args.get('rankdir') || 'TB')};`);
for (const module of modules.values()) {
  // console.log(module.base, Array.from(module.deps.values()).map(x => x.base));

  const labels = registries.determineModuleLabel(module, isolateStd);
  labels.push(`${module.files.length} files, ${filesize(module.totalSize, {round: 0})}`);
  const nodeAttrs = {
    shape: 'box',
    label: labels.join('\n')+'\n',
    penwidth: `${Math.log(Math.max(module.files.length/2, 1))+1}`,
    fontname: args.get('font'),
    style: 'filled',
    tooltip: module.base,
    ...registries.determineModuleAttrs(module),
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
