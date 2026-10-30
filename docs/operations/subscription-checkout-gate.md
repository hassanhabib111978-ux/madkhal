# Subscription Checkout Server Gate

## Current release posture

- The client-side monthly subscription feature remains disabled in index.html.
- The new public.madkhal_launch_config.subscriptions_enabled flag is independent of free_launch and defaults to false.
- free_launch must not be changed to control checkout because it also participates in free-launch matching and notification behavior.
- The payment-intent RPC rejects checkout unless the server-side flag is explicitly enabled.

## Request behavior

- The RPC currently requires a permanent, non-anonymous Supabase Auth user. It does not require an email address or confirmed email during the free-launch phase; email is intentionally absent from the current user workflow.
- Before paid activation, extend the server-side gate to require a confirmed email (auth.users.email_confirmed_at) and a recorded opt-in for job-alert emails. Do not rely on a client-side check alone. See email-notifications-rollout.md.
- A live active worker subscription is rejected rather than creating another charge request.
- Repeated or simultaneous requests for the same user reuse one unexpired pending intent. A transaction-scoped advisory lock serializes requests for that user.
- Expired or non-pending intents are not reused.
- The permanent-account check is enforced inside the database function, not trusted to the browser.
- The RPC only creates a pending intent. It never marks payment as paid and never activates a subscription.

## Important: checkout must remain disabled

The live database review found that payment_intents are protected by an immutability trigger which permits writes only when the trusted transaction sets app.wallet_internal = 'on'. The reviewed public/private function catalog did not reveal a provider-verification function that performs this operation, and the two deployed Edge Functions inspected were placeholder samples rather than payment integrations.

Therefore, do not set subscriptions_enabled = true or re-enable the client subscription UI until a real provider integration is implemented and tested. That integration must independently verify provider-side evidence, update the intent inside a trusted server transaction, set verified_at and paid_at only after successful verification, and be the only supported path to status = 'paid'.

## Activation prerequisites

1. Obtain and configure a real merchant/provider account and server-side credentials outside the browser.
2. Implement and test the provider callback or trusted verification flow, including signature/authenticity checks, amount/currency/product matching, expiry, replay protection, and idempotency.
3. Test that only a verified payment can move an intent to paid and trigger subscription activation.
4. Confirm the provider's reconciliation/refund/support process and applicable legal/commercial requirements.
5. Only then enable both the server-side subscriptions_enabled flag and the client-side monthly subscription feature.

## Validation scope

The migration adds no payment records, changes no existing subscription state, and does not touch free_launch. Repository guardrails verify the fail-closed default, server-side gate, per-user request serialization, pending-intent reuse, active-subscription guard, and intended function grants. A disposable Supabase branch integration test is still required before applying the migration to production.
