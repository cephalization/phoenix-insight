import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  platform: "node",
  // Bundle the UI package code since it's not published
  noExternal: ["@cephalization/phoenix-insight-ui"],
});
