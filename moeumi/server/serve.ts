import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { Env } from "./request.ts";

export async function serve(req: IncomingMessage, res: ServerResponse, env: Env,
  endpoint: (req: Request, env: Env) => Promise<Response>) {
  const init = {
    method: req.method,
    body: req.method === "POST" ? Readable.toWeb(req) : undefined,
    duplex: "half",
  };
  const reply = await endpoint(
    new Request("http://localhost/api", init as RequestInit),
    env,
  );
  res.writeHead(reply.status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(await reply.text());
}
