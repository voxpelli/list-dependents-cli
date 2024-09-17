import type { ReadStream } from 'node:fs';
import type { ReadStream as ReadStreamTTY } from 'node:tty';

import type { EcosystemDependentsItem } from 'list-dependents';
import type { NormalizedPackageJson } from 'read-pkg';

export type CliDependentsItem = Omit<Partial<EcosystemDependentsItem>, 'pkg' | 'name'> & {
  name: string,
  pkg?: Partial<NormalizedPackageJson> | undefined,
};

export type CliDependentsCollection = Record<string, CliDependentsItem>;

export interface DownloadFlags {
  downloadPrecision: number | undefined;
  includePkg: boolean;
  maxPages: number | undefined;
  pkgFields: string[] | undefined;
}

export interface FilterFlags {
  maxAge: number | undefined;
  minDownloads: number;
}

export interface FormatFlags {
  markdown: boolean;
  skipLinks: boolean;
}

interface InputContext {
  explicitInput: boolean;
  input: ReadStream | ReadStreamTTY | undefined;
}

interface OutputContext {
  output: string | undefined;
}

interface FileContext extends InputContext, OutputContext {
  modifyInPlace: boolean;
}

interface SortFlags {
  sort: boolean;
  sortDependents: boolean;
  sortDownloads: boolean;
}

interface FormatContext {
  markdown: boolean;
  pkgFields: string[] | undefined;
  skipLinks: boolean;
}

interface CommandContextBase {
  debug: boolean;
  quiet: boolean;
}

interface CommandContextNamed extends CommandContextBase {
  moduleName: string;
}

export interface CommandContextFilter extends CommandContextBase, FileContext, FilterFlags, FormatContext, SortFlags {
  exclude: string[] | undefined;
  include: string[] | undefined;
  maxCount: number | undefined;
  prettyPrint: boolean;
  repositoryPrefix: string[] | undefined;
  targetVersion: string | undefined;
}
export interface CommandContextFormat extends CommandContextBase, InputContext, FormatContext {}
export interface CommandContextInit extends CommandContextNamed, OutputContext, DownloadFlags, FilterFlags, SortFlags {}
export interface CommandContextRefresh extends CommandContextBase, DownloadFlags, FileContext {
  check: boolean | undefined;
  moduleName: string | undefined;
}
export interface CommandContextLookup extends CommandContextNamed, DownloadFlags, FilterFlags, FileContext {
  check: boolean | undefined;
  includeHistoric: boolean | undefined;
}
