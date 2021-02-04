export interface CodeModule {
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

export interface DenoInfo {
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
