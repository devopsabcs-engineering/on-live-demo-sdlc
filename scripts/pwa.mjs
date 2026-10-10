import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { serviceWorkerRuntime } from "./service-worker.mjs";

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const bytes = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, bytes, checksum]);
}

export function createIcon(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const horizontal = column / size;
      const vertical = row / size;
      const mark =
        (horizontal >= 0.28 &&
          horizontal < 0.4 &&
          vertical >= 0.22 &&
          vertical < 0.78) ||
        (horizontal >= 0.4 &&
          horizontal < 0.68 &&
          ((vertical >= 0.22 && vertical < 0.34) ||
            (vertical >= 0.46 && vertical < 0.58))) ||
        (horizontal >= 0.6 &&
          horizontal < 0.72 &&
          vertical >= 0.3 &&
          vertical < 0.5);
      const offset = row * (size * 3 + 1) + 1 + column * 3;
      pixels.set(mark ? [237, 242, 239] : [36, 91, 66], offset);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function createShell(bundle, base) {
  if (!/^\/[a-zA-Z0-9/_-]+\/$/.test(base))
    throw new Error("Invalid Pinch base");
  const manifest = {
    id: base,
    name: "Pinch",
    short_name: "Pinch",
    start_url: base,
    scope: base,
    display: "standalone",
    background_color: "#edf2ef",
    theme_color: "#245b42",
    icons: [192, 512].map((size) => ({
      src: `${base}icons/pinch-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
  const files = new Map([
    ["manifest.webmanifest", JSON.stringify(manifest)],
    ...[192, 512].map((size) => [`icons/pinch-${size}.png`, createIcon(size)]),
  ]);
  for (const output of Object.values(bundle)) {
    files.set(
      output.fileName,
      output.type === "chunk" ? output.code : output.source,
    );
  }
  if (!files.has("index.html")) throw new Error("Missing emitted Pinch index");
  const names = [...files.keys()].sort();
  const hash = createHash("sha256")
    .update(base)
    .update(serviceWorkerRuntime.toString());
  for (const name of names) hash.update(name).update(files.get(name));
  const cachePrefix = `pinch-shell-${base.replaceAll("/", "_")}-`;
  const cacheName = `${cachePrefix}${hash.digest("hex").slice(0, 24)}`;
  const config = {
    base,
    cacheName,
    cachePrefix,
    assets: names.map((name) => `${base}${name}`),
  };
  files.set(
    "sw.js",
    `(${serviceWorkerRuntime.toString()})(${JSON.stringify(config)});\n`,
  );
  return { files, config };
}

export function pinchPwa() {
  let base;
  return {
    name: "pinch-offline-shell",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const { files } = createShell(bundle, base);
      for (const [fileName, source] of files) {
        if (!(fileName in bundle))
          this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}
