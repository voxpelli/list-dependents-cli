import type { NormalizedPackageJson } from 'read-pkg';
import type { EcosystemDependentsItem } from 'list-dependents';

export type CliDependentsItem = Omit<Partial<EcosystemDependentsItem>, 'pkg' | 'name'> & {
  name: string,
  pkg?: Partial<NormalizedPackageJson> | undefined,
};

export interface DownloadFlags {
  includePkg: boolean;
  maxAge: number | undefined;
  maxPages: number | undefined;
  minDownloads: number;
  pkgFields: string[] | undefined;
}

export interface SortFlags {
  sort: boolean;
  sortDependents: boolean;
  sortDownloads: boolean;
}

export interface CommandContextBase {
  debug: boolean;
  moduleName: string;
  output: string | undefined;
}

export interface CommandContextInit extends CommandContextBase, DownloadFlags, SortFlags {}
export interface CommandContextUpdate extends CommandContextBase, DownloadFlags {
  check: boolean | undefined;
  input: string | undefined;
}
