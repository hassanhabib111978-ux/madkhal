-- Fail-closed server-side subscription checkout gate.
-- This flag is deliberately independent from free_launch, which also controls matching.
ALTER TABLE public.madkhal_launch_config
  ADD COLUMN IF NOT EXISTS subscriptions_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.madkhal_launch_config.subscriptions_enabled IS
  'Server-side gate for creating subscription payment intents; defaults to disabled. Does not control free-launch matching.';

CREATE OR REPLACE FUNCTION public.create_subscription_payment_intent()
 RETURNS TABLE(
  payment_intent_id uuid,
  amount numeric,
  currency text,
  purpose text,
  status text,
  provider text,
  expires_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_anonymous boolean;
  v_id uuid;
  v_amount numeric;
  v_currency text;
  v_purpose text;
  v_status text;
  v_provider text;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  -- Anonymous sessions must first be converted to a recoverable account.
  SELECT u.is_anonymous
    INTO v_is_anonymous
  FROM auth.users AS u
  WHERE u.id = v_user;

  IF NOT FOUND OR COALESCE(v_is_anonymous, true) THEN
    RAISE EXCEPTION 'permanent_account_required';
  END IF;

  -- Fail closed unless an operator explicitly enables checkout server-side.
  IF NOT COALESCE((
    SELECT lc.subscriptions_enabled
    FROM public.madkhal_launch_config AS lc
    WHERE lc.id = true
  ), false) THEN
    RAISE EXCEPTION 'subscription_checkout_disabled';
  END IF;

  -- Serialize checkout requests per user so simultaneous taps cannot create duplicates.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('madkhal.subscription-checkout:' || v_user::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions AS s
    JOIN public.profiles AS p ON p.id = s.user_id
    WHERE p.auth_user_id = v_user
      AND s.audience = 'worker'
      AND s.status = 'active'
      AND (s.ends_at IS NULL OR s.ends_at > pg_catalog.now())
  ) THEN
    RAISE EXCEPTION 'subscription_already_active';
  END IF;

  -- Reuse a live pending intent instead of creating a new payable request.
  SELECT pi.id, pi.amount, pi.currency, pi.purpose, pi.status, pi.provider, pi.expires_at
    INTO v_id, v_amount, v_currency, v_purpose, v_status, v_provider, v_expires
  FROM public.payment_intents AS pi
  WHERE pi.user_id = v_user
    AND pi.purpose = 'subscription'
    AND pi.status = 'pending'
    AND pi.expires_at > pg_catalog.now()
    AND pi.metadata ->> 'product' = 'madkhal_worker_monthly'
  ORDER BY pi.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    v_expires := pg_catalog.now() + interval '30 minutes';
    INSERT INTO public.payment_intents (
      user_id, amount, currency, purpose, status, provider, expires_at, metadata
    ) VALUES (
      v_user,
      1.00,
      'USD',
      'subscription',
      'pending',
      'shamcash',
      v_expires,
      pg_catalog.jsonb_build_object(
        'product', 'madkhal_worker_monthly',
        'plan', 'monthly',
        'subscription_price_usd', 1.00,
        'provider', 'shamcash'
      )
    )
    RETURNING id, payment_intents.amount, payment_intents.currency,
              payment_intents.purpose, payment_intents.status,
              payment_intents.provider, payment_intents.expires_at
    INTO v_id, v_amount, v_currency, v_purpose, v_status, v_provider, v_expires;
  END IF;

  payment_intent_id := v_id;
  amount := v_amount;
  currency := v_currency;
  purpose := v_purpose;
  status := v_status;
  provider := v_provider;
  expires_at := v_expires;
  RETURN NEXT;
END;
$function$;

-- Preserve the intended API: authenticated users can request their own intent;
-- anonymous/public callers cannot invoke the SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.create_subscription_payment_intent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subscription_payment_intent() TO authenticated, service_role;
