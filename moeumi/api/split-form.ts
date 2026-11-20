import type { IncomingMessage, ServerResponse } from "node:http";
import { serve } from "../server/serve.ts";
import { splitForm } from "../server/split-form.ts";
export const config = { api: { bodyParser: false }, maxDuration: 60 };
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return serve(req, res, { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL }, splitForm);
}
