export interface CodeModule {
  base: string;
  fragment: string;
  deps: Set<CodeModule>;
  depsUnversioned: Set<CodeModule>;
  // TODO: depsTypes: Set<CodeModule>;
  totalSize: number;
  errors?: string[];
  files: {
    url: string;
    deps: string[];
    size: number;
  }[];
};


export interface DenoInfo {
  root:    string;
  modules: DenoModule[];
  size:    number;
}

interface DenoModuleInfo {
  specifier:    string;
  dependencies: DenoDependency[];
  size:         number;
  mediaType:    DenoMediaType;
  local:        string;
  checksum:     string;
  emit?:        string;
  error:        undefined;
}
interface DenoModuleError {
  specifier:    string;
  dependencies: DenoDependency[];
  error:        string;
}
export type DenoModule = DenoModuleInfo | DenoModuleError;

export interface DenoDependency {
  specifier: string;
  isDynamic: boolean;
  code?:     string; // url
  type?:     string; // url
}

export type DenoMediaType =
| "TypeScript"
| "JavaScript"
| "Dts"
;
