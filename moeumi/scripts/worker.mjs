import { build } from "esbuild";
import { readdir, readFile, mkdir } from "node:fs/promises";
const assets = {};
for (const name of [
  "index.html",
  ...(await readdir("dist/assets")).map((n) => "assets/" + n),
]) {
  const type = name.endsWith("html")
    ? "text/html"
    : name.endsWith("js")
      ? "text/javascript"
      : "text/css";
  assets["/" + name] = [
    type + "; charset=utf-8",
    await readFile("dist/" + name, "utf8"),
  ];
}
await mkdir("dist/server", { recursive: true });
await build({
  stdin: {
    contents: `import {extract} from './server/extract.ts';import {splitForm} from './server/split-form.ts';const assets=${JSON.stringify(assets)};
export default {async fetch(req,env){const p=new URL(req.url).pathname;if(p==='/api/extract')return extract(req,env);if(p==='/api/split-form')return splitForm(req,env);
const file=assets[p]||(/^\\/(archive|planner|library)?\\/?$/.test(p)&&assets['/index.html']);
return file?new Response(file[1],{headers:{'Content-Type':file[0]}}):new Response('Not found',{status:404})}}`,
    resolveDir: process.cwd(),
  },
  outfile: "dist/server/index.js",
  bundle: true,
  platform: "browser",
  format: "esm",
  minify: true,
  target: "es2022",
});
