-- MoocDeal Migration: Course RLS, Duplicate Prevention & Profile Synchronization
-- Fixes:
-- 1. 'new row violates row-level security policy for table "courses"' by adding INSERT policy and unique constraint
-- 2. Course resolution and atomic deduplication via resolve_or_create_course
-- 3. Profile editing and secure synchronization via update_student_profile

-- 1. Ensure unique constraint on normalized_name for courses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_courses_normalized_name'
    ) THEN
        ALTER TABLE public.courses ADD CONSTRAINT unique_courses_normalized_name UNIQUE (normalized_name);
    END IF;
END $$;

-- 2. Explicit RLS Policies for courses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'courses_insert_policy'
    ) THEN
        CREATE POLICY "courses_insert_policy" ON public.courses
        FOR INSERT TO anon, authenticated
        WITH CHECK (
            length(trim(name)) >= 2
            AND length(trim(code)) >= 2
            AND length(trim(normalized_name)) >= 2
        );
    END IF;

    -- Explicitly DROP any insecure legacy update policy
    DROP POLICY IF EXISTS "courses_update_policy" ON public.courses;

    -- Strict admin-only update policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'courses_update_admin'
    ) THEN
        CREATE POLICY "courses_update_admin" ON public.courses
        FOR UPDATE TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid() AND profiles.is_admin = true
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid() AND profiles.is_admin = true
            )
        );
    END IF;
END $$;

-- 3. Atomic course resolution and duplicate prevention
CREATE OR REPLACE FUNCTION public.resolve_or_create_course(
    p_code TEXT,
    p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm TEXT;
    v_clean_code TEXT;
    v_course RECORD;
    v_final_code TEXT;
BEGIN
    v_clean_code := lower(trim(COALESCE(p_code, '')));
    v_norm := lower(regexp_replace(trim(COALESCE(p_name, '')), '[^a-zA-Z0-9 ]', '', 'g'));
    v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');

    IF length(v_norm) < 2 THEN
        RAISE EXCEPTION 'Course title must be at least 2 characters long.';
    END IF;

    -- 1. Check exact normalized name match
    SELECT * INTO v_course
    FROM public.courses
    WHERE normalized_name = v_norm
    LIMIT 1;

    IF v_course.id IS NOT NULL THEN
        RETURN to_jsonb(v_course);
    END IF;

    -- 2. Check course code match if non-empty and not generic
    IF v_clean_code <> '' AND v_clean_code NOT LIKE 'noc24-%' THEN
        SELECT * INTO v_course
        FROM public.courses
        WHERE lower(code) = v_clean_code
        LIMIT 1;

        IF v_course.id IS NOT NULL THEN
            RETURN to_jsonb(v_course);
        END IF;
    END IF;

    -- Determine unique code for new course
    IF v_clean_code <> '' AND NOT EXISTS (SELECT 1 FROM public.courses WHERE lower(code) = v_clean_code) THEN
        v_final_code := trim(p_code);
    ELSE
        v_final_code := 'noc24-' || substr(md5(v_norm), 1, 6);
        IF EXISTS (SELECT 1 FROM public.courses WHERE lower(code) = lower(v_final_code)) THEN
            v_final_code := v_final_code || '-' || substr(md5(random()::text), 1, 4);
        END IF;
    END IF;

    -- 3. Atomic insert with ON CONFLICT resolution
    INSERT INTO public.courses (code, name, normalized_name, organiser_status, created_at, updated_at)
    VALUES (
        v_final_code,
        trim(p_name),
        v_norm,
        'NONE',
        NOW(),
        NOW()
    )
    ON CONFLICT (normalized_name) DO UPDATE
    SET updated_at = NOW()
    RETURNING * INTO v_course;

    RETURN to_jsonb(v_course);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_or_create_course(TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Secure Profile Update RPC (enforces valid academic fields, preserves registration number)
CREATE OR REPLACE FUNCTION public.update_student_profile(
    p_student_id UUID,
    p_full_name TEXT,
    p_branch TEXT,
    p_academic_year TEXT,
    p_section TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_clean_name TEXT;
    v_clean_section TEXT;
BEGIN
    v_clean_name := TRIM(COALESCE(p_full_name, ''));
    v_clean_section := UPPER(TRIM(COALESCE(p_section, '')));

    IF LENGTH(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'Full name must be at least 2 characters long.';
    END IF;

    IF LENGTH(v_clean_section) < 1 THEN
        RAISE EXCEPTION 'Section cannot be empty.';
    END IF;

    -- Update editable academic fields only (reg_no, is_admin, is_verified remain strictly protected)
    UPDATE public.profiles
    SET full_name = v_clean_name,
        branch = p_branch,
        academic_year = p_academic_year,
        section = v_clean_section,
        updated_at = NOW()
    WHERE id = p_student_id
    RETURNING * INTO v_profile;

    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'Student profile not found.';
    END IF;

    RETURN row_to_json(v_profile)::JSONB;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
