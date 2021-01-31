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
