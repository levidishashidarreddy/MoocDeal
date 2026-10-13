-- ====================================================================
-- MoocDeal — TARGETED PRODUCTION TEST DATA CLEANUP SCRIPT
-- ====================================================================
-- Purpose:
--   Removes the 3 audited dummy/test student accounts and their associated test data:
--     1. AP25110010621 (UUID: 92f1f7e7-df2a-4ef0-9e17-8f08eaa61176) - Name: Master
--     2. AP25110010622 (UUID: 17844ac3-3301-46c4-9a63-244098cb4bee) - Name: Master
--     3. TEST_CHECK    (UUID: 1f6d1906-930d-4ff2-81a2-8d90a5d61367) - Name: Test
--
-- Safety Guarantees:
--   1. Fully atomic: Wrapped in BEGIN; ... COMMIT; transaction block.
--   2. Strict pre-execution assertions: Validates target IDs, dependency counts,
--      and raises an exception immediately if any unexpected record is found.
--   3. Explicit target IDs: Zero broad DELETEs. Every target ID is strictly audited.
--   4. Preserves all real accounts, official MOOC courses, and physical test centres.
--      (Kanuru Village centre is preserved with created_by set to NULL).
--
-- Expected Affected Row Counts:
--   - cohort_members deleted: 2 rows
--   - exam_cohorts deleted:   2 rows (9f9adbb1-... and 7600653a-...)
--   - student_exams deleted:  2 rows (f67d3f6c-... and 1dab94ba-...)
--   - centres updated:        1 row  (bd375635-... created_by set to NULL)
--   - centres deleted:        2 rows (af9019a5-... and 5e75c3c3-... diagnostic test records)
--   - courses deleted:        1 row  (6cbbe869-... legacy mock Deep Learning course)
--   - profiles deleted:       3 rows (92f1f7e7-..., 17844ac3-..., 1f6d1906-...)
-- ====================================================================

BEGIN;

DO $$
DECLARE
    v_profiles_count INT;
    v_exams_count INT;
    v_mems_count INT;
    v_cohorts_count INT;
    v_dl_count INT;
    v_test_centres_count INT;
    v_unexpected_exam_count INT;
    v_unexpected_mem_count INT;
BEGIN
    -- ----------------------------------------------------------------
    -- PRE-EXECUTION SAFETY ASSERTIONS
    -- ----------------------------------------------------------------

    -- 1. Verify exact 3 target dummy profiles exist
    SELECT count(*) INTO v_profiles_count
    FROM public.profiles
    WHERE id IN (
        '92f1f7e7-df2a-4ef0-9e17-8f08eaa61176',
        '17844ac3-3301-46c4-9a63-244098cb4bee',
        '1f6d1906-930d-4ff2-81a2-8d90a5d61367'
    );
    IF v_profiles_count <> 3 THEN
        RAISE EXCEPTION 'SAFETY ABORT: Expected 3 target profiles, but found %.', v_profiles_count;
    END IF;

    -- 2. Verify target cohorts contain NO unexpected student members
    SELECT count(*) INTO v_unexpected_mem_count
    FROM public.cohort_members
    WHERE cohort_id IN (
        '9f9adbb1-8e37-40bd-9ebc-0dc0671cf687',
        '7600653a-bcbd-4de9-b1d5-9ec6d0d68adb'
    )
    AND student_id NOT IN (
        '92f1f7e7-df2a-4ef0-9e17-8f08eaa61176',
        '17844ac3-3301-46c4-9a63-244098cb4bee',
        '1f6d1906-930d-4ff2-81a2-8d90a5d61367'
    );
    IF v_unexpected_mem_count > 0 THEN
        RAISE EXCEPTION 'SAFETY ABORT: Target cohorts contain % unexpected student(s)!', v_unexpected_mem_count;
    END IF;

    -- 3. Verify diagnostic test centres ('PROBE_TEST', 'test') have 0 student exams
    SELECT count(*) INTO v_unexpected_exam_count
    FROM public.student_exams
    WHERE centre_id IN ('af9019a5-0282-4bef-834e-cc7067a45b53', '5e75c3c3-fb26-486e-9639-b6cc5bb8901d');
    IF v_unexpected_exam_count > 0 THEN
        RAISE EXCEPTION 'SAFETY ABORT: Diagnostic centres are referenced by % student exams!', v_unexpected_exam_count;
    END IF;

    -- 4. Verify legacy Deep Learning mock course has NO unexpected student exams
    SELECT count(*) INTO v_unexpected_exam_count
    FROM public.student_exams
    WHERE course_id = '6cbbe869-7464-44da-a19a-7191adac92f1'
      AND student_id NOT IN ('17844ac3-3301-46c4-9a63-244098cb4bee');
    IF v_unexpected_exam_count > 0 THEN
        RAISE EXCEPTION 'SAFETY ABORT: Legacy Deep Learning course is referenced by unexpected exams!';
    END IF;

    RAISE NOTICE 'Pre-execution safety checks PASSED. Proceeding with targeted cleanup...';

    -- ----------------------------------------------------------------
    -- TARGETED CLEANUP STEPS
    -- ----------------------------------------------------------------

    -- Step 1: Remove cohort memberships belonging exclusively to dummy accounts
    DELETE FROM public.cohort_members
    WHERE student_id IN (
        '92f1f7e7-df2a-4ef0-9e17-8f08eaa61176',
        '17844ac3-3301-46c4-9a63-244098cb4bee',
        '1f6d1906-930d-4ff2-81a2-8d90a5d61367'
    );
    GET DIAGNOSTICS v_mems_count = ROW_COUNT;
    RAISE NOTICE 'Step 1: Deleted % cohort_members rows (expected: 2)', v_mems_count;

    -- Step 2: Remove the 2 specific dummy cohorts
    DELETE FROM public.exam_cohorts
    WHERE id IN (
        '9f9adbb1-8e37-40bd-9ebc-0dc0671cf687',
        '7600653a-bcbd-4de9-b1d5-9ec6d0d68adb'
    );
    GET DIAGNOSTICS v_cohorts_count = ROW_COUNT;
    RAISE NOTICE 'Step 2: Deleted % exam_cohorts rows (expected: 2)', v_cohorts_count;

    -- Step 3: Remove student exams belonging to the dummy accounts
    DELETE FROM public.student_exams
    WHERE student_id IN (
        '92f1f7e7-df2a-4ef0-9e17-8f08eaa61176',
        '17844ac3-3301-46c4-9a63-244098cb4bee',
        '1f6d1906-930d-4ff2-81a2-8d90a5d61367'
    );
    GET DIAGNOSTICS v_exams_count = ROW_COUNT;
    RAISE NOTICE 'Step 3: Deleted % student_exams rows (expected: 2)', v_exams_count;

    -- Step 4: Remove student credentials for target accounts
    DELETE FROM public.student_credentials
    WHERE student_id IN (
        '92f1f7e7-df2a-4ef0-9e17-8f08eaa61176',
        '17844ac3-3301-46c4-9a63-244098cb4bee',
        '1f6d1906-930d-4ff2-81a2-8d90a5d61367'
    );
    RAISE NOTICE 'Step 4: Cleaned student_credentials for target accounts';

    -- Step 5: Nullify created_by on Kanuru Village centre (preserves real centre)
    UPDATE public.centres
    SET created_by = NULL
    WHERE id = 'bd375635-ebb1-4b01-b326-bd7c6750c843';
    RAISE NOTICE 'Step 5: Updated Kanuru Village centre created_by to NULL (centre preserved)';

    -- Step 6: Delete the 2 disposable diagnostic test centres
    DELETE FROM public.centres
    WHERE id IN (
        'af9019a5-0282-4bef-834e-cc7067a45b53',
        '5e75c3c3-fb26-486e-9639-b6cc5bb8901d'
    );
    GET DIAGNOSTICS v_test_centres_count = ROW_COUNT;
    RAISE NOTICE 'Step 6: Deleted % diagnostic test centres (expected: 2)', v_test_centres_count;

    -- Step 7: Delete unreferenced legacy mock Deep Learning course
    DELETE FROM public.courses
    WHERE id = '6cbbe869-7464-44da-a19a-7191adac92f1';
    GET DIAGNOSTICS v_dl_count = ROW_COUNT;
    RAISE NOTICE 'Step 7: Deleted % legacy mock courses (expected: 1)', v_dl_count;

    -- Step 8: Delete dummy student profiles
    DELETE FROM public.profiles
    WHERE id IN (
        '92f1f7e7-df2a-4ef0-9e17-8f08eaa61176',
        '17844ac3-3301-46c4-9a63-244098cb4bee',
        '1f6d1906-930d-4ff2-81a2-8d90a5d61367'
    );
    GET DIAGNOSTICS v_profiles_count = ROW_COUNT;
    RAISE NOTICE 'Step 8: Deleted % profiles rows (expected: 3)', v_profiles_count;

    -- Step 9: Clean up auth.users if matching records exist
    DELETE FROM auth.users
    WHERE id IN (
        '92f1f7e7-df2a-4ef0-9e17-8f08eaa61176',
        '17844ac3-3301-46c4-9a63-244098cb4bee',
        '1f6d1906-930d-4ff2-81a2-8d90a5d61367'
    );
    RAISE NOTICE 'Step 9: Cleaned matching auth.users records';

    RAISE NOTICE '=== TARGETED CLEANUP COMPLETED SUCCESSFULLY ===';
END $$;

COMMIT;
