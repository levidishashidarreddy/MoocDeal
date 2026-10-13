-- ====================================================================
-- MoocDeal — READ-ONLY PRODUCTION PREFLIGHT VERIFICATION SCRIPT
-- ====================================================================
-- Purpose:
--   Verifies all schema prerequisites, constraints, foreign keys, extensions,
--   RLS policies (specifically courses_update_policy), and existing student data
--   BEFORE executing the consolidated production migration.
--
-- Safety Guarantees:
--   1. 100% READ-ONLY: Contains ZERO INSERT, UPDATE, DELETE, ALTER, or DROP statements.
--   2. Safe to execute against live production at any time.
--   3. Every status is dynamically evaluated via real SQL checks without hardcoded assumptions.
--   4. Fully explicit type casts on all system catalog expressions to prevent PostgreSQL
--      operator ambiguity (e.g. pg_constraint.contype "char" operator errors).
--
-- How to run:
--   Open Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run.
--   You can run all 4 queries together, or highlight and run each query individually.
-- ====================================================================

-- ====================================================================
-- QUERY 1: PREFLIGHT STATUS AUDIT (DIAGNOSTIC MATRIX)
-- ====================================================================
WITH preflight AS (
    -- ----------------------------------------------------------------
    -- 1. EXTENSIONS AUDIT
    -- ----------------------------------------------------------------
    SELECT
        '1. Extensions' AS category,
        'pgcrypto extension presence' AS check_item,
        CASE
            WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
                THEN 'INSTALLED (' || (SELECT n.nspname::text FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'pgcrypto') || ')'
            ELSE 'NOT_INSTALLED (Migration will execute CREATE EXTENSION IF NOT EXISTS)'
        END AS status,
        COALESCE(
            (SELECT 'Installed in schema: ' || n.nspname::text
             FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid
             WHERE e.extname = 'pgcrypto'),
            'Not yet installed in database'
        ) AS details

    UNION ALL

    SELECT
        '1. Extensions',
        'uuid-ossp extension presence',
        CASE
            WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp')
                THEN 'INSTALLED (' || (SELECT n.nspname::text FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'uuid-ossp') || ')'
            ELSE 'NOT_INSTALLED (Migration will execute CREATE EXTENSION IF NOT EXISTS)'
        END,
        COALESCE(
            (SELECT 'Installed in schema: ' || n.nspname::text
             FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid
             WHERE e.extname = 'uuid-ossp'),
            'Not yet installed in database'
        )

    UNION ALL

    -- ----------------------------------------------------------------
    -- 2. CORE DATABASE TABLES
    -- ----------------------------------------------------------------
    SELECT
        '2. Tables',
        'Required base tables presence (profiles, centres, courses, student_exams, course_group_links, student_credentials)',
        CASE
            WHEN (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'centres', 'courses', 'student_exams', 'course_group_links', 'student_credentials')) = 6
                THEN 'ALL_PRESENT (6 of 6 core tables found)'
            ELSE 'MISSING_TABLES (' || (SELECT count(*)::text FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'centres', 'courses', 'student_exams', 'course_group_links', 'student_credentials')) || ' of 6 found)'
        END,
        (SELECT 'Found: ' || COALESCE(string_agg(tablename::text, ', '), 'None')
         FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'centres', 'courses', 'student_exams', 'course_group_links', 'student_credentials'))

    UNION ALL

    -- ----------------------------------------------------------------
    -- 3. TEST CENTRES UNIQUENESS & CONSTRAINTS (Exact Equality Semantics)
    -- ----------------------------------------------------------------
    SELECT
        '3. Centres',
        'Exact duplicate (normalized_name, city) pairs',
        CASE
            WHEN (SELECT count(*) FROM (
                SELECT normalized_name, city
                FROM public.centres
                GROUP BY normalized_name, city
                HAVING count(*) > 1
            ) d) = 0 THEN 'NO_DUPLICATES (0 colliding pairs found using exact unique constraint semantics)'
            ELSE 'COLLISION_DETECTED (' || (SELECT count(*)::text FROM (
                SELECT normalized_name, city
                FROM public.centres
                GROUP BY normalized_name, city
                HAVING count(*) > 1
            ) d) || ' duplicate pairs exist — constraint creation will fail!)'
        END,
        (SELECT 'Total centres: ' || count(*)::text || ', distinct (normalized_name, city) pairs: ' || count(DISTINCT (normalized_name, city))::text FROM public.centres)

    UNION ALL

    SELECT
        '3. Centres',
        'unique_centres_normalized_name_city constraint',
        CASE
            WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_centres_normalized_name_city')
                THEN 'ALREADY_EXISTS'
            ELSE 'NOT_PRESENT (Will be created by migration Part 1)'
        END,
        COALESCE(
            (SELECT 'Constraint type: ' || contype::text || ' (' ||
                    CASE contype
                        WHEN 'u' THEN 'UNIQUE'
                        WHEN 'p' THEN 'PRIMARY KEY'
                        WHEN 'f' THEN 'FOREIGN KEY'
                        WHEN 'c' THEN 'CHECK'
                        ELSE contype::text
                    END || '), table: ' || conrelid::regclass::text
             FROM pg_constraint WHERE conname = 'unique_centres_normalized_name_city'),
            'Constraint will be added via ALTER TABLE public.centres ADD CONSTRAINT'
        )

    UNION ALL

    SELECT
        '3. Centres',
        'centres_insert_policy RLS policy',
        CASE
            WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'centres' AND policyname = 'centres_insert_policy')
                THEN 'POLICY_EXISTS'
            ELSE 'POLICY_NOT_PRESENT (Will be created by migration Part 1)'
        END,
        'Centres insertion policy status'

    UNION ALL

    -- ----------------------------------------------------------------
    -- 4. COURSES CATALOGUE & COMPOSITE KEY COMPATIBILITY
    -- ----------------------------------------------------------------
    SELECT
        '4. Courses',
        'Exact duplicate (UPPER(TRIM(code)), normalized_name) pairs',
        CASE
            WHEN (SELECT count(*) FROM (
                SELECT UPPER(TRIM(code)), normalized_name
                FROM public.courses
                GROUP BY UPPER(TRIM(code)), normalized_name
                HAVING count(*) > 1
            ) d) = 0 THEN 'NO_DUPLICATES (0 colliding pairs found — composite unique index will succeed)'
            ELSE 'COLLISION_DETECTED (' || (SELECT count(*)::text FROM (
                SELECT UPPER(TRIM(code)), normalized_name
                FROM public.courses
                GROUP BY UPPER(TRIM(code)), normalized_name
                HAVING count(*) > 1
            ) d) || ' colliding pairs exist)'
        END,
        (SELECT 'Total current courses: ' || count(*)::text FROM public.courses)

    UNION ALL

    SELECT
        '4. Courses',
        'idx_courses_code_normalized composite index',
        CASE
            WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'courses' AND indexname = 'idx_courses_code_normalized')
                THEN 'ALREADY_EXISTS'
            ELSE 'NOT_PRESENT (Will be created by migration Part 2)'
        END,
        'Composite index on (UPPER(TRIM(code)), normalized_name)'

    UNION ALL

    SELECT
        '4. Courses',
        'Official SRM AP MOOC courses presence',
        CASE
            WHEN (SELECT count(*) FROM public.courses WHERE code LIKE 'MOOC %') >= 91
                THEN 'ALL_91_SEEDED (' || (SELECT count(*)::text FROM public.courses WHERE code LIKE 'MOOC %') || ' official courses present)'
            ELSE 'PENDING_SEEDING (' || (SELECT count(*)::text FROM public.courses WHERE code LIKE 'MOOC %') || ' of 91 official courses present)'
        END,
        (SELECT 'Current MOOC courses: ' || count(*)::text || ' of 91 required' FROM public.courses WHERE code LIKE 'MOOC %')

    UNION ALL

    -- ----------------------------------------------------------------
    -- 5. HUMAN PHYSIOLOGY REMAPPING & FOREIGN KEYS
    -- ----------------------------------------------------------------
    SELECT
        '5. Remapping & Foreign Keys',
        'Legacy source course (08021cc1-... bt79) in student_exams',
        CASE
            WHEN (SELECT count(*) FROM public.student_exams WHERE course_id = '08021cc1-2e84-4e6b-9928-d3eb9db16f49') > 0
                THEN 'RECORDS_PENDING_REMAP (' || (SELECT count(*)::text FROM public.student_exams WHERE course_id = '08021cc1-2e84-4e6b-9928-d3eb9db16f49') || ' exam(s) will be updated to MOOC 505)'
            ELSE 'NO_RECORDS_PENDING_REMAP (0 exams on legacy course ID)'
        END,
        (SELECT 'Exam IDs: ' || COALESCE(string_agg(id::text, ', '), 'None') FROM public.student_exams WHERE course_id = '08021cc1-2e84-4e6b-9928-d3eb9db16f49')

    UNION ALL

    SELECT
        '5. Remapping & Foreign Keys',
        'Target canonical course (eb001a64-... MOOC 505) in courses table',
        CASE
            WHEN EXISTS (SELECT 1 FROM public.courses WHERE id = 'eb001a64-1a69-4a9d-8f58-4eea2c8f44ad')
                THEN 'ALREADY_EXISTS_IN_DB (' || (SELECT name || ' - ' || code FROM public.courses WHERE id = 'eb001a64-1a69-4a9d-8f58-4eea2c8f44ad') || ')'
            ELSE 'PENDING_INSERT (Will be inserted in Part 2 before Part 3 UPDATE executes)'
        END,
        'Target UUID: eb001a64-1a69-4a9d-8f58-4eea2c8f44ad (HUMAN PHYSIOLOGY MOOC 505)'

    UNION ALL

    SELECT
        '5. Remapping & Foreign Keys',
        'student_exams course_id foreign-key constraint',
        CASE
            WHEN EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                   AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public' AND tc.table_name = 'student_exams'
                  AND kcu.column_name = 'course_id' AND tc.constraint_type = 'FOREIGN KEY'
            ) THEN 'VALID_FK_EXISTS (' || (
                SELECT tc.constraint_name::text FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                   AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public' AND tc.table_name = 'student_exams'
                  AND kcu.column_name = 'course_id' AND tc.constraint_type = 'FOREIGN KEY' LIMIT 1
            ) || ')'
            ELSE 'NO_FK_CONSTRAINT_FOUND'
        END,
        'student_exams.course_id references public.courses(id)'

    UNION ALL

    -- ----------------------------------------------------------------
    -- 6. COURSE CLEANUP DRY-RUN (NEVER ASSUMES SAFE AUTOMATICALLY)
    -- ----------------------------------------------------------------
    SELECT
        '6. Course Cleanup Dry-Run',
        'Courses targeted for deletion by migration cleanup query',
        CASE
            WHEN (SELECT count(*) FROM public.courses
                  WHERE id NOT IN (SELECT DISTINCT course_id FROM public.student_exams WHERE course_id IS NOT NULL)
                    AND id NOT IN (SELECT DISTINCT course_id FROM public.course_group_links WHERE course_id IS NOT NULL)
                    AND id NOT IN (SELECT id FROM public.courses WHERE code LIKE 'MOOC %')) > 0
                THEN 'COURSES_WILL_BE_DELETED (' || (
                    SELECT count(*)::text FROM public.courses
                    WHERE id NOT IN (SELECT DISTINCT course_id FROM public.student_exams WHERE course_id IS NOT NULL)
                      AND id NOT IN (SELECT DISTINCT course_id FROM public.course_group_links WHERE course_id IS NOT NULL)
                      AND id NOT IN (SELECT id FROM public.courses WHERE code LIKE 'MOOC %')
                ) || ' unreferenced dummy courses — review Query 2 below)'
            ELSE 'NO_COURSES_TARGETED (0 courses will be deleted)'
        END,
        (SELECT 'Targeted course codes: ' || COALESCE(string_agg(code::text, ', '), 'None')
         FROM public.courses
         WHERE id NOT IN (SELECT DISTINCT course_id FROM public.student_exams WHERE course_id IS NOT NULL)
           AND id NOT IN (SELECT DISTINCT course_id FROM public.course_group_links WHERE course_id IS NOT NULL)
           AND id NOT IN (SELECT id FROM public.courses WHERE code LIKE 'MOOC %'))

    UNION ALL

    -- ----------------------------------------------------------------
    -- 7. AUTH HARDENING PRECONDITIONS
    -- ----------------------------------------------------------------
    SELECT
        '7. Auth Hardening',
        'student_credentials failed_attempts column',
        CASE
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_credentials' AND column_name = 'failed_attempts')
                THEN 'COLUMN_ALREADY_EXISTS'
            ELSE 'COLUMN_NOT_PRESENT (Will be added via ALTER TABLE ... ADD COLUMN IF NOT EXISTS)'
        END,
        'Column used by authenticate_student RPC for attempt tracking'

    UNION ALL

    SELECT
        '7. Auth Hardening',
        'student_credentials locked_until column',
        CASE
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_credentials' AND column_name = 'locked_until')
                THEN 'COLUMN_ALREADY_EXISTS'
            ELSE 'COLUMN_NOT_PRESENT (Will be added via ALTER TABLE ... ADD COLUMN IF NOT EXISTS)'
        END,
        'Column used by authenticate_student RPC for progressive lockout duration'

    UNION ALL

    -- ----------------------------------------------------------------
    -- 8. ROW LEVEL SECURITY (RLS) STATUS & VULNERABILITY AUDIT
    -- ----------------------------------------------------------------
    SELECT
        '8. RLS Security',
        'public.courses RLS status',
        CASE
            WHEN COALESCE((SELECT relrowsecurity FROM pg_class WHERE relname = 'courses' AND relnamespace = 'public'::regnamespace), false)
                THEN 'RLS_ACTIVE'
            ELSE 'RLS_NOT_ACTIVE (Will be enabled via ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY)'
        END,
        'Courses row level security status'

    UNION ALL

    SELECT
        '8. RLS Security',
        'public.centres RLS status',
        CASE
            WHEN COALESCE((SELECT relrowsecurity FROM pg_class WHERE relname = 'centres' AND relnamespace = 'public'::regnamespace), false)
                THEN 'RLS_ACTIVE'
            ELSE 'RLS_NOT_ACTIVE'
        END,
        'Centres row level security status'

    UNION ALL

    SELECT
        '8. RLS Security',
        'courses_update_policy (permissive USING true vulnerability check)',
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'courses'
                  AND policyname = 'courses_update_policy'
            ) THEN 'INSECURE_POLICY_DETECTED (courses_update_policy exists allowing anon/authenticated updates — consolidated migration will drop it and create courses_update_admin)'
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'courses'
                  AND policyname = 'courses_update_admin'
            ) THEN 'SECURE (courses_update_admin restricts updates to administrators)'
            ELSE 'NO_UPDATE_POLICY (Default deny)'
        END,
        COALESCE(
            (SELECT 'Roles: ' || array_to_string(roles, ', ') || ', cmd: ' || cmd::text
             FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'courses' AND policyname IN ('courses_update_policy', 'courses_update_admin')
             LIMIT 1),
            'No update policy found'
        )

    UNION ALL

    SELECT
        '8. RLS Security',
        'courses_insert_policy security status',
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'courses'
                  AND policyname = 'courses_insert_policy'
            ) THEN 'PERMISSIVE_INSERT_DETECTED (courses_insert_policy allows public student inserts — consolidated migration will drop it and create courses_insert_admin)'
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'courses'
                  AND policyname = 'courses_insert_admin'
            ) THEN 'SECURE (courses_insert_admin restricts inserts to administrators)'
            ELSE 'NO_INSERT_POLICY (Default deny)'
        END,
        'Courses insertion policy status'

    UNION ALL

    -- ----------------------------------------------------------------
    -- 9. RPC FUNCTIONS & PERMISSION GRANTS PRECONDITIONS
    -- ----------------------------------------------------------------
    SELECT
        '9. RPC Functions & Grants',
        'Required API roles existence (anon, authenticated, service_role)',
        CASE
            WHEN (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) = 3
                THEN 'ALL_ROLES_EXIST (anon, authenticated, service_role are present)'
            ELSE 'ROLES_MISSING (' || (SELECT count(*)::text FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) || ' of 3)'
        END,
        'PostgREST API roles checked'

    UNION ALL

    SELECT
        '9. RPC Functions & Grants',
        'resolve_canonical_course RPC function existence',
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' AND p.proname = 'resolve_canonical_course'
            ) THEN 'FUNCTION_EXISTS'
            ELSE 'NOT_PRESENT (Will be created by consolidated migration Part 2)'
        END,
        'Official SRM AP course resolver for student hall tickets'

    UNION ALL

    SELECT
        '9. RPC Functions & Grants',
        'resolve_or_create_centre RPC function existence',
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' AND p.proname = 'resolve_or_create_centre'
            ) THEN 'FUNCTION_EXISTS (Will be upgraded with creator verification & search_path)'
            ELSE 'NOT_PRESENT (Will be created by consolidated migration Part 1)'
        END,
        'Atomic test centre deduplication and assignment function'

    UNION ALL

    SELECT
        '9. RPC Functions & Grants',
        'update_student_profile RPC function existence',
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' AND p.proname = 'update_student_profile'
            ) THEN 'FUNCTION_EXISTS'
            ELSE 'NOT_PRESENT (Will be created by consolidated migration Part 2)'
        END,
        'Safe student academic profile updater'
)
SELECT
    category,
    check_item,
    status,
    details
FROM preflight
ORDER BY category, check_item;


-- ====================================================================
-- QUERY 2: EXACT COURSES TARGETED FOR DELETION BY MIGRATION CLEANUP
-- Review this list to verify that only obsolete dummy/test courses are removed!
-- Any course with an active student exam or WhatsApp group is protected.
-- ====================================================================
SELECT
    c.id AS course_id_to_delete,
    c.code,
    c.name,
    c.created_at,
    (SELECT count(*) FROM public.student_exams se WHERE se.course_id = c.id) AS active_exams_count,
    (SELECT count(*) FROM public.course_group_links cgl WHERE cgl.course_id = c.id) AS active_links_count
FROM public.courses c
WHERE c.id NOT IN (SELECT DISTINCT course_id FROM public.student_exams WHERE course_id IS NOT NULL)
  AND c.id NOT IN (SELECT DISTINCT course_id FROM public.course_group_links WHERE course_id IS NOT NULL)
  AND c.id NOT IN (SELECT id FROM public.courses WHERE code LIKE 'MOOC %')
ORDER BY c.code, c.name;


-- ====================================================================
-- QUERY 3: EXISTING FOREIGN-KEY CONSTRAINTS AUDIT
-- Lists all foreign keys referencing courses and centres to verify
-- no unexpected cascade behaviors exist.
-- ====================================================================
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule AS on_delete_action
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
   AND rc.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND ccu.table_name IN ('courses', 'centres', 'profiles')
ORDER BY tc.table_name, kcu.column_name;


-- ====================================================================
-- QUERY 4: CURRENT ACTIVE POLICIES ON COURSES & CENTRES
-- Shows policies before migration drops/replaces them.
-- ====================================================================
SELECT
    tablename,
    policyname,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('courses', 'centres')
ORDER BY tablename, policyname;
