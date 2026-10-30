# Payment flow audit — 2026-10-30

## Executive result

**Subscription payments are not ready for production activation.** The repository and live Supabase project do not currently show a complete provider-to-database verification path for ShamCash (or another provider). The monthly subscription UI is intentionally disabled in the deployed application, but the database RPC remains callable by authenticated sessions unless separately gated.

This is an evidence-based audit. No production database, Auth setting, payment record, subscription, or provider configuration was changed.

## Evidence reviewed

### 1. Frontend launch gate

- `index.html` sets `window.MADKHAL_MONTHLY_SUBSCRIPTION_ENABLED = false`.
- `showScreen()`, `openSubscription()`, and `updateSubscriptionFeatureVisibility()` use this flag to keep the subscription screen/payment panel unavailable.
- The legacy inline `startSubscriptionRequest()` writes a subscription row with status `requested`; it does not verify payment and does not set status to `active`.
- `subscription-runtime.js` also writes a `requested` subscription through an upsert. This is a request state, not evidence of payment.

### 2. Payment UI scripts

- `madkhal-payment-flow-v2.js` calls `create_subscription_payment_intent`, then polls `payment_intents` for `status='paid'` and `verified_at`. It does not contact a provider or verify a provider callback itself.
- The main `index.html` script list does not load `madkhal-payment-flow-v2.js`.
- `payment-flexible-layer.js` stores a user-entered reference in local storage and calls the legacy subscription-request path. It contains no provider API request, cryptographic verification, or trusted server-side reconciliation.
- Neither of those payment scripts is included by the current `index.html` script list.

### 3. Live database RPC

The live `public.create_subscription_payment_intent()` function:
- requires a non-null `auth.uid()`;
- inserts a fixed $1.00 USD pending intent for purpose `subscription`, provider `shamcash`;
- sets a 30-minute expiry;
- returns the created intent.

The function does not check a subscription-payment launch flag, deduplicate pending requests, initiate a provider transaction, or verify a provider response. Supabase anonymous Auth users have an authenticated Postgres role, so a simple authenticated-role grant is not by itself proof of a permanent account.

The `payment_intents` table is server-controlled and has an immutability guard. The existing subscription activation trigger is a privileged database path, not a provider integration: no matching provider webhook/verification function was found in the reviewed database functions or deployed Edge Functions.

### 4. Deployed Edge Functions

The live functions `rapid-action` and `worklink-import` both return generic greeting responses and have identical source hashes/content. Neither is a payment webhook or payment verification handler. Both currently have JWT verification enabled.

## Security and product implications

1. A user-entered payment reference is untrusted input. It must never directly change an intent to paid or activate a subscription.
2. A pending intent is not a completed payment.
3. A `requested` subscription row is not a paid subscription.
4. Polling `payment_intents` from a browser is not a verification mechanism. The browser may display a paid state only after the server has verified the provider event and persisted the verified state.
5. The payment UI being hidden is a presentation gate, not a backend authorization control.

## Required work before subscriptions can be enabled

- Obtain the actual ShamCash merchant/API documentation and verify that Madkhal is eligible to use it. Do not invent endpoints or assume that manual wallet transfer supports callbacks.
- Select one supported payment model:
  - provider API + signed webhook/callback and server-side reconciliation; or
  - manual transfer with an authenticated operator review workflow, audit trail, and server-only approval.
- Implement provider signature/authenticity verification, amount/currency/merchant/reference checks, expiry checks, replay protection, and idempotent event processing.
- Keep provider secrets server-side (Edge Function secrets or another trusted backend); never expose them in `index.html` or browser storage.
- Restrict payment-intent creation with a server-side feature flag, permanent-account check, per-user idempotency, and abuse/rate controls.
- Ensure only the trusted verifier/operator path can transition an intent to paid and activate a subscription.
- Add tests for forged callbacks, wrong amount/currency, unknown intent, duplicate callback, expired intent, replay, and concurrent intent creation.
- Perform end-to-end sandbox testing with the provider before enabling the UI.

## Current safe state

- Subscription UI remains disabled in `index.html`.
- No production SQL or provider configuration was changed in this audit.
- Do not set the proposed server-side subscription flag to true until the provider-verification work and end-to-end tests are complete.
- Do not change `madkhal_launch_config.free_launch`; it controls other launch/matching behavior and is not a subscription switch.

## Scope limitation

The provider's private merchant documentation/account was not available in the repository or connected project context. Therefore this audit cannot establish whether ShamCash offers Madkhal a webhook, transaction lookup API, or an authorized manual merchant workflow. Those details must be confirmed with the provider before implementation.
