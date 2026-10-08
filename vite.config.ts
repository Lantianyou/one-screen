import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

export default defineConfig({
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    target: "es2022",
    lib: {
      entry: "src/main.tsx",
      formats: ["cjs"],
      fileName: () => "main.js",
      cssFileName: "styles",
    },
    rolldownOptions: { external: ["obsidian", "electron"], output: { codeSplitting: false } },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  fmt: {},
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  plugins: lazyPlugins(() => [
    react(),
    {
      name: "obsidian-manifest",
      closeBundle: () => copyFile(resolve("manifest.json"), resolve("dist/manifest.json")),
    },
  ]),
});
