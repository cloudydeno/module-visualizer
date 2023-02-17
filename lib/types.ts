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
    size?: number;
  }[];
};
