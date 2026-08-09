// lib/bybit.js
//
// Minimal Bybit V5 REST client: market data (public, no key needed) +
// order placement (private, signed with your API key/secret).
//
// Auth follows Bybit's official V5 scheme:
//   sign = HMAC_SHA256(secret, timestamp + apiKey + recvWindow + payload)
//   GET  payload = sorted query string
//   POST payload = raw JSON body string
// Sent as headers: X-BAPI-API-KEY, X-BAPI-TIMESTAMP, X-BAPI-SIGN,
// X-BAPI-RECV-WINDOW, X-BAPI-SIGN-TYPE: 2

const crypto = require("crypto");

const BYBIT_INTERVAL_MAP = { "1m": "1", "5m": "5", "15m": "15", "30m": "30", "1h": "60", "4h": "240", "1d": "D" };

function baseUrl(testnet) {
  return testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
}

function sign(secret, timestamp, apiKey, recvWindow, payload) {
  const raw = timestamp + apiKey + recvWindow + payload;
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

// Public CORS/relay proxies — used ONLY as a fallback for public market-data
// GET requests (no API key/secret ever passes through these). Netlify's free
// plan runs functions from a US region, which Bybit's CloudFront geo-blocks
// (Bybit doesn't serve the US). These proxies fetch from their own,
// non-blocked infrastructure and relay the plain JSON back.
const PUBLIC_PROXIES = [
  u => u, // try direct first — no proxy hop if it's not actually blocked
  u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  u => "https://corsproxy.io/?url=" + encodeURIComponent(u),
];

class BybitClient {
  constructor({ apiKey, apiSecret, testnet = true, recvWindow = 5000 } = {}) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.testnet = testnet;
    this.recvWindow = String(recvWindow);
  }

  async _fetchJSON(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Not JSON — likely an HTML error/block page from Bybit or a proxy.
      // Show a snippet so we can see exactly what came back instead of guessing.
      const snippet = text.slice(0, 200).replace(/\s+/g, " ");
      const err = new Error(`Non-JSON response (HTTP ${res.status}) from ${url}: "${snippet}"`);
      err.httpStatus = res.status;
      throw err;
    }
    return data;
  }

  // Only for public, unauthenticated GETs — falls back through PUBLIC_PROXIES
  // if the direct request is geo-blocked (HTTP 403) or returns non-JSON.
  async _fetchJSONWithProxyFallback(url) {
    let lastErr;
    for (const wrap of PUBLIC_PROXIES) {
      try {
        return await this._fetchJSON(wrap(url));
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`All fetch routes (direct + proxies) failed for ${url}: ${lastErr ? lastErr.message : "unknown"}`);
  }

  async _publicGet(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = baseUrl(this.testnet) + path + (qs ? "?" + qs : "");
    const data = await this._fetchJSONWithProxyFallback(url);
    if (data.retCode !== 0) throw new Error(`Bybit ${path} error ${data.retCode}: ${data.retMsg}`);
    return data.result;
  }

  async _privateGet(path, params = {}) {
    if (!this.apiKey || !this.apiSecret) throw new Error("Bybit API key/secret not configured");
    const timestamp = String(Date.now());
    const qs = new URLSearchParams(params).toString();
    const signature = sign(this.apiSecret, timestamp, this.apiKey, this.recvWindow, qs);
    const url = baseUrl(this.testnet) + path + (qs ? "?" + qs : "");
    const data = await this._fetchJSON(url, {
      headers: {
        "X-BAPI-API-KEY": this.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": signature,
        "X-BAPI-RECV-WINDOW": this.recvWindow,
        "X-BAPI-SIGN-TYPE": "2",
      },
    });
    if (data.retCode !== 0) throw new Error(`Bybit ${path} error ${data.retCode}: ${data.retMsg}`);
    return data.result;
  }

  async _privatePost(path, body = {}) {
    if (!this.apiKey || !this.apiSecret) throw new Error("Bybit API key/secret not configured");
    const timestamp = String(Date.now());
    const payload = JSON.stringify(body);
    const signature = sign(this.apiSecret, timestamp, this.apiKey, this.recvWindow, payload);
    const url = baseUrl(this.testnet) + path;
    const data = await this._fetchJSON(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": this.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": signature,
        "X-BAPI-RECV-WINDOW": this.recvWindow,
        "X-BAPI-SIGN-TYPE": "2",
      },
      body: payload,
    });
    if (data.retCode !== 0) throw new Error(`Bybit ${path} error ${data.retCode}: ${data.retMsg}`);
    return data.result;
  }

  // ---- public market data ----

  async getTopSymbols(n) {
    const result = await this._publicGet("/v5/market/tickers", { category: "linear" });
    const list = (result.list || []).filter(d => d.symbol.endsWith("USDT"));
    list.sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));
    return list.slice(0, n).map(d => ({ symbol: d.symbol, lastPrice: d.lastPrice, quoteVolume: d.turnover24h }));
  }

  async getKlines(symbol, interval, limit = 500) {
    const bybitInterval = BYBIT_INTERVAL_MAP[interval] || interval;
    const result = await this._publicGet("/v5/market/kline", { category: "linear", symbol, interval: bybitInterval, limit });
    const list = result.list || [];
    return list.slice().reverse().map(k => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
  }

  // Qty step / min order qty / price tick, needed to round order size legally.
  async getInstrumentInfo(symbol) {
    const result = await this._publicGet("/v5/market/instruments-info", { category: "linear", symbol });
    const info = (result.list || [])[0];
    if (!info) throw new Error(`No instrument info for ${symbol}`);
    return {
      qtyStep: parseFloat(info.lotSizeFilter.qtyStep),
      minOrderQty: parseFloat(info.lotSizeFilter.minOrderQty),
      tickSize: parseFloat(info.priceFilter.tickSize),
    };
  }

  // ---- private: account + orders ----
  // ⚠️ These are NOT proxied — an API key/secret should never be sent
  // through a third-party proxy. If Bybit's geo-block also rejects these
  // (once AUTO_TRADE is turned on), that's a separate problem from the
  // market-data block above and needs a trusted relay (e.g. your own small
  // VPS in a non-blocked region) — ask for help with that if it comes up.

  async getWalletBalance(accountType = "UNIFIED", coin = "USDT") {
    const result = await this._privateGet("/v5/account/wallet-balance", { accountType, coin });
    const acct = (result.list || [])[0];
    const c = acct && (acct.coin || []).find(x => x.coin === coin);
    return c ? parseFloat(c.walletBalance) : 0;
  }

  async setLeverage(symbol, leverage) {
    try {
      await this._privatePost("/v5/position/set-leverage", {
        category: "linear", symbol,
        buyLeverage: String(leverage), sellLeverage: String(leverage),
      });
    } catch (e) {
      // "leverage not modified" is not a real error — ignore it
      if (!/not modified/i.test(e.message)) throw e;
    }
  }

  // Market SELL (short) with TP/SL attached directly to the order.
  async placeShortMarketOrder({ symbol, qty, takeProfit, stopLoss }) {
    return this._privatePost("/v5/order/create", {
      category: "linear",
      symbol,
      side: "Sell",
      orderType: "Market",
      qty: String(qty),
      timeInForce: "IOC",
      reduceOnly: false,
      takeProfit: takeProfit != null ? String(takeProfit) : undefined,
      stopLoss: stopLoss != null ? String(stopLoss) : undefined,
      tpTriggerBy: "LastPrice",
      slTriggerBy: "LastPrice",
    });
  }

  async getOpenPositions(symbol) {
    const result = await this._privateGet("/v5/position/list", { category: "linear", symbol });
    return result.list || [];
  }
}

function roundToStep(value, step) {
  const precision = Math.max(0, Math.round(-Math.log10(step)));
  return parseFloat((Math.floor(value / step) * step).toFixed(precision));
}

module.exports = { BybitClient, roundToStep };
