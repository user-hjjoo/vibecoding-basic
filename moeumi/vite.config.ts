import { defineConfig, loadEnv } from "vite";
import tailwind from "@tailwindcss/vite";
import { handleExtract } from "./api/extract.ts";
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      tailwind(),
      {
        name: "local-extraction",
        configureServer(server) {
          server.middlewares.use("/api/extract", (req, res, next) => {
            const env = loadEnv(mode, server.config.envDir, "GEMINI_");
            handleExtract(req, res, {
              GEMINI_API_KEY: env.GEMINI_API_KEY,
              GEMINI_MODEL: env.GEMINI_MODEL,
            }).catch(next);
          });
        },
      },
    ],
  };
});
