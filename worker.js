// cloudflare-worker/worker.js
//
// Cloudflare Worker: proxies Bybit's PUBLIC market-data endpoints only.
// Cloudflare's edge network isn't geo-blocked by Bybit the way Netlify's
// free-tier (US region) functions are, so this Worker fetches from Bybit
// on the server's behalf and relays the plain JSON back — no API key or
// secret ever passes through this file, it only forwards public GETs.
//
// Deploy: paste this whole file into a new Worker in the Cloudflare
// dashboard (Workers & Pages → Create → Edit code), Deploy, then copy the
// workers.dev URL it gives you into Netlify's BYBIT_PROXY_URL env var.

const BYBIT_BASE = "https://api.bybit.com";

// Safety allowlist — only Bybit's public market-data paths are proxied.
// Private/signed endpoints (orders, wallet, positions) are never touched
// here and must keep going directly from Netlify with your API key/secret.
const ALLOWED_PREFIX = "/v5/market/";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return json(
        { retCode: -1, retMsg: `Blocked: only ${ALLOWED_PREFIX}* is proxied by this worker` },
        403
      );
    }

    const target = BYBIT_BASE + url.pathname + url.search;

    try {
      const res = await fetch(target, {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 0, cacheEverything: false },
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    } catch (e) {
      return json({ retCode: -1, retMsg: "Worker fetch to Bybit failed: " + e.message }, 502);
    }
  },
};
