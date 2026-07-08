# PRC Cars — EMI Strategy & Razorpay Conditions Report

**Date:** 6 July 2026
**Prepared for:** PRC Cars (bch-rc) store
**Scope:** How we use EMI, why EMI has a minimum amount, why Axio rejected us, and the full set of Razorpay EMI conditions (researched from Razorpay's official docs).

---

## 1. Executive summary

- **EMI is live on the store today** via Razorpay — but only on higher-ticket orders (roughly **₹2,500+**), because EMI has a bank-set **minimum transaction amount**.
- Our catalog is mostly **₹500–₹2,899**, so EMI realistically applies to the **1:16 cars, 1:20 cars, construction rigs, and any 2+ bundle** — not single cheap 1:64 cars.
- The **"₹200/month" hook** on cheap products is **not possible on Razorpay** — that needs a small-ticket lender (**Snapmint**), which is also available *through* Razorpay's Cardless EMI partner list (see §6).
- **Axio rejected us** for a **business-category reason** ("this instrument is not allowed for your business") — an underwriting decision on axio's side, not a mistake we can fix in settings.

---

## 2. How we are using the EMI option

We wired EMI into the store in three places (all live in code):

| Layer | What it does |
|---|---|
| **Product cards + PDP badge** | Shows *"No-Cost EMI from ₹X/mo"* on any product at/above the EMI floor (₹2,500). Hidden on cheaper products so we never promise EMI a checkout can't fulfil. |
| **Checkout payment option** | A dedicated **"Pay in EMI"** choice in the "How would you like to pay?" list (like Amazon/Flipkart), shown only when the cart clears the floor. |
| **Payment routing** | Selecting EMI creates a **prepaid Razorpay order** and opens the **unrestricted Razorpay window**, where the customer picks their **bank + tenure**. Razorpay pays us the full amount upfront; the bank/lender carries the installments. |

**Config knobs** (single source of truth in `src/lib/config.ts`):
- `EMI.minInr` = **₹2,500** — hide EMI below this.
- `EMI.tenureMonths` = **6** — the tenure we quote the "from ₹X/mo" figure against.

**Why this design:** EMI is a *card/prepaid* payment, so we route it as a prepaid order (no ₹100 COD gap, full amount financed). The Razorpay modal already exposes every enabled method, so we don't build the bank/tenure picker ourselves — Razorpay does.

---

## 3. Why EMI needs a minimum amount

EMI splits one purchase into monthly installments that a **bank or lender funds upfront** and then collects over months. That carries **fixed costs per loan**, regardless of ticket size:

- Underwriting / credit check (bureau pull, KYC)
- Loan setup, servicing, and collection over 3–12 months
- Interest-subvention accounting (for No-Cost EMI)
- Fraud + default risk

On a **₹500 order**, those fixed costs are larger than the interest the lender could ever earn — the loan **loses money**. So banks and lenders set a **floor** below which EMI simply isn't offered:

| Rail | Typical minimum |
|---|---|
| **Credit / Debit Card EMI** (bank-set) | **~₹3,000** (varies by bank; some higher) |
| **Cardless EMI — axio** | **₹900** (max ₹40,000) |
| **Cardless EMI — other partners** | Each partner sets its own floor |

This is exactly why our **₹500–₹1,099 1:64 cars can't show EMI**, but the **1:16 (₹2,899), 1:20 (₹1,699–1,799), construction (₹2,099), and bundles** can.

---

## 4. Full Razorpay EMI conditions (from Razorpay docs)

### 4.1 Credit Card EMI
- **Minimum amount:** varies by bank (industry standard ~₹3,000+).
- **Maximum:** the customer's **card credit limit**.
- **Down-payment:** none — the full amount is authorized, then **converted to EMI within 3–4 days** by the issuing bank.
- **Tenures:** vary by bank — commonly **3 / 6 / 9 / 12 (and up to 24) months**.
- **Interest:** charged by the issuing bank per tenure (unless No-Cost EMI, see §4.4).

### 4.2 Debit Card EMI
- **Minimum amount:** varies by bank.
- **No down-payment**, and **no minimum balance** needed at order time — but the account must have funds for each monthly EMI.
- Available only on **select banks'** debit cards.

### 4.3 Cardless EMI
- Lets customers pay in installments **without a credit/debit card** — they sign up at checkout with **PAN + DOB + Aadhaar** for KYC.
- **Per-provider minimum order amount**, e.g. **axio: min ₹900, max ₹40,000**.
- **Eligibility is decided by each provider** using repayment history, digital footprint, and bureau score — **>40% of axio sign-ups** get approved.
- Razorpay's Cardless EMI partner list includes **axio, ShopSe, and Snapmint** (plus bank/NBFC partners like Early Salary, Instacred). ← *Snapmint is reachable through Razorpay too.*

### 4.4 No-Cost EMI (important cost note)
- **"No cost" means the merchant absorbs the interest** as an **upfront discount (subvention)**. If the bank's interest is ₹100, we apply a ₹100 discount so the customer's effective interest is ₹0.
- **We receive the full order amount upfront** (minus the interest we subvented); the bank/lender converts it to EMI for the customer.
- **The discount % varies by bank and tenure** — longer tenures cost us more.
- **The customer still pays GST on the interest** to the bank (shows on their statement), even though the interest itself is ₹0.
- **Action needed:** No-Cost EMI must be **switched on and configured as offers in the Razorpay dashboard**. Until we do that, our on-site "**No-Cost EMI**" wording is **not yet accurate** — it should read plain "**EMI**" until the offers are live. *(Open decision — see §7.)*

### 4.5 General restrictions
- **Instant Refunds are NOT supported** on EMI, Cardless EMI, or Pay Later.
- EMI eligibility per method depends on the **issuing bank / provider**, not on us.

---

## 5. Our current Razorpay EMI status

From the Razorpay dashboard (as checked this session):

| Method | Provider | Status |
|---|---|---|
| **Card EMI** | Amex | ✅ Activated |
| **Card EMI** | Other banks (Axis, ICICI, IDFC, Kotak…) | ✅ Activated |
| **Card EMI** | SBI CC EMI | ⬜ Available to request |
| **Cardless EMI** | Early Salary | ✅ Activated |
| **Cardless EMI** | Instacred (ICICI, Kotak, HDFC, Federal…) | ⏳ Requested — live ~**18 Jul 2026** |
| **Cardless EMI** | **axio** | ❌ **Rejected** (business category) |
| **Cardless EMI** | ZestMoney | ⛔ Onboarding paused (provider defunct) |
| **Pay Later** | Flexipay | ⛔ Onboarding paused |
| **Pay Later** | Simpl | ⛔ Onboarding paused |

**Net:** Card EMI + Early Salary are **live now** for orders above the bank floor; Instacred widens coverage mid-July. Small-ticket BNPL / Pay Later is **currently closed** on Razorpay for everyone.

---

## 6. Why Axio rejected us

The dashboard message was: **"This instrument is not allowed for your business."**

- This is a **merchant-side eligibility (underwriting) decision by axio**, *not* a settings error and *not* something we can toggle on.
- Cardless EMI providers approve merchants by **business category / risk profile**. axio (ex-Capital Float) focuses on specific consumer-finance verticals and **excludes categories it considers higher-risk or out-of-policy** — small-ticket **toys / hobby / RC** typically falls outside their approved MCC list (higher return/RTO risk, low average ticket).
- **Nothing to fix on our end.** Options: (a) ignore axio and use the other cardless partners, (b) raise a ticket with Razorpay/axio to ask for a category review, or (c) rely on **Snapmint** for the small-ticket segment.

---

## 7. Recommendations & open decisions

1. **Keep EMI live for high-ticket now** — Card EMI + Early Salary already cover 1:16 / 1:20 / construction / bundles. No action needed.
2. **Fix the "No-Cost" wording** — either **enable No-Cost EMI offers** in the Razorpay dashboard (and accept the ~10–16% subvention cost on those orders), **or** change the label from "No-Cost EMI" to plain "**EMI**" so we don't over-promise. *(Needs your call.)*
3. **Small-ticket "₹200/month" hook** — not possible on Card/Cardless EMI floors. Pursue **Snapmint** (either your direct enquiry, or via **Razorpay's Cardless EMI partner list**, which now includes Snapmint).
4. **Ignore axio** — rejection is final on their side; the other rails cover us.
5. **Re-check Pay Later later** — Flexipay/Simpl are paused for all merchants; revisit when Razorpay reopens onboarding.

---

## 8. Sources (Razorpay official docs)

- [About EMI | Razorpay Docs](https://razorpay.com/docs/payments/payment-methods/emi/)
- [Payment Methods | EMI — FAQs | Razorpay Docs](https://razorpay.com/docs/payments/payment-methods/emi/faqs/)
- [About Credit Card EMI | Razorpay Docs](https://razorpay.com/docs/payments/payment-methods/emi/credit-card-emi/)
- [Debit Card EMI | Razorpay Docs](https://razorpay.com/docs/payments/payment-methods/emi/debit-card-emi/)
- [Cardless EMI at Razorpay Standard Checkout | Razorpay Docs](https://razorpay.com/docs/payments/payment-methods/emi/cardless-emi/)
- [About axio Cardless EMI | Razorpay Docs](https://razorpay.com/docs/payments/payment-methods/emi/cardless-emi/axio/)
- [About No Cost EMI | Razorpay Docs](https://razorpay.com/docs/payments/payment-methods/emi/no-cost-emi/)
- [No Cost EMI — FAQs | Razorpay Docs](https://razorpay.com/docs/payments/offers/no-cost-emi/faqs/)
- [Razorpay Affordability Suite](https://razorpay.com/affordability-suite/)
