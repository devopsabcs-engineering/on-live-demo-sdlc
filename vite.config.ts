import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/ai-sdlc-labs-pinch/",
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
