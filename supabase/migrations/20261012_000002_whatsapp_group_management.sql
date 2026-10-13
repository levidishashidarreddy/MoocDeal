-- ====================================================================
-- MoocDeal — Supabase Database Migration
-- Phase: WhatsApp Group Link Management, Rate Limiting & RLS Access Control
-- Migration: 20261012_000002_whatsapp_group_management.sql
-- ====================================================================

-- 1. URL FORMAT CONSTRAINTS
-- Enforce strict WhatsApp group invite link formats (https://chat.whatsapp.com/...)
ALTER TABLE public.course_group_links
    DROP CONSTRAINT IF EXISTS check_course_whatsapp_link_format;

ALTER TABLE public.course_group_links
    ADD CONSTRAINT check_course_whatsapp_link_format
    CHECK (whatsapp_group_link ~* '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{20,32}$');

ALTER TABLE public.exam_cohorts
    DROP CONSTRAINT IF EXISTS check_cohort_whatsapp_link_format;

ALTER TABLE public.exam_cohorts
    ADD CONSTRAINT check_cohort_whatsapp_link_format
    CHECK (whatsapp_group_link IS NULL OR whatsapp_group_link ~* '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{20,32}$');

-- 2. RATE LIMITS TABLE & MECHANISM
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action
    ON public.rate_limits (user_id, action_type, created_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits table is purely managed via SECURITY DEFINER functions
DROP POLICY IF EXISTS "Rate limits restricted" ON public.rate_limits;
CREATE POLICY "Rate limits restricted"
    ON public.rate_limits
    TO authenticated
    USING (false);

-- Helper function to check and record rate limits
CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
    p_user_id UUID,
    p_action VARCHAR(50),
    p_max_requests INT,
    p_window_seconds INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INT;
    v_window_start TIMESTAMPTZ;
BEGIN
    v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

    SELECT COUNT(*) INTO v_count
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action_type = p_action
      AND created_at >= v_window_start;

    IF v_count >= p_max_requests THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.rate_limits (user_id, action_type, created_at)
    VALUES (p_user_id, p_action, NOW());

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFINED ROW LEVEL SECURITY POLICIES

-- 3.1 COURSE_GROUP_LINKS POLICIES
-- Show course group links ONLY to verified students enrolled in the matching course
DROP POLICY IF EXISTS "Course group links viewable" ON public.course_group_links;
DROP POLICY IF EXISTS "Course group links viewable by enrolled verified students" ON public.course_group_links;
CREATE POLICY "Course group links viewable by enrolled verified students"
    ON public.course_group_links FOR SELECT
    TO authenticated
    USING (
        is_active = true AND (
            EXISTS (
                SELECT 1 FROM public.student_exams se
                JOIN public.profiles p ON p.id = se.student_id
                WHERE se.course_id = course_group_links.course_id
                  AND se.student_id = auth.uid()
                  AND p.is_verified = true
            )
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.is_admin = true
            )
        )
    );

-- Verified enrolled students can submit links
DROP POLICY IF EXISTS "Students can submit course links" ON public.course_group_links;
DROP POLICY IF EXISTS "Verified enrolled students can submit course links" ON public.course_group_links;
CREATE POLICY "Verified enrolled students can submit course links"
    ON public.course_group_links FOR INSERT
    TO authenticated
    WITH CHECK (
        submitted_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.student_exams se
            JOIN public.profiles p ON p.id = se.student_id
            WHERE se.course_id = course_group_links.course_id
              AND se.student_id = auth.uid()
              AND p.is_verified = true
        )
    );

-- Submitter or admin can edit/replace or deactivate their own link
DROP POLICY IF EXISTS "Submitter or admin can update course link" ON public.course_group_links;
DROP POLICY IF EXISTS "Submitter or admin can edit course link" ON public.course_group_links;
CREATE POLICY "Submitter or admin can edit course link"
    ON public.course_group_links FOR UPDATE
    TO authenticated
    USING (
        submitted_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- 3.2 EXAM_COHORTS POLICIES FOR WHATSAPP LINK UPDATES
-- Only verified members of the cohort can update the WhatsApp link,
-- and only if they created it, or if it is currently unset, or if they are admin.
DROP POLICY IF EXISTS "Cohort members or admins can update cohort link" ON public.exam_cohorts;
DROP POLICY IF EXISTS "Verified cohort members can update cohort link" ON public.exam_cohorts;
CREATE POLICY "Verified cohort members can update cohort link"
    ON public.exam_cohorts FOR UPDATE
    TO authenticated
    USING (
        (
            EXISTS (
                SELECT 1 FROM public.cohort_members cm
                JOIN public.profiles p ON p.id = cm.student_id
                WHERE cm.cohort_id = id
                  AND cm.student_id = auth.uid()
                  AND p.is_verified = true
            )
            AND (
                link_submitted_by IS NULL
                OR link_submitted_by = auth.uid()
            )
        )
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- 3.3 REPORTS POLICIES
DROP POLICY IF EXISTS "Students can submit reports" ON public.reports;
DROP POLICY IF EXISTS "Verified students can submit reports" ON public.reports;
CREATE POLICY "Verified students can submit reports"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (
        reported_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_verified = true
        )
    );

-- 4. SECURE FUNCTIONS FOR COHORT LINK PRIVACY & ATOMIC OPERATIONS

-- Secure function to get cohort WhatsApp link only if authorized
CREATE OR REPLACE FUNCTION public.get_cohort_whatsapp_link(p_cohort_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link TEXT;
    v_is_eligible BOOLEAN;
BEGIN
    SELECT (
        EXISTS (
            SELECT 1 FROM public.cohort_members cm
            JOIN public.profiles p ON p.id = cm.student_id
            WHERE cm.cohort_id = p_cohort_id
              AND cm.student_id = auth.uid()
              AND p.is_verified = true
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = true
        )
    ) INTO v_is_eligible;

    IF NOT v_is_eligible THEN
        RETURN NULL;
    END IF;

    SELECT whatsapp_group_link INTO v_link
    FROM public.exam_cohorts
    WHERE id = p_cohort_id;

    RETURN v_link;
END;
$$;

-- Atomic RPC to submit or update cohort WhatsApp link
CREATE OR REPLACE FUNCTION public.submit_or_update_cohort_whatsapp_link(
    p_cohort_id UUID,
    p_link TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_member BOOLEAN;
    v_is_admin BOOLEAN;
    v_existing_submitter UUID;
    v_clean_link TEXT;
    v_rate_ok BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_clean_link := TRIM(p_link);
    IF v_clean_link !~* '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{20,32}$' THEN
        RAISE EXCEPTION 'Invalid WhatsApp group invite link format.';
    END IF;

    -- Check rate limit: 5 submissions per 10 minutes (600 seconds)
    v_rate_ok := public.check_and_record_rate_limit(v_user_id, 'cohort_link', 5, 600);
    IF NOT v_rate_ok THEN
        RAISE EXCEPTION 'Rate limit reached: Too many link updates. Please wait before trying again.';
    END IF;

    -- Check admin status
    SELECT is_admin INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;

    -- Check membership & verification
    SELECT EXISTS (
        SELECT 1 FROM public.cohort_members cm
        JOIN public.profiles p ON p.id = cm.student_id
        WHERE cm.cohort_id = p_cohort_id
          AND cm.student_id = v_user_id
          AND p.is_verified = true
    ) INTO v_is_member;

    IF NOT (v_is_member OR COALESCE(v_is_admin, false)) THEN
        RAISE EXCEPTION 'Only verified students taking their exam in this slot can share or update the WhatsApp group.';
    END IF;

    -- Check authorship
    SELECT link_submitted_by INTO v_existing_submitter
    FROM public.exam_cohorts
    WHERE id = p_cohort_id;

    IF v_existing_submitter IS NOT NULL
       AND v_existing_submitter <> v_user_id
       AND NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'This link was shared by a peer. Only the author or an administrator can edit or replace it. If the link is invalid, please submit a report.';
    END IF;

    -- Update cohort link
    UPDATE public.exam_cohorts
    SET whatsapp_group_link = v_clean_link,
        link_submitted_by = v_user_id,
        link_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_cohort_id;

    RETURN jsonb_build_object(
        'success', true,
        'cohort_id', p_cohort_id,
        'whatsapp_group_link', v_clean_link,
        'link_submitted_by', v_user_id
    );
END;
$$;

-- Atomic RPC to submit or update course WhatsApp link
CREATE OR REPLACE FUNCTION public.submit_or_update_course_whatsapp_link(
    p_course_id UUID,
    p_link TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_enrolled BOOLEAN;
    v_is_admin BOOLEAN;
    v_clean_link TEXT;
    v_rate_ok BOOLEAN;
    v_existing_active RECORD;
    v_new_link_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_clean_link := TRIM(p_link);
    IF v_clean_link !~* '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{20,32}$' THEN
        RAISE EXCEPTION 'Invalid WhatsApp group invite link format.';
    END IF;

    -- Check rate limit: 5 submissions per 10 minutes (600 seconds)
    v_rate_ok := public.check_and_record_rate_limit(v_user_id, 'course_link', 5, 600);
    IF NOT v_rate_ok THEN
        RAISE EXCEPTION 'Rate limit reached: Too many link updates. Please wait before trying again.';
    END IF;

    SELECT is_admin INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;

    -- Check enrollment and verification
    SELECT EXISTS (
        SELECT 1 FROM public.student_exams se
        JOIN public.profiles p ON p.id = se.student_id
        WHERE se.course_id = p_course_id
          AND se.student_id = v_user_id
          AND p.is_verified = true
    ) INTO v_is_enrolled;

    IF NOT (v_is_enrolled OR COALESCE(v_is_admin, false)) THEN
        RAISE EXCEPTION 'Only verified students enrolled in this course can share or update the course WhatsApp group.';
    END IF;

    -- Check if active link exists
    SELECT id, submitted_by INTO v_existing_active
    FROM public.course_group_links
    WHERE course_id = p_course_id AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_active.id IS NOT NULL
       AND v_existing_active.submitted_by <> v_user_id
       AND NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'An active study group link has already been shared by another student. Only the link author or an admin can edit or replace it. If it is broken or inappropriate, please use the Report button.';
    END IF;

    -- Deactivate old active links
    UPDATE public.course_group_links
    SET is_active = false,
        updated_at = NOW()
    WHERE course_id = p_course_id AND is_active = true;

    -- Insert new active link
    INSERT INTO public.course_group_links (
        course_id,
        whatsapp_group_link,
        submitted_by,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        p_course_id,
        v_clean_link,
        v_user_id,
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO v_new_link_id;

    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_new_link_id,
        'course_id', p_course_id,
        'whatsapp_group_link', v_clean_link,
        'submitted_by', v_user_id
    );
END;
$$;

-- Atomic RPC to report a link with rate limiting and duplicate checking
CREATE OR REPLACE FUNCTION public.report_whatsapp_link(
    p_link_type VARCHAR,
    p_target_id UUID,
    p_whatsapp_link TEXT,
    p_reason VARCHAR,
    p_details TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_rate_ok BOOLEAN;
    v_already_reported BOOLEAN;
    v_report_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_reason NOT IN ('SPAM', 'EXPIRED', 'INAPPROPRIATE', 'WRONG_GROUP') THEN
        RAISE EXCEPTION 'Invalid report reason.';
    END IF;

    -- Rate limit: max 3 reports per 10 minutes (600 seconds)
    v_rate_ok := public.check_and_record_rate_limit(v_user_id, 'report', 3, 600);
    IF NOT v_rate_ok THEN
        RAISE EXCEPTION 'Rate limit reached: Too many reports submitted recently. Please wait before submitting another report.';
    END IF;

    -- Check if this student already has a pending report on this target
    SELECT EXISTS (
        SELECT 1 FROM public.reports
        WHERE reported_by = v_user_id
          AND target_id = p_target_id
          AND status = 'PENDING'
    ) INTO v_already_reported;

    IF v_already_reported THEN
        RAISE EXCEPTION 'You have already submitted a pending report for this group link. Community moderators will review it shortly.';
    END IF;

    INSERT INTO public.reports (
        link_type,
        target_id,
        whatsapp_link,
        reported_by,
        reason,
        details,
        status,
        created_at,
        updated_at
    ) VALUES (
        p_link_type,
        p_target_id,
        p_whatsapp_link,
        v_user_id,
        p_reason,
        p_details,
        'PENDING',
        NOW(),
        NOW()
    ) RETURNING id INTO v_report_id;

    RETURN jsonb_build_object(
        'success', true,
        'report_id', v_report_id,
        'status', 'PENDING'
    );
END;
$$;
