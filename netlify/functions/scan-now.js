// netlify/functions/scan-now.js
//
// HTTP-triggered version of the same scan, for the dashboard's "Scan Now"
// button. Protected by MANUAL_SCAN_TOKEN so a random visitor to your site
// can't spam-trigger scans (and, if AUTO_TRADE is on, real orders).
// Set MANUAL_SCAN_TOKEN in Netlify env vars, and enter the same value in
// the dashboard's "Admin token" field.

const { runScan } = require("../../lib/runScan");

exports.handler = async function (event) {
  const expected = process.env.MANUAL_SCAN_TOKEN;
  const given = event.headers["x-scan-token"];
  if (expected && given !== expected) {
    return { statusCode: 401, body: JSON.stringify({ error: "invalid token" }) };
  }
  const result = await runScan();
  return { statusCode: 200, body: JSON.stringify(result) };
};
