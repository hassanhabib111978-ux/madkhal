-- PROPOSAL ONLY — NOT AN APPLIED MIGRATION.
-- Review and test on a disposable Supabase branch before generating a real migration.
-- Purpose: enforce the paused subscription state in the database, not only in the UI.
--
-- Safety properties:
--   * subscription_enabled defaults to false (closed by default).
--   * anonymous Supabase users cannot create paid subscription intents.
--   * concurrent/repeated calls reuse one unexpired pending intent per user.
--   * provider verification remains the only trusted path to status='paid'.
--   * does not modify madkhal_launch_config.free_launch, which has separate matching semantics.

ALTER TABLE public.madkhal_launch_config
  ADD COLUMN IF NOT EXISTS subscription_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.create_subscription_payment_intent()
RETURNS TABLE(
  payment_intent_id uuid,
  amount numeric,
  currency text,
  purpose text,
  status text,
  provider text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_anonymous boolean;
  v_subscription_enabled boolean;
  v_existing public.payment_intents%ROWTYPE;
  v_id uuid;
  v_expires timestamptz := now() + interval '30 minutes';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT u.is_anonymous
    INTO v_is_anonymous
  FROM auth.users AS u
  WHERE u.id = v_user;

  IF NOT FOUND OR COALESCE(v_is_anonymous, true) THEN
    RAISE EXCEPTION 'permanent_account_required';
  END IF;

  SELECT c.subscription_enabled
    INTO v_subscription_enabled
  FROM public.madkhal_launch_config AS c
  WHERE c.id = true;

  IF COALESCE(v_subscription_enabled, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'subscription_temporarily_unavailable';
  END IF;

  -- Serialize creation for this user so parallel calls cannot create duplicates.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text, 0)
  );

  SELECT pi.*
    INTO v_existing
  FROM public.payment_intents AS pi
  WHERE pi.user_id = v_user
    AND pi.purpose = 'subscription'
    AND pi.status = 'pending'
    AND pi.expires_at > now()
  ORDER BY pi.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT v_existing.id, v_existing.amount, v_existing.currency,
           v_existing.purpose, v_existing.status, v_existing.provider,
           v_existing.expires_at;
    RETURN;
  END IF;

  INSERT INTO public.payment_intents (
    user_id, amount, currency, purpose, status, provider, expires_at, metadata
  )
  VALUES (
    v_user, 1.00, 'USD', 'subscription', 'pending', 'shamcash', v_expires,
    jsonb_build_object(
      'product', 'madkhal_worker_monthly',
      'plan', 'monthly',
      'subscription_price_usd', 1.00,
      'provider', 'shamcash'
    )
  )
  RETURNING id INTO v_id;

  RETURN QUERY
  SELECT pi.id, pi.amount, pi.currency, pi.purpose, pi.status, pi.provider,
         pi.expires_at
  FROM public.payment_intents AS pi
  WHERE pi.id = v_id;
END;
$function$;

-- Keep this RPC callable only by authenticated users. The function itself also
-- rejects anonymous Auth users; the Postgres role alone cannot distinguish them.
REVOKE ALL ON FUNCTION public.create_subscription_payment_intent()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subscription_payment_intent()
  TO authenticated;

-- IMPORTANT:
-- 1. Keep subscription_enabled=false until the complete payment provider flow,
--    webhook/signature verification, reconciliation and support process are tested.
-- 2. Do not allow browser clients to update this setting.
-- 3. Do not mark payment_intents paid from client code.
-- 4. Before enabling, verify that only the trusted provider callback can transition
--    a payment intent to paid and that duplicate callbacks are idempotent.
