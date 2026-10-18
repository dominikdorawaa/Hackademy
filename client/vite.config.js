import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cp, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export default defineConfig({
  define: {
    global: "globalThis",
  },
  worker: { format: "es" },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "ukos-course-runtime",
      apply: "build",
      async closeBundle() {
        const source = new URL("./prototypes/runtime/", import.meta.url);
        await readFile(new URL("manifest.json", source));
        await cp(
          fileURLToPath(source),
          fileURLToPath(new URL("./dist/prototypes/runtime/", import.meta.url)),
          { recursive: true },
        );
      },
    },
  ],
  build: {
    assetsDir: "static",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
