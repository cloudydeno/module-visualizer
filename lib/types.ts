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
  roots:     string[];
  modules:   DenoModule[];
  redirects: Record<string,string>;
}

interface DenoModuleInfo {
  size:         number;
  mediaType:    DenoMediaType;
  local:        string;
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
  code?:     { specifier: string }; // also the span
  type?:     { specifier: string }; // also the span
}

export type DenoMediaType =
| "TypeScript"
| "JavaScript"
| "Dts"
;
