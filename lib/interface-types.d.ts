import type { BunyanLite } from "bunyan-adaptor";
// @ts-ignore
import type { NormalizedPackageJson } from "read-pkg";

export interface DependentsMeta {
  downloads: number;
  name: string;
}

export interface EcosystemDependentsMeta extends DependentsMeta {
  dependentCount: number | undefined,
  firstRelease: string | undefined,
  latestRelease: string | undefined,
}

export interface PackageItem {
  pkg: NormalizedPackageJson;
}
export interface DependentsItem extends PackageItem, DependentsMeta {}
export interface EcosystemDependentsItem extends DependentsItem, EcosystemDependentsMeta {}

export interface DependentsOptions {
  maxPages?: number | undefined;
  logger?: BunyanLite | undefined;
}

export interface NpmDependentsOptions extends DependentsOptions {
  minDownloadsLastWeek?: number | undefined;
}

export interface EcosystemDependentsOptions extends DependentsOptions {
  minDownloadsLastMonth?: number | undefined;
}
