import { defineConfig, loadEnv } from "vite";
import tailwind from "@tailwindcss/vite";
import { serve } from "./server/serve.ts";
import { extract } from "./server/extract.ts";
import { splitForm } from "./server/split-form.ts";
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      tailwind(),
      {
        name: "local-extraction",
        configureServer(server) {
          for (const [path, endpoint] of Object.entries({ "/api/extract": extract, "/api/split-form": splitForm })) {
            server.middlewares.use(path, (req, res, next) => {
              const env = loadEnv(mode, server.config.envDir, "GEMINI_");
              serve(req, res, env, endpoint).catch(next);
            });
          }
        },
      },
    ],
  };
});
