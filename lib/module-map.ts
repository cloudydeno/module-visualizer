import { filesize } from "../deps.ts";

import { CodeModule, DenoInfo, DenoModule } from "./types.ts";
import * as registries from "./module-registries.ts";

export class ModuleMap {
  modules = new Map<string,CodeModule>();
  mainModule: CodeModule | null = null;
  mainFile: string | null = null;

  constructor(public args: URLSearchParams) {
    this.isolateStd = this.args.get('std') === 'isolate';
  }
  isolateStd: boolean;

  grabModFor(url: string) {
    const base = registries.determineModuleBase(url, this.isolateStd);
    let module = this.modules.get(base);
    if (!module) {
      module = {
        base,
        totalSize: 0,
        deps: new Set(),
        depsUnversioned: new Set(),
        files: new Array(),
      };
      this.modules.set(base, module);
    }
    return module;
  }

  setMainUrl(url: string) {
    this.mainModule = this.grabModFor(url);
    this.mainFile = url;
  }

  addFile(url: string, info: DenoModule) {
    if (info.error != null) throw new Error(`TODO: module ${url} failed`);
    const module = this.grabModFor(url);
    module.totalSize += info.size;
    module.files.push({
      url: url,
      deps: info.dependencies.flatMap(x => [x.code ?? '', x.type ?? ''].filter(x => x)),
      size: info.size,
    });
    for (const dep of info.dependencies) {
      const depMod = this.grabModFor(dep.code || dep.type || '');
      if (module == depMod) continue;
      module.deps.add(depMod);
    }
  }

  emitJSON() {
    const modules: Record<string, {
      moduleDeps: string[];
      labelText: string[];
      totalSize: number;
      fileCount: number;
      nodeAttrs: Record<string,string>;
    }> = Object.create(null);
    for (const module of this.modules.values()) {
      modules[module.base] = {
        moduleDeps: Array.from(module.deps).map(x => x.base),
        labelText: registries.determineModuleLabel(module, this.isolateStd),
        totalSize: module.totalSize,
        fileCount: module.files.length,
        nodeAttrs: registries.determineModuleAttrs(module),
      };
    }
    return { modules };
  }

  emitDOT(emitLine: (line: string) => void) {
    emitLine(`digraph "imported modules" {`);
    emitLine(`  rankdir=${JSON.stringify(this.args.get('rankdir') || 'TB')};`);
    emitLine('');
    for (const module of this.modules.values()) {
      // console.log(module.base, Array.from(module.deps.values()).map(x => x.base));

      const labels = registries.determineModuleLabel(module, this.isolateStd);
      labels.push(`${module.files.length} files, ${filesize(module.totalSize, {round: 0})}`);
      const nodeAttrs = {
        shape: 'box',
        label: labels.join('\n')+'\n',
        penwidth: `${Math.log(Math.max(module.files.length/2, 1))+1}`,
        fontname: this.args.get('font') || 'Arial',
        style: 'filled',
        tooltip: module.base,
        ...registries.determineModuleAttrs(module),
      };
      // if (module.files.length >= 5) nodeAttrs.shape = 'box3d';

      const attrPairs = Object
        .entries(nodeAttrs)
        .map(x => `${x[0]}=${JSON.stringify(x[1]).replace(/\\n/g, '\\l')}`);
      emitLine(`  "${module.base}"[${attrPairs.join(',')}];`);

      for (const dep of module.deps.values()) {
        emitLine(`  "${module.base}" -> "${dep.base}";`);
      }
      emitLine('');
    }
    emitLine("}");
  }

  // Fix deno.land redirections via guesswork
  // TODO: `deno cache` should give us this info so it's accurate
  // https://github.com/denoland/deno/issues/9351
  fixupRedirects() {
    const allModules = Array.from(this.modules.values());
    for (const [key, module] of this.modules) {
      if (module.files.length > 0) continue;
      if (module.base.startsWith('https://deno.land') && !module.base.includes('@')) {
        const candidates = allModules.filter(x => x.base.startsWith(module.base+'@'));
        const latestCandidate = candidates.slice(-1)[0]; // TODO? is this sorted?
        if (latestCandidate) {
          const users = allModules.filter(x => x.deps.has(module));
          for (const user of users) {
            user.deps.delete(module);
            user.deps.add(latestCandidate);
            user.depsUnversioned.add(latestCandidate);
          }
          this.modules.delete(key);
          continue;
        }
      }
      console.error('WARN: empty module', module.base);
    }
  }

  // Collapse jspm weak version imports into single nodes
  // TODO: mark weak version edges in the graph
  fixupJSPM() {
    const jspmCollapses = new Map<CodeModule, CodeModule>();
    for (const [key, module] of this.modules) {
      if (!key.startsWith('https://dev.jspm.io/') && !key.startsWith('https://jspm.dev/')) continue;
      let prefix = (key+'.').replace(/latest\.$/, '');
      if (!prefix.replace(/[:/]@/g, '').includes('@')) {
        prefix = prefix.replace(/\.$/, '@');
        console.error(prefix);
      }
      for (const dep of module.deps.values()) {
        if (dep.base.startsWith(prefix)) {
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
      for (const module of this.modules.values()) {
        if (module.deps.has(before)) {
          module.deps.delete(before);
          module.deps.add(after);
        }
      }
      // Clean up weak version
      this.modules.delete(before.base);
    }
  }

}

export function processDenoInfo(data: DenoInfo, args?: URLSearchParams) {
  const map = new ModuleMap(args ?? new URLSearchParams);

  map.setMainUrl(data.root);
  for (const info of data.modules) {
    // console.log();
    map.addFile(info.specifier, info);
  }

  map.fixupRedirects();
  map.fixupJSPM();

  return map;
}

export function computeDependencies(data: DenoInfo, args: URLSearchParams) {
  const map = processDenoInfo(data, args);

  // Allow output different levels of processing
  switch (args.get('format')) {
    case 'json':
      if (typeof args.get('pretty') === 'string') {
        return JSON.stringify(map.emitJSON(), null, 2);
      }
      return JSON.stringify(map.emitJSON());

    case 'dot':
    case null:
      const lines = new Array<string>();
      map.emitDOT(line => lines.push(line));
      return lines.join('\n')+'\n';

    default:
      throw new Error(`Unexpected format ${JSON.stringify(args.get('format'))}`);
  }
}

if (import.meta.main) {
  const rawData = new TextDecoder().decode(await Deno.readAll(Deno.stdin));
  if (rawData[0] !== '{') throw new Error(`Expected JSON from "deno info --json"`);
  const data = JSON.parse(rawData) as DenoInfo;

  const args = new URLSearchParams(Deno.args[0]);

  console.log(computeDependencies(data, args));
}
