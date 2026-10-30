# Email Identity and Job-Alert Rollout

## Current free-launch behavior

- Email address and password are not part of the seeker or employer workflow.
- Browsing, profile creation, matching, and the current free features must not prompt for an email address.
- window.MADKHAL_ACCOUNT_EMAIL_UI_ENABLED remains false in index.html.
- account-recovery.js is intentionally retained as dormant account-continuity code. Its init() exits before mounting any UI unless the feature flag is explicitly enabled.
- Do not enable this flag merely to activate paid subscriptions. The current module exposes general account-linking and recovery panels on multiple screens; the paid subscription journey should instead request email in the subscription checkout flow.

## Paid-launch design

1. A seeker selects a paid plan and requests subscription.
2. If the current Auth user has no confirmed email, show a focused email step in the subscription flow. Explain that the email is needed for subscription notices and job alerts, and collect a separate, explicit opt-in for job-alert messages.
3. Link the email to the existing Auth identity so the seeker's current profile and history remain attached to the same user. For anonymous Auth identities, enable and verify Supabase manual identity linking before rollout.
4. Send confirmation and return the user to the pending subscription journey. Only continue after the server-visible Auth identity has a confirmed email (auth.users.email_confirmed_at IS NOT NULL).
5. Before creating a payment intent, enforce both confirmed email and the chosen notification-consent state on the server. The browser must never be the sole enforcement point.
6. Create or reuse the pending payment intent and send the user to the selected payment provider. Activate the subscription only after independently verified provider payment; returning from the provider is not proof of payment.
7. Send subscription receipts/status messages separately from optional job-alert messages. Job alerts must respect opt-in, user preferences, frequency limits, deduplication, and an unsubscribe action.

## Notification delivery foundation

- Use a trusted server-side sender such as a Supabase Edge Function with a transactional email provider. Keep provider API keys in server-side secrets; never in index.html or browser storage.
- Start with a daily digest of newly matched opportunities rather than an email for every ingestion event.
- Build notification preferences around user identity and subscription state, not around a raw email address copied into job or profile records.
- Record consent status, timestamp, purpose, and later withdrawal. A withdrawal must stop future optional job-alert emails without affecting account access or essential subscription/security messages.
- Deduplicate alerts by user, opportunity, and alert window. Do not send stale, expired, already-seen, or non-matching opportunities.
- Test confirmation, bounced/invalid addresses, repeated checkout attempts, payment cancellation/failure, unsubscribe, retries, duplicate suppression, and subscription expiry before public paid activation.

## Supabase prerequisites before activation

- Verify manual identity linking is enabled if anonymous accounts are converted in place.
- Configure email confirmation, Site URL, exact Redirect URLs, and a reliable production SMTP/provider sender.
- Verify the confirmation link returns to the deployed Madkhal origin and preserves the pending subscription journey safely.
- Add and test the server-side confirmed-email and consent checks in the payment-intent RPC before enabling the server subscription flag.
- Keep both client monthly subscription UI and server subscriptions_enabled fail-closed until provider verification and notification delivery tests pass.

## Current implementation boundary

This document is a rollout plan, not an assertion that email sending, consent storage, or paid checkout is already implemented. No notification schema, email provider, SMTP configuration, or paid-flow UI is enabled by this change.