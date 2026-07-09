// Headless connection test: Vercel/Next front  ->  Shopify Storefront API backend.
// Proves we can (1) read live products, (2) build a cart, (3) get a real checkout URL.
//
// Run:  SHOPIFY_STOREFRONT_TOKEN=xxxx node scripts/shopify-storefront-test.mjs
// (token is NEVER committed — pass it via env only)

const STORE = process.env.SHOPIFY_STORE || "8yyp1g-0a.myshopify.com";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";
const TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;

if (!TOKEN) {
  console.error("✗ Missing SHOPIFY_STOREFRONT_TOKEN env var.");
  console.error("  Shopify admin → Apps → Develop apps → Catalog Loader → API credentials → Storefront API access token");
  process.exit(1);
}

const ENDPOINT = `https://${STORE}/api/${API_VERSION}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

async function main() {
  console.log(`→ Connecting to ${STORE} (Storefront API ${API_VERSION})…\n`);

  // 1. Read live products
  const data = await gql(`{
    products(first: 8, sortKey: BEST_SELLING) {
      edges { node {
        title
        handle
        availableForSale
        variants(first: 1) { edges { node { id price { amount currencyCode } } } }
      } }
    }
  }`);

  const products = data.products.edges.map((e) => e.node);
  console.log(`✓ Pulled ${products.length} live products from Shopify:`);
  for (const p of products) {
    const v = p.variants.edges[0]?.node;
    const price = v ? `${v.price.currencyCode} ${v.price.amount}` : "—";
    console.log(`   • ${p.title.padEnd(34)} ${price.padStart(12)}  ${p.availableForSale ? "in stock" : "SOLD OUT"}`);
  }

  // 2. Build a cart with the first purchasable variant
  const buyable = products.find((p) => p.availableForSale && p.variants.edges[0]);
  if (!buyable) {
    console.log("\n⚠ No purchasable variant found — connection works, but nothing is in stock to cart.");
    return;
  }
  const variantId = buyable.variants.edges[0].node.id;
  console.log(`\n→ Building a cart with: ${buyable.title}`);

  const cart = await gql(
    `mutation($lines: [CartLineInput!]!) {
       cartCreate(input: { lines: $lines }) {
         cart { id checkoutUrl cost { totalAmount { amount currencyCode } } }
         userErrors { message }
       }
     }`,
    { lines: [{ merchandiseId: variantId, quantity: 1 }] }
  );

  const errs = cart.cartCreate.userErrors;
  if (errs?.length) throw new Error(errs.map((e) => e.message).join("; "));

  const c = cart.cartCreate.cart;
  console.log(`✓ Cart created — total ${c.cost.totalAmount.currencyCode} ${c.cost.totalAmount.amount}`);
  console.log(`\n✓ CHECKOUT URL (this is Shopify handling payment/backend):`);
  console.log(`   ${c.checkoutUrl}\n`);
  console.log("✅ Headless connection WORKS: Vercel front can read products + hand off checkout to Shopify.");
}

main().catch((err) => {
  console.error("\n✗ Connection test FAILED:\n", err.message);
  process.exit(1);
});
