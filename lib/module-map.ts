import { filesize } from "https://crux.land/6wZ5Sz#filesize@v1";

import { CodeModule, DenoInfo, DenoModule } from "./types.ts";
import * as registries from "./module-registries.ts";

export class ModuleMap {
  modules = new Map<string,CodeModule>();
  mainModule: CodeModule;
  registryOpts: registries.RegistryOpts;

  constructor(
    public args: URLSearchParams,
    public redirects: Record<string,string>,
    public rootNode: DenoModule,
  ) {
    this.registryOpts = {
      mainModule: rootNode.specifier,
      isolateStd: this.args.get('std') === 'isolate',
    }

    this.mainModule = this.grabModFor(
      rootNode.specifier,
      rootNode.error ? '#error' : undefined);
  }

  grabModFor(url: string, fragment: string = '') {
    const wireUrl = url.split('#')[0];
    const actualUrl = this.redirects[wireUrl] || wireUrl;
    const base = registries.determineModuleBase(actualUrl, this.registryOpts);
    let moduleInfo = this.modules.get(base + fragment);
    if (!moduleInfo) {
      moduleInfo = {
        base,
        fragment,
        totalSize: 0,
        deps: new Set(),
        depsUnversioned: new Set(),
        files: new Array(),
      };
      this.modules.set(base + fragment, moduleInfo);
    }
    return moduleInfo;
  }

  addFile(url: string, info: DenoModule, data: DenoInfo) {
    if (info.error != null) {
      const module = this.grabModFor(url, '#error');
      if (!module.errors) module.errors = [];
      module.errors.push(info.error);
      return;
    }

    const depEdges = info.dependencies?.flatMap(x => [
      x.code?.specifier ?? '',
      x.type?.specifier ?? '',
    ].filter(x => x)) ?? [];
    if (info.typesDependency?.dependency.specifier) {
      depEdges.push(info.typesDependency.dependency.specifier);
    }

    const module = this.grabModFor(url);
    module.totalSize += info.size;
    module.files.push({
      url: url,
      deps: depEdges,
      size: info.size,
    });
    for (const dep of depEdges) {
      const depNode = data.modules.find(x => x.specifier === dep);
      const depMod = this.grabModFor(dep, depNode?.error ? '#error' : undefined);
      if (module !== depMod) {
        module.deps.add(depMod);
      }
    }
  }

  emitJSON() {
    const modules: Record<string, {
      moduleDeps: string[];
      labelText: string[];
      totalSize: number;
      fileCount: number;
      errors?: string[];
      nodeAttrs: Record<string,string>;
    }> = Object.create(null);
    for (const module of this.modules.values()) {
      modules[module.base+module.fragment] = {
        moduleDeps: Array.from(module.deps).map(x => x.base+x.fragment),
        labelText: registries.determineModuleLabel(module, this.registryOpts),
        totalSize: module.totalSize,
        fileCount: module.files.length,
        errors: module.errors,
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

      const labels = registries.determineModuleLabel(module, this.registryOpts);
      if (module.errors) {
        labels.unshift(`${module.errors.length} FAILED IMPORTS FROM:`);
        for (const err of module.errors) {
          labels.push('    • '+err.split('\n')[0].split(': ').slice(1).join(': '));
        }
        // throw new Error(`TODO: module ${url} failed: ${JSON.stringify(info.error)}`);
      } else {
        labels.push(`${module.files.length} files, ${filesize(module.totalSize, {round: 0})}`);
      }

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
      emitLine(`  "${module.base}${module.fragment}"[${attrPairs.join(',')}];`);

      for (const dep of module.deps.values()) {
        emitLine(`  "${module.base}${module.fragment}" -> "${dep.base}${dep.fragment}";`);
      }
      emitLine('');
    }
    emitLine("}");
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
  // TODO: when are there multiple roots?
  const roots = data.roots.map(x => data.redirects[x] || x);
  const rootNode = data.modules.find(x => roots.includes(x.specifier));
  if (!rootNode) throw new Error(
    `I didn't find a root node in the Deno graph! This is a module-visualizer bug.`);

  const map = new ModuleMap(args ?? new URLSearchParams, data.redirects, rootNode);
  for (const info of data.modules) {
    map.addFile(info.specifier, info, data);
  }

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
