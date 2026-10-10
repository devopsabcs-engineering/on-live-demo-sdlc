import type { OutputBundle } from "rollup";
import type { Plugin } from "vite";

export interface ShellConfig {
  base: string;
  cacheName: string;
  cachePrefix: string;
  assets: string[];
}
export function createIcon(size: number): Buffer;
export function createShell(
  bundle: OutputBundle,
  base: string,
): {
  files: Map<string, string | Uint8Array>;
  config: ShellConfig;
};
export function pinchPwa(): Plugin;
