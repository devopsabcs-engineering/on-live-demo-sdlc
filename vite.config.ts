import { defineConfig } from "vitest/config";
import { pinchPwa } from "./scripts/pwa.mjs";

export default defineConfig({
  base: "/on-live-demo-sdlc/",
  plugins: [pinchPwa()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
