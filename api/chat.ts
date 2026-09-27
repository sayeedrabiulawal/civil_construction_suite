/**
 * Vercel Edge Function — POST /api/chat.
 *
 * A two-line shim on purpose: all behaviour lives in `server/chat.ts` so the
 * same code path runs in `npm run dev` through the Vite middleware, and this
 * file can be swapped for any other host without touching the logic.
 *
 * The Edge runtime is what makes token-by-token streaming work on Vercel: it
 * returns a Web `Response` whose body is a `ReadableStream`, which reaches the
 * browser as it is produced rather than after the function returns.
 */
import { handleChatRequest } from "../server/chat";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
    return handleChatRequest(request);
}
