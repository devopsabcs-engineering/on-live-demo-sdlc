import { defineConfig } from "vitest/config";
import { pinchPwa } from "./scripts/pwa.mjs";

export default defineConfig({
  base: "/ai-sdlc-labs-pinch/",
  plugins: [pinchPwa()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
