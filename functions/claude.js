/**
 * functions/claude.js — Cloudflare Pages Function (server-side AI proxy)
 * ----------------------------------------------------------------------------
 * The browser cannot call the Anthropic API directly (CORS + the API key must
 * never be exposed in frontend code). This function runs on Cloudflare's
 * servers: it receives the request from the app, attaches the secret API key,
 * forwards it to Anthropic, and returns the response.
 *
 * The key is read from either the per-request header (x-ll-key) or the
 * ANTHROPIC_API_KEY environment variable configured in the Cloudflare project.
 *
 * NOTE: the main app currently points callClaude() at a standalone Worker
 * (layerledger-ai...workers.dev). This Pages function is kept as a compatible
 * fallback. Both do the same job.
 * ----------------------------------------------------------------------------
 */
export async function onRequestPost(context) {
  const { request } = context
  try {
    const body = await request.json()
    const key = request.headers.get("x-ll-key") || context.env.ANTHROPIC_API_KEY
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })
    const data = await res.text()
    return new Response(data, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e.message } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
