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

interface InputFlags {
  input: string | undefined;
}

interface SortFlags {
  sort: boolean;
  sortDependents: boolean;
  sortDownloads: boolean;
}

interface CommandContextBase {
  debug: boolean;
  output: string | undefined;
}

interface CommandContextNamed extends CommandContextBase {
  moduleName: string;
}

export interface CommandContextInit extends CommandContextNamed, DownloadFlags, SortFlags {}
export interface CommandContextUpdate extends CommandContextNamed, DownloadFlags, InputFlags {
  check: boolean | undefined;
}
