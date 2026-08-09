// lib/store.js
//
// Small persistence helper on top of Netlify Blobs (free, built into every
// Netlify site — no extra database to set up). Netlify functions are
// stateless between runs, so this is how scan.js remembers "did I already
// place a trade for this signal" and how status.js has something to serve
// the dashboard.

const { getStore } = require("@netlify/blobs");

const STATE_KEY = "state.json";
const LOG_KEY = "log.json";
const MAX_LOG_ENTRIES = 200;

function store() {
  // Auto-config (no siteID/token needed) fails on some Netlify sites — a
  // known platform issue. If BLOBS_SITE_ID / BLOBS_TOKEN are set (see
  // README), fall back to explicit manual config; otherwise try auto.
  // .trim() guards against a stray space/newline from copy-pasting the
  // value on mobile, which Netlify's Blobs API rejects with a 400.
  const siteID = (process.env.BLOBS_SITE_ID || "").trim();
  const token = (process.env.BLOBS_TOKEN || "").trim();
  if (siteID && token) {
    return getStore({ name: "fib-scanner", siteID, token });
  }
  return getStore("fib-scanner");
}

function defaultState() {
  return { updatedAt: null, testnet: true, autoTrade: false, interval: null, triggered: [], confirmed: [], watching: [], tradedSignalIds: [] };
}

async function readState() {
  try {
    const raw = await store().get(STATE_KEY, { type: "json" });
    return raw || defaultState();
  } catch (e) {
    return { ...defaultState(), storeError: e.message };
  }
}

async function writeState(state) {
  await store().setJSON(STATE_KEY, state);
}

async function readLog() {
  try {
    const raw = await store().get(LOG_KEY, { type: "json" });
    return raw || [];
  } catch (e) {
    return [{ time: new Date().toISOString(), level: "error", message: `Store read failed: ${e.message}` }];
  }
}

async function appendLog(entry) {
  const log = await readLog();
  log.unshift({ time: new Date().toISOString(), ...entry });
  await store().setJSON(LOG_KEY, log.slice(0, MAX_LOG_ENTRIES));
}

module.exports = { readState, writeState, readLog, appendLog };
