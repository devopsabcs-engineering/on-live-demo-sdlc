import type { Plugin } from "vite";

export type ShellBundle = Record<
  string,
  | { type: "asset"; fileName: string; source: string | Uint8Array }
  | { type: "chunk"; fileName: string; code: string }
>;

export interface ShellConfig {
  base: string;
  cacheName: string;
  cachePrefix: string;
  assets: string[];
}
export function createIcon(size: number): Buffer;
export function createShell(
  bundle: ShellBundle,
  base: string,
): {
  files: Map<string, string | Uint8Array>;
  config: ShellConfig;
};
export function pinchPwa(): Plugin;
