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
    
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) {
           const errorText = await res.text();
           if (res.status >= 500 || res.status === 429) {
             throw new Error(`Anthropic API error (${res.status}): ${errorText}`);
           } else {
             // Client error, don't retry
             return new Response(errorText, {
               status: res.status,
               headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
             });
           }
        }

        const data = await res.text();
        return new Response(data, {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 1500));
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);

  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e.message } }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  }
}
