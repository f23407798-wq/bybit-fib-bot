// netlify/functions/status.js
//
// Read-only endpoint the dashboard (public/index.html) polls. Never places
// trades or touches Bybit — just returns whatever scan.js last saved.

const { readState, readLog } = require("../../lib/store");

exports.handler = async function () {
  const [state, log] = await Promise.all([readState(), readLog()]);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ state, log: log.slice(0, 50) }),
  };
};
