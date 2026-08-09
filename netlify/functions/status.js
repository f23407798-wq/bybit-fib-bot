// netlify/functions/status.js
//
// Read-only endpoint the dashboard (public/index.html) polls. Never places
// trades or touches Bybit — just returns whatever scan.js last saved.
// Always returns a valid `state` object (with empty arrays), even if
// nothing has scanned yet or the store read fails, so the dashboard never
// crashes on "Cannot read properties of undefined".

const { readState, readLog } = require("../../lib/store");

exports.handler = async function () {
  let state, log;
  try {
    [state, log] = await Promise.all([readState(), readLog()]);
  } catch (e) {
    state = { updatedAt: null, testnet: true, autoTrade: false, interval: null, triggered: [], confirmed: [], watching: [], storeError: e.message };
    log = [{ time: new Date().toISOString(), level: "error", message: `status.js failed: ${e.message}` }];
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ state, log: (log || []).slice(0, 50) }),
  };
};
