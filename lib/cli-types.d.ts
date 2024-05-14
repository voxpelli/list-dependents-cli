import { ReadStream } from 'node:fs';

import type { NormalizedPackageJson } from 'read-pkg';
import type { EcosystemDependentsItem } from 'list-dependents';

export type CliDependentsItem = Omit<Partial<EcosystemDependentsItem>, 'pkg' | 'name'> & {
  name: string,
  pkg?: Partial<NormalizedPackageJson> | undefined,
};

export type CliDependentsCollection = Record<string, CliDependentsItem>;

export interface DownloadFlags {
  includePkg: boolean;
  maxPages: number | undefined;
  pkgFields: string[] | undefined;
}

export interface FilterFlags {
  maxAge: number | undefined;
  minDownloads: number;
}

interface InputContext {
  input: ReadStream | (NodeJS.ReadStream & { fd: 0; }) | undefined;
  modifyInPlace: boolean;
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

export interface CommandContextFilter extends CommandContextBase, InputContext, FilterFlags, SortFlags {
  maxCount: number | undefined;
  repositoryPrefix: string | undefined;
}
export interface CommandContextInit extends CommandContextNamed, DownloadFlags, FilterFlags, SortFlags {}
export interface CommandContextRefresh extends CommandContextBase, DownloadFlags, InputContext {
  check: boolean | undefined;
  moduleName: string | undefined;
}
export interface CommandContextUpdate extends CommandContextNamed, DownloadFlags, FilterFlags, InputContext {
  check: boolean | undefined;
}
