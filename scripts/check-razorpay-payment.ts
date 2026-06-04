import { razorpay } from "../src/lib/razorpay";

const ORDER_ID = process.argv[2] || "order_Sx7jTnkHQfQqKA";
const PAYMENT_ID = process.argv[3] || "pay_Sx7jbuMCyopUFg";

async function main() {
  console.log("=== RAZORPAY ORDER ===");
  try {
    const order = await razorpay.orders.fetch(ORDER_ID);
    console.log(JSON.stringify(order, null, 2));
  } catch (err) {
    console.log("orders.fetch error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== RAZORPAY PAYMENT ===");
  try {
    const payment = await razorpay.payments.fetch(PAYMENT_ID);
    console.log(JSON.stringify(payment, null, 2));
  } catch (err) {
    console.log("payments.fetch error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== ALL PAYMENTS FOR THIS ORDER ===");
  try {
    const list = await razorpay.orders.fetchPayments(ORDER_ID);
    console.log(JSON.stringify(list, null, 2));
  } catch (err) {
    console.log("fetchPayments error:", err instanceof Error ? err.message : err);
  }

  process.exit(0);
}
main();
