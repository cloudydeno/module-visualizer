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
  size:         number;
  mediaType:    DenoMediaType;
  local:        string;
  checksum:     string;
  emit?:        string;
  error:        undefined;
}
interface DenoModuleError {
  error:        string;
}
export type DenoModule = {
  specifier:       string;
  dependencies:    DenoDependency[];
  typeDependency?: DenoDependency;
} & (
  | DenoModuleInfo
  | DenoModuleError
);

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
