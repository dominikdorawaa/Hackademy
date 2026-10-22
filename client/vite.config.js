import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cp, readFile, mkdir, writeFile } from "node:fs/promises";
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
      async closeBundle() {
        const source = new URL("./prototypes/runtime/", import.meta.url);
        const manifest = await readFile(new URL("manifest.json", source));
        const { version } = JSON.parse(manifest);
        await mkdir(new URL('./dist/prototypes/runtime/', import.meta.url), { recursive: true });
        await writeFile(new URL('./dist/prototypes/runtime/manifest.json', import.meta.url), manifest);
        await cp(
          fileURLToPath(source),
          fileURLToPath(new URL(`./dist/static/ukos/${version}/`, import.meta.url)),
          { recursive: true },
        );
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          try {
            const match = req.url?.match(/^\/static\/ukos\/([a-f0-9]{16})\/(.+)$/);
            if (match) {
              const manifest = JSON.parse(await readFile(new URL('./prototypes/runtime/manifest.json', import.meta.url), 'utf8'));
              if (match[1] === manifest.version) {
                req.url = `/prototypes/runtime/${match[2]}`;
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              }
            }
            next();
          } catch (error) {
            next(error);
          }
        });
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
