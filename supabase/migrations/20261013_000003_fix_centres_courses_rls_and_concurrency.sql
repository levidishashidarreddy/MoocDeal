-- MoocDeal Migration: Fix Centres & Courses RLS, Concurrency Deduplication & Scalability
-- Date: 2026-10-13
-- Resolves:
-- 1. 'new row violates row-level security policy for table "centres"'
-- 2. Concurrency-safe deduplication on centres (unique normalized_name + city)
-- 3. Atomic course and centre resolution via resolve_or_create_centre & resolve_or_create_course
-- 4. Atomic all-in-one exam synchronization via save_student_exam_atomic
-- 5. Scalability indexes for 5,000+ registered students

-- 1. Ensure unique constraint on centres (normalized_name, city)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_centres_normalized_name_city'
    ) THEN
        ALTER TABLE public.centres ADD CONSTRAINT unique_centres_normalized_name_city UNIQUE (normalized_name, city);
    END IF;
END $$;

-- 2. Explicit RLS Policies for centres
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'centres' AND policyname = 'centres_insert_policy'
    ) THEN
        CREATE POLICY "centres_insert_policy" ON public.centres
        FOR INSERT TO anon, authenticated
        WITH CHECK (
            length(trim(name)) >= 2 AND
            length(trim(normalized_name)) >= 2 AND
            length(trim(city)) >= 2
        );
    END IF;
END $$;

-- 3. Course Insert Policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'courses_insert_policy'
    ) THEN
        CREATE POLICY "courses_insert_policy" ON public.courses
        FOR INSERT TO anon, authenticated
        WITH CHECK (
            length(trim(name)) >= 2 AND
            length(trim(normalized_name)) >= 2
        );
    END IF;
END $$;

-- 4. Atomic centre resolution and duplicate prevention RPC
CREATE OR REPLACE FUNCTION public.resolve_or_create_centre(
    p_name TEXT,
    p_address TEXT DEFAULT '',
    p_city TEXT DEFAULT 'Vijayawada',
    p_state TEXT DEFAULT 'Andhra Pradesh',
    p_pincode TEXT DEFAULT '',
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm TEXT;
    v_city TEXT;
    v_centre RECORD;
    v_clean_name TEXT;
BEGIN
    v_clean_name := trim(COALESCE(p_name, ''));
    v_city := trim(COALESCE(p_city, 'Vijayawada'));
    IF v_city = '' THEN
        v_city := 'Vijayawada';
    END IF;

    -- Normalize centre name: lowercase, strip punctuation, collapse whitespace
    v_norm := lower(regexp_replace(v_clean_name, '[^a-zA-Z0-9 ]', '', 'g'));
    v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');

    IF length(v_norm) < 2 THEN
        RAISE EXCEPTION 'Test centre name must be at least 2 characters long.';
    END IF;

    -- 1. Exact normalized match with matching city
    SELECT * INTO v_centre
    FROM public.centres
    WHERE normalized_name = v_norm AND lower(city) = lower(v_city)
    ORDER BY is_verified DESC, created_at ASC
    LIMIT 1;

    IF v_centre.id IS NOT NULL THEN
        RETURN to_jsonb(v_centre);
    END IF;

    -- 2. Check if normalized name matches regardless of slight city variation
    SELECT * INTO v_centre
    FROM public.centres
    WHERE normalized_name = v_norm
    ORDER BY is_verified DESC, created_at ASC
    LIMIT 1;

    IF v_centre.id IS NOT NULL THEN
        RETURN to_jsonb(v_centre);
    END IF;

    -- 3. Atomic insert with ON CONFLICT (normalized_name, city)
    INSERT INTO public.centres (
        name,
        normalized_name,
        address,
        city,
        state,
        pincode,
        is_verified,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        v_clean_name,
        v_norm,
        COALESCE(trim(p_address), 'Assigned Test Centre'),
        v_city,
        COALESCE(trim(p_state), 'Andhra Pradesh'),
        COALESCE(trim(p_pincode), ''),
        false,
        p_user_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (normalized_name, city) DO UPDATE
    SET updated_at = NOW()
    RETURNING * INTO v_centre;

    RETURN to_jsonb(v_centre);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_or_create_centre(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated, service_role;

-- 5. Atomic course resolution RPC
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

    -- 2. Check course code match if non-empty and not generic noc24-
    IF v_clean_code <> '' AND v_clean_code NOT LIKE 'noc24-%' THEN
        SELECT * INTO v_course
        FROM public.courses
        WHERE lower(code) = v_clean_code
        LIMIT 1;

        IF v_course.id IS NOT NULL THEN
            RETURN to_jsonb(v_course);
        END IF;
    END IF;

    -- 3. Determine unique code
    IF v_clean_code <> '' AND length(v_clean_code) >= 2 AND NOT EXISTS (SELECT 1 FROM public.courses WHERE lower(code) = v_clean_code) THEN
        v_final_code := trim(p_code);
    ELSE
        v_final_code := 'noc24-' || substr(md5(v_norm), 1, 6);
        IF EXISTS (SELECT 1 FROM public.courses WHERE lower(code) = lower(v_final_code)) THEN
            v_final_code := v_final_code || '-' || substr(md5(random()::text), 1, 4);
        END IF;
    END IF;

    -- 4. Atomic insert with ON CONFLICT (normalized_name)
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

-- 6. Atomic save_student_exam_atomic RPC
CREATE OR REPLACE FUNCTION public.save_student_exam_atomic(
    p_student_id UUID,
    p_course_name TEXT,
    p_course_code TEXT DEFAULT '',
    p_centre_name TEXT DEFAULT '',
    p_centre_address TEXT DEFAULT '',
    p_city TEXT DEFAULT 'Vijayawada',
    p_state TEXT DEFAULT 'Andhra Pradesh',
    p_pincode TEXT DEFAULT '',
    p_exam_date DATE DEFAULT NULL,
    p_reporting_time TIME DEFAULT NULL,
    p_exam_start_time TIME DEFAULT NULL,
    p_shift TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'CONFIRMED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_course_json JSONB;
    v_centre_json JSONB;
    v_course_id UUID;
    v_centre_id UUID;
    v_cohort_id UUID;
    v_exam_id UUID;
    v_full_exam RECORD;
BEGIN
    -- Validate student existence
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id) THEN
        RAISE EXCEPTION 'Student profile not found.';
    END IF;

    -- 1. Resolve or create canonical course
    v_course_json := public.resolve_or_create_course(p_course_code, p_course_name);
    v_course_id := (v_course_json->>'id')::UUID;

    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Failed to resolve canonical course.';
    END IF;

    -- 2. If CONFIRMED status, resolve centre and sync cohort
    IF p_status = 'CONFIRMED' THEN
        IF p_centre_name IS NULL OR trim(p_centre_name) = '' THEN
            RAISE EXCEPTION 'Confirmed exam requires centre_name.';
        END IF;
        IF p_exam_date IS NULL THEN
            RAISE EXCEPTION 'Confirmed exam requires exam_date.';
        END IF;
        IF p_reporting_time IS NULL THEN
            RAISE EXCEPTION 'Confirmed exam requires reporting_time.';
        END IF;

        v_centre_json := public.resolve_or_create_centre(
            p_centre_name,
            p_centre_address,
            p_city,
            p_state,
            p_pincode,
            p_student_id
        );
        v_centre_id := (v_centre_json->>'id')::UUID;

        -- Find or create exam cohort (unique on centre_id, exam_date, reporting_time)
        INSERT INTO public.exam_cohorts (centre_id, exam_date, reporting_time)
        VALUES (v_centre_id, p_exam_date, p_reporting_time)
        ON CONFLICT (centre_id, exam_date, reporting_time)
        DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_cohort_id;

        -- Upsert student exam record
        INSERT INTO public.student_exams (
            student_id, course_id, centre_id, exam_date, reporting_time, exam_start_time, shift, status, updated_at
        )
        VALUES (
            p_student_id, v_course_id, v_centre_id, p_exam_date, p_reporting_time, p_exam_start_time, p_shift, 'CONFIRMED', NOW()
        )
        ON CONFLICT (student_id)
        DO UPDATE SET
            course_id = EXCLUDED.course_id,
            centre_id = EXCLUDED.centre_id,
            exam_date = EXCLUDED.exam_date,
            reporting_time = EXCLUDED.reporting_time,
            exam_start_time = EXCLUDED.exam_start_time,
            shift = EXCLUDED.shift,
            status = 'CONFIRMED',
            updated_at = NOW()
        RETURNING id INTO v_exam_id;

        -- Deactivate prior cohort memberships for this student
        UPDATE public.cohort_members
        SET is_active = false
        WHERE student_id = p_student_id AND cohort_id != v_cohort_id;

        -- Link to active cohort
        INSERT INTO public.cohort_members (cohort_id, student_id, exam_id, is_active)
        VALUES (v_cohort_id, p_student_id, v_exam_id, true)
        ON CONFLICT (cohort_id, student_id)
        DO UPDATE SET exam_id = v_exam_id, is_active = true;

    ELSE
        -- PENDING_DETAILS status (Course-only registration)
        INSERT INTO public.student_exams (
            student_id, course_id, centre_id, exam_date, reporting_time, exam_start_time, shift, status, updated_at
        )
        VALUES (
            p_student_id, v_course_id, NULL, NULL, NULL, NULL, NULL, 'PENDING_DETAILS', NOW()
        )
        ON CONFLICT (student_id)
        DO UPDATE SET
            course_id = EXCLUDED.course_id,
            centre_id = NULL,
            exam_date = NULL,
            reporting_time = NULL,
            exam_start_time = NULL,
            shift = NULL,
            status = 'PENDING_DETAILS',
            updated_at = NOW()
        RETURNING id INTO v_exam_id;

        -- Deactivate all cohort memberships
        UPDATE public.cohort_members
        SET is_active = false
        WHERE student_id = p_student_id;
    END IF;

    -- Fetch and return full joined exam record
    SELECT
        se.id,
        se.student_id,
        se.course_id,
        se.centre_id,
        se.exam_date,
        se.reporting_time,
        se.exam_start_time,
        se.shift,
        se.status,
        se.created_at,
        se.updated_at,
        row_to_json(c.*) AS course,
        CASE WHEN ctr.id IS NOT NULL THEN row_to_json(ctr.*) ELSE NULL END AS centre
    INTO v_full_exam
    FROM public.student_exams se
    JOIN public.courses c ON c.id = se.course_id
    LEFT JOIN public.centres ctr ON ctr.id = se.centre_id
    WHERE se.id = v_exam_id;

    RETURN row_to_json(v_full_exam)::JSONB;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_student_exam_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TIME, TIME, TEXT, TEXT) TO anon, authenticated, service_role;

-- 7. Scalability Indexes for 5,000+ Students
CREATE INDEX IF NOT EXISTS idx_student_exams_course_created
    ON public.student_exams (course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cohort_members_active_lookup
    ON public.cohort_members (student_id, is_active);

CREATE INDEX IF NOT EXISTS idx_profiles_upper_reg_no
    ON public.profiles (upper(trim(reg_no)));

NOTIFY pgrst, 'reload schema';
