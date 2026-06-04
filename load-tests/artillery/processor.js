// ==========================================================================
// Artillery processor -- per-virtual-user variable setup, mirroring the data
// generation in k6/lib/shared.js. Reads the same .env vars.
// ==========================================================================
"use strict";

const PRODUCT_SLUGS = [
  "pocket-bmw",
  "pocket-porsche",
  "pocket-thar",
  "pocket-monster",
  "pocket-f1-classic",
];
const COUPON_CODES = ["WELCOME10", "FLAT100", "FREESHIP", "INVALIDXYZ"];

function env(name, dflt) {
  const v = process.env[name];
  return v === undefined || v === "" ? dflt : v;
}

const SERVICEABLE_PINCODES = env("SERVICEABLE_PINCODES", "560001,400001,110001,600001,500001")
  .split(",")
  .map((s) => s.trim());
const ENABLE_WRITES = env("ENABLE_WRITES", "false").toLowerCase() === "true";
const PREPAID_RATIO = parseFloat(env("PREPAID_RATIO", "0.2"));
const TEST_SKU = env("TEST_SKU", "qa-1rs");

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(n) {
  let s = "";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Called at the start of every scenario via `- function: "initVars"`.
function initVars(context, events, done) {
  const v = context.vars;
  v.slug = pick(PRODUCT_SLUGS);
  v.pincode = pick(SERVICEABLE_PINCODES);
  v.coupon = pick(COUPON_CODES);

  v.enableWrites = ENABLE_WRITES;
  v.testSku = TEST_SKU;

  const prepaid = Math.random() < PREPAID_RATIO;
  v.paymentMethod = prepaid ? "UPI" : "COD";

  v.idempotencyKey = `art-${Date.now()}-${rand(20)}`;
  v.fullName = `Artillery ${rand(5)}`;
  v.phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`.slice(0, 10);
  v.email = `art+${rand(8)}@example.com`;

  v.adminEmail = env("ADMIN_EMAIL", "loadtest@example.com");
  v.adminPassword = env("ADMIN_PASSWORD", "wrong-password-on-purpose");

  return done();
}

module.exports = { initVars };