const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
let mode: "live" | "test" | "unknown" = "unknown";
if (key.startsWith("rzp_live_")) mode = "live";
else if (key.startsWith("rzp_test_")) mode = "test";
console.log("razorpay_mode=" + mode);
console.log("public_key_set=" + (key.length > 0));
console.log("secret_set=" + ((process.env.RAZORPAY_KEY_SECRET || "").length > 0));
process.exit(0);
