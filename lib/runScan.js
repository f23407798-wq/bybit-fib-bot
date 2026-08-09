// netlify/functions/scan.js
//
// Runs on a schedule (see netlify.toml). Each run:
//   1. pulls the top N USDT perp symbols by turnover
//   2. runs the strategy (strategy/strategy.js) on each
//   3. for any NEW "TRIGGERED" signal, if AUTO_TRADE=true, places a real
//      short market order on Bybit with TP/SL attached
//   4. saves everything to Netlify Blobs so the dashboard (status.js) and
//      the next run can read it
//
// This file should rarely need edits — strategy changes go in
// strategy/strategy.js, trade-plan/sizing changes go there too.

const { BybitClient, roundToStep } = require("./bybit");
const { analyzeSymbol, buildTradePlan } = require("../strategy/strategy");
const { readState, writeState, appendLog } = require("./store");

const TESTNET = (process.env.BYBIT_TESTNET || "true").toLowerCase() !== "false";
const AUTO_TRADE = (process.env.AUTO_TRADE || "false").toLowerCase() === "true";
const INTERVAL = process.env.SCAN_INTERVAL || "15m";
const TOP_N = parseInt(process.env.TOP_N || "30", 10);
const CONCURRENCY = parseInt(process.env.SCAN_CONCURRENCY || "5", 10);
const POSITION_SIZE_USDT = parseFloat(process.env.POSITION_SIZE_USDT || "20");
const LEVERAGE = parseInt(process.env.LEVERAGE || "3", 10);
const MAX_OPEN_TRADES_PER_RUN = parseInt(process.env.MAX_NEW_TRADES_PER_RUN || "3", 10);

const client = new BybitClient({
  apiKey: process.env.BYBIT_API_KEY,
  apiSecret: process.env.BYBIT_API_SECRET,
  testnet: TESTNET,
});

async function runPool(items, worker, concurrency) {
  let idx = 0;
  const results = new Array(items.length);
  async function next() {
    while (idx < items.length) {
      const my = idx++;
      try { results[my] = await worker(items[my]); } catch (e) { results[my] = { error: e.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

function signalId(symbol, sig) {
  // Same T1/T2/entry combo should never be traded twice.
  return `${symbol}:${sig.t1Idx}:${sig.t2Idx}:${sig.entryIdx}`;
}

async function placeTrade(symbol, sig) {
  const plan = buildTradePlan(sig);
  if (!plan) return { skipped: "invalid trade geometry" };

  const info = await client.getInstrumentInfo(symbol);
  const rawQty = POSITION_SIZE_USDT / plan.entry;
  const qty = roundToStep(rawQty, info.qtyStep);
  if (qty < info.minOrderQty) return { skipped: `qty ${qty} below min ${info.minOrderQty}` };

  await client.setLeverage(symbol, LEVERAGE);
  const tp = roundToStep(plan.tp, info.tickSize);
  const sl = roundToStep(plan.sl, info.tickSize);
  const order = await client.placeShortMarketOrder({ symbol, qty, takeProfit: tp, stopLoss: sl });
  return { placed: true, qty, tp, sl, orderId: order.orderId };
}

async function runScan() {
  const state = await readState();
  const tradedSet = new Set(state.tradedSignalIds || []);

  let symbols;
  try {
    symbols = await client.getTopSymbols(TOP_N);
  } catch (e) {
    await appendLog({ level: "error", message: `Symbol fetch failed: ${e.message}` });
    return { scanned: 0, triggeredCount: 0, newTrades: 0, error: e.message };
  }

  const perSymbol = await runPool(symbols, async (s) => {
    try {
      const candles = await client.getKlines(s.symbol, INTERVAL, 300);
      if (candles.length < 60) return { symbol: s.symbol, signals: [] };
      const signals = analyzeSymbol(candles).map(sig => ({ symbol: s.symbol, price: parseFloat(s.lastPrice), ...sig }));
      return { symbol: s.symbol, signals };
    } catch (e) {
      return { symbol: s.symbol, signals: [], error: e.message };
    }
  }, CONCURRENCY);

  const triggered = [], confirmed = [], watching = [];
  for (const r of perSymbol) {
    if (!r || !r.signals) continue;
    for (const sig of r.signals) {
      if (sig.status === "TRIGGERED") triggered.push(sig);
      else if (sig.status === "CONFIRMED") confirmed.push(sig);
      else if (sig.status === "ARMED") watching.push(sig);
    }
  }

  let newTrades = 0;
  for (const sig of triggered) {
    const id = signalId(sig.symbol, sig);
    if (tradedSet.has(id)) continue;
    tradedSet.add(id); // mark as seen even if AUTO_TRADE is off, so we don't re-log every run

    if (!AUTO_TRADE) {
      await appendLog({ level: "info", message: `[DRY RUN] ${sig.symbol} SELL signal — entry ${sig.entryPrice}`, symbol: sig.symbol });
      continue;
    }
    if (newTrades >= MAX_OPEN_TRADES_PER_RUN) {
      await appendLog({ level: "warn", message: `${sig.symbol} signal skipped — MAX_NEW_TRADES_PER_RUN reached`, symbol: sig.symbol });
      continue;
    }
    try {
      const result = await placeTrade(sig.symbol, sig);
      newTrades++;
      await appendLog({
        level: result.placed ? "trade" : "warn",
        message: result.placed
          ? `${sig.symbol} SHORT placed — qty ${result.qty}, TP ${result.tp}, SL ${result.sl}`
          : `${sig.symbol} trade skipped — ${result.skipped}`,
        symbol: sig.symbol,
      });
    } catch (e) {
      await appendLog({ level: "error", message: `${sig.symbol} order failed: ${e.message}`, symbol: sig.symbol });
    }
  }

  await writeState({
    updatedAt: new Date().toISOString(),
    interval: INTERVAL,
    testnet: TESTNET,
    autoTrade: AUTO_TRADE,
    triggered, confirmed, watching,
    tradedSignalIds: Array.from(tradedSet).slice(-500),
  });

  return { scanned: symbols.length, triggeredCount: triggered.length, newTrades };
}

module.exports = { runScan };
