import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { extract } from "../server/extract.ts";
export const config = { api: { bodyParser: false }, maxDuration: 60 };
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  return handleExtract(req, res, {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
}

export async function handleExtract(
  req: IncomingMessage,
  res: ServerResponse,
  env: Parameters<typeof extract>[1],
) {
  const init = {
    method: req.method,
    body: req.method === "POST" ? Readable.toWeb(req) : undefined,
    duplex: "half",
  };
  const reply = await extract(
    new Request("http://localhost/api/extract", init as RequestInit),
    env,
  );
  res.writeHead(reply.status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(await reply.text());
}
