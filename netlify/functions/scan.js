// netlify/functions/scan.js
//
// Scheduled entry point (cron config lives in netlify.toml). All real logic
// is in lib/runScan.js so the manual "Scan Now" button (scan-now.js) can
// reuse the exact same code path.

const { runScan } = require("../../lib/runScan");

exports.handler = async function () {
  const result = await runScan();
  return { statusCode: 200, body: JSON.stringify(result) };
};
