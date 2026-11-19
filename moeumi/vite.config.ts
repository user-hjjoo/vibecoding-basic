import { defineConfig, loadEnv } from "vite";
import tailwind from "@tailwindcss/vite";
import handler from "./api/extract.ts";
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), "GEMINI_"));
  return {
    plugins: [
      tailwind(),
      {
        name: "local-extraction",
        configureServer(server) {
          server.middlewares.use("/api/extract", (req, res, next) => {
            handler(req, res).catch(next);
          });
        },
      },
    ],
  };
});
