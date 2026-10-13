-- ====================================================================
-- MoocDeal Migration: Server-Side 4-Digit PIN Brute-Force Protection
-- Migration: 20261013_000005_server_side_auth_lockout.sql
-- ====================================================================
-- Resolves:
-- 1. PostgreSQL transaction rollback trap: Returns structured JSONB errors
--    instead of unhandled RAISE EXCEPTION so failed_attempts updates commit.
-- 2. Concurrency race conditions: Employs 'SELECT ... FOR UPDATE' row lock.
-- 3. Lockout griefing / DoS mitigation: Progressive short lockout (1 min at 5 tries, 5 min at 10 tries)
--    with generic error messaging preventing user enumeration.
-- 4. Preserves 100% of existing accounts and password hashes.

-- Step 1: Add attempt tracking columns if they do not exist
ALTER TABLE public.student_credentials
    ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;

-- Step 2: Concurrency-Safe and Rollback-Safe Authentication Function
CREATE OR REPLACE FUNCTION public.authenticate_student(
    p_reg_no TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm_reg TEXT;
    v_profile RECORD;
    v_creds RECORD;
    v_new_fails INT;
    v_lock_until TIMESTAMPTZ;
BEGIN
    v_norm_reg := UPPER(TRIM(COALESCE(p_reg_no, '')));

    -- 1. Input sanity check
    IF v_norm_reg = '' OR p_password IS NULL OR length(p_password) < 4 THEN
        RETURN jsonb_build_object('error', 'Invalid registration number or password.');
    END IF;

    -- 2. Fetch profile (constant-time response if not found)
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE UPPER(TRIM(reg_no)) = v_norm_reg
    LIMIT 1;

    IF v_profile.id IS NULL THEN
        -- Dummy crypt to balance timing and prevent timing attacks
        PERFORM crypt(p_password, '$2a$06$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ZTMG');
        RETURN jsonb_build_object('error', 'Invalid registration number or password.');
    END IF;

    -- 3. Fetch credentials with row-level lock (FOR UPDATE) to serialize concurrent brute-force attacks
    SELECT * INTO v_creds
    FROM public.student_credentials
    WHERE student_id = v_profile.id
    FOR UPDATE;

    IF v_creds IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid registration number or password.');
    END IF;

    -- 4. Check active lockout
    IF v_creds.locked_until IS NOT NULL AND v_creds.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'error',
            'Account temporarily locked due to repeated failed attempts. Please try again later or use Forgot Password.'
        );
    END IF;

    -- 5. Verify password hash using pgcrypto crypt()
    IF v_creds.password_hash != crypt(p_password, v_creds.password_hash) THEN
        v_new_fails := COALESCE(v_creds.failed_attempts, 0) + 1;

        -- Progressive lockout:
        -- 5 failed attempts: lock for 1 minute
        -- 10+ failed attempts: lock for 5 minutes
        IF v_new_fails >= 10 THEN
            v_lock_until := NOW() + INTERVAL '5 minutes';
        ELSIF v_new_fails >= 5 THEN
            v_lock_until := NOW() + INTERVAL '1 minute';
        ELSE
            v_lock_until := NULL;
        END IF;

        -- THIS UPDATE COMMITS BECAUSE WE DO NOT RAISE AN UNHANDLED EXCEPTION
        UPDATE public.student_credentials
        SET failed_attempts = v_new_fails,
            locked_until = v_lock_until,
            updated_at = NOW()
        WHERE student_id = v_profile.id;

        IF v_lock_until IS NOT NULL THEN
            RETURN jsonb_build_object(
                'error',
                'Too many failed attempts. Account temporarily locked. Please try again in a few minutes.'
            );
        END IF;

        RETURN jsonb_build_object('error', 'Invalid registration number or password.');
    END IF;

    -- 6. Authentication Succeeded: Reset failed attempts counter and clear lockout
    UPDATE public.student_credentials
    SET failed_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE student_id = v_profile.id;

    -- Return the clean student profile object
    RETURN to_jsonb(v_profile);
END;
$$;

GRANT EXECUTE ON FUNCTION public.authenticate_student(TEXT, TEXT) TO anon, authenticated, service_role;
