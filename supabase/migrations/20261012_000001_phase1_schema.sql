-- ====================================================================
-- MoocDeal — SRM DEALINGS
-- PHASE 1: CORE DATABASE SCHEMA, RLS POLICIES & ATOMIC FUNCTIONS
-- ====================================================================

-- Enable pgcrypto / uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. PROFILES TABLE
-- Linked 1-to-1 with Supabase auth.users(id)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    reg_no VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    branch VARCHAR(30) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    section VARCHAR(20) NOT NULL,
    phone_visible BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_profiles_reg_no UNIQUE (reg_no)
);

-- Case-insensitive trimmed unique index on registration number
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_reg_no_upper
    ON public.profiles (UPPER(TRIM(reg_no)));

-- ====================================================================
-- 2. CENTRES TABLE
-- Dynamic exam centres (verified or student suggestions)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.centres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'Andhra Pradesh',
    pincode VARCHAR(10),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_centres_normalized_city
    ON public.centres (normalized_name, city);
CREATE INDEX IF NOT EXISTS idx_centres_city
    ON public.centres (city);
CREATE INDEX IF NOT EXISTS idx_centres_verified
    ON public.centres (is_verified);

-- ====================================================================
-- 3. COURSES TABLE
-- Canonical NPTEL MOOC course catalogue
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_courses_code UNIQUE (code)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code_upper
    ON public.courses (UPPER(TRIM(code)));
CREATE INDEX IF NOT EXISTS idx_courses_normalized_name
    ON public.courses (normalized_name);

-- ====================================================================
-- 4. STUDENT_EXAMS TABLE
-- Student enrolled exams (CONFIRMED or PENDING_DETAILS)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.student_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    centre_id UUID REFERENCES public.centres(id) ON DELETE SET NULL,
    exam_date DATE,
    reporting_time TIME,
    exam_start_time TIME,
    shift VARCHAR(10) CHECK (shift IN ('FN', 'AN', NULL)),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_DETAILS' CHECK (status IN ('CONFIRMED', 'PENDING_DETAILS')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_exam UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_exams_match
    ON public.student_exams (centre_id, exam_date, reporting_time)
    WHERE status = 'CONFIRMED';
CREATE INDEX IF NOT EXISTS idx_student_exams_student
    ON public.student_exams (student_id);
CREATE INDEX IF NOT EXISTS idx_student_exams_course
    ON public.student_exams (course_id);
CREATE INDEX IF NOT EXISTS idx_student_exams_status
    ON public.student_exams (status);

-- ====================================================================
-- 5. EXAM_COHORTS TABLE
-- Unique cohorts per (centre_id, exam_date, reporting_time)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.exam_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
    exam_date DATE NOT NULL,
    reporting_time TIME NOT NULL,
    whatsapp_group_link TEXT,
    link_submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    link_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_cohort_venue_slot UNIQUE (centre_id, exam_date, reporting_time)
);

CREATE INDEX IF NOT EXISTS idx_exam_cohorts_lookup
    ON public.exam_cohorts (centre_id, exam_date, reporting_time);
CREATE INDEX IF NOT EXISTS idx_exam_cohorts_date
    ON public.exam_cohorts (exam_date);

-- ====================================================================
-- 6. COHORT_MEMBERS TABLE
-- Junction table: students in each cohort
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.cohort_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES public.exam_cohorts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.student_exams(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_cohort_student_member UNIQUE (cohort_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort
    ON public.cohort_members (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_student
    ON public.cohort_members (student_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_exam
    ON public.cohort_members (exam_id);

-- ====================================================================
-- 7. COURSE_GROUP_LINKS TABLE
-- WhatsApp study groups for course-level peer discovery
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.course_group_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    whatsapp_group_link TEXT NOT NULL,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_group_links_course
    ON public.course_group_links (course_id, is_active);

-- ====================================================================
-- 8. REPORTS TABLE
-- Community moderation queue for broken/spam/inappropriate links
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_type VARCHAR(20) NOT NULL CHECK (link_type IN ('COHORT', 'COURSE')),
    target_id UUID NOT NULL,
    whatsapp_link TEXT NOT NULL,
    reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason VARCHAR(30) NOT NULL CHECK (reason IN ('SPAM', 'EXPIRED', 'INAPPROPRIATE', 'WRONG_GROUP')),
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status
    ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter
    ON public.reports (reported_by);

-- Backward compatibility view for link_reports
CREATE OR REPLACE VIEW public.link_reports AS
    SELECT * FROM public.reports;

-- ====================================================================
-- 9. TIMESTAMPS & UPDATED_AT TRIGGER
-- Automatically updates updated_at timestamp on row modification
-- ====================================================================
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_centres_updated_at ON public.centres;
CREATE TRIGGER trg_centres_updated_at BEFORE UPDATE ON public.centres
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_student_exams_updated_at ON public.student_exams;
CREATE TRIGGER trg_student_exams_updated_at BEFORE UPDATE ON public.student_exams
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_exam_cohorts_updated_at ON public.exam_cohorts;
CREATE TRIGGER trg_exam_cohorts_updated_at BEFORE UPDATE ON public.exam_cohorts
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_course_group_links_updated_at ON public.course_group_links;
CREATE TRIGGER trg_course_group_links_updated_at BEFORE UPDATE ON public.course_group_links
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ====================================================================
-- 10. ATOMIC FUNCTION: SYNC CONFIRMED EXAM TO COHORT
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_student_exam_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_cohort_id UUID;
BEGIN
    -- If exam status changed or centre/date/time changed on update, cleanup old cohort membership
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM public.cohort_members WHERE exam_id = OLD.id;
    END IF;

    -- If CONFIRMED with required slot details, atomically link to exam_cohorts
    IF NEW.status = 'CONFIRMED' AND NEW.centre_id IS NOT NULL AND NEW.exam_date IS NOT NULL AND NEW.reporting_time IS NOT NULL THEN
        -- Atomic insert or fetch existing cohort
        INSERT INTO public.exam_cohorts (centre_id, exam_date, reporting_time)
        VALUES (NEW.centre_id, NEW.exam_date, NEW.reporting_time)
        ON CONFLICT (centre_id, exam_date, reporting_time)
        DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_cohort_id;

        -- Link student to cohort members
        INSERT INTO public.cohort_members (cohort_id, student_id, exam_id)
        VALUES (v_cohort_id, NEW.student_id, NEW.id)
        ON CONFLICT (cohort_id, student_id) DO UPDATE SET exam_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_student_exam ON public.student_exams;
CREATE TRIGGER trigger_sync_student_exam
AFTER INSERT OR UPDATE ON public.student_exams
FOR EACH ROW
EXECUTE FUNCTION public.handle_student_exam_sync();

-- ====================================================================
-- 10.1 ATOMIC RPC FUNCTION: SYNC STUDENT EXAM AND COHORT
-- Concurrency-safe procedure to resolve/create cohorts and memberships
-- ====================================================================
CREATE OR REPLACE FUNCTION public.sync_student_exam_and_cohort(
    p_student_id UUID,
    p_course_id UUID,
    p_centre_id UUID DEFAULT NULL,
    p_exam_date DATE DEFAULT NULL,
    p_reporting_time TIME DEFAULT NULL,
    p_exam_start_time TIME DEFAULT NULL,
    p_shift VARCHAR DEFAULT NULL,
    p_status VARCHAR DEFAULT 'PENDING_DETAILS'
)
RETURNS JSONB AS $$
DECLARE
    v_cohort_id UUID;
    v_exam_id UUID;
    v_result JSONB;
BEGIN
    -- Verify student authorization: callers must be updating their own record unless admin
    IF auth.uid() IS NOT NULL AND auth.uid() != p_student_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
            RAISE EXCEPTION 'Unauthorized: Cannot modify other student exam records';
        END IF;
    END IF;

    IF p_status = 'CONFIRMED' THEN
        IF p_centre_id IS NULL OR p_exam_date IS NULL OR p_reporting_time IS NULL THEN
            RAISE EXCEPTION 'Confirmed exam requires centre_id, exam_date, and reporting_time';
        END IF;

        -- Concurrency-safe atomic insert/fetch of cohort
        INSERT INTO public.exam_cohorts (centre_id, exam_date, reporting_time)
        VALUES (p_centre_id, p_exam_date, p_reporting_time)
        ON CONFLICT (centre_id, exam_date, reporting_time)
        DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_cohort_id;

        -- Concurrency-safe upsert of student_exams (strictly one exam per student)
        INSERT INTO public.student_exams (
            student_id, course_id, centre_id, exam_date, reporting_time, exam_start_time, shift, status, updated_at
        )
        VALUES (
            p_student_id, p_course_id, p_centre_id, p_exam_date, p_reporting_time, p_exam_start_time, p_shift, 'CONFIRMED', NOW()
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

        -- Remove from any prior different cohort membership
        DELETE FROM public.cohort_members
        WHERE student_id = p_student_id AND cohort_id != v_cohort_id;

        -- Link to active cohort
        INSERT INTO public.cohort_members (cohort_id, student_id, exam_id)
        VALUES (v_cohort_id, p_student_id, v_exam_id)
        ON CONFLICT (cohort_id, student_id)
        DO UPDATE SET exam_id = v_exam_id;

    ELSE
        -- PENDING_DETAILS: Course-only participation, no invented exam details
        INSERT INTO public.student_exams (
            student_id, course_id, centre_id, exam_date, reporting_time, exam_start_time, shift, status, updated_at
        )
        VALUES (
            p_student_id, p_course_id, NULL, NULL, NULL, NULL, NULL, 'PENDING_DETAILS', NOW()
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

        -- Remove any previous cohort membership since slot is unconfirmed
        DELETE FROM public.cohort_members WHERE student_id = p_student_id;
        v_cohort_id := NULL;
    END IF;

    SELECT jsonb_build_object(
        'exam_id', v_exam_id,
        'student_id', p_student_id,
        'course_id', p_course_id,
        'cohort_id', v_cohort_id,
        'status', p_status
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict policies ensuring data isolation and privacy
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 11.1 PROFILES POLICIES
-- Authenticated students can view other profiles (necessary for peer buddy cards)
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Students can ONLY insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Students can ONLY update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 11.2 CENTRES POLICIES
-- All authenticated students can read centres
DROP POLICY IF EXISTS "Centres viewable by authenticated users" ON public.centres;
CREATE POLICY "Centres viewable by authenticated users"
    ON public.centres FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated students can suggest new centres (pending admin verification)
DROP POLICY IF EXISTS "Students can suggest new centres" ON public.centres;
CREATE POLICY "Students can suggest new centres"
    ON public.centres FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Only admins can verify, edit, or delete centres
DROP POLICY IF EXISTS "Admins can update centres" ON public.centres;
CREATE POLICY "Admins can update centres"
    ON public.centres FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can delete centres" ON public.centres;
CREATE POLICY "Admins can delete centres"
    ON public.centres FOR DELETE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 11.3 COURSES POLICIES
DROP POLICY IF EXISTS "Courses viewable by authenticated" ON public.courses;
CREATE POLICY "Courses viewable by authenticated"
    ON public.courses FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated can insert new courses" ON public.courses;
CREATE POLICY "Authenticated can insert new courses"
    ON public.courses FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update courses" ON public.courses;
CREATE POLICY "Admins can update courses"
    ON public.courses FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 11.4 STUDENT_EXAMS POLICIES
-- Authenticated users can view exams for matching purposes
DROP POLICY IF EXISTS "Authenticated can view exams" ON public.student_exams;
CREATE POLICY "Authenticated can view exams"
    ON public.student_exams FOR SELECT
    TO authenticated
    USING (true);

-- Students can ONLY manage their own exam registrations
DROP POLICY IF EXISTS "Students can insert own exams" ON public.student_exams;
CREATE POLICY "Students can insert own exams"
    ON public.student_exams FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update own exams" ON public.student_exams;
CREATE POLICY "Students can update own exams"
    ON public.student_exams FOR UPDATE
    TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can delete own exams" ON public.student_exams;
CREATE POLICY "Students can delete own exams"
    ON public.student_exams FOR DELETE
    TO authenticated
    USING (student_id = auth.uid());

-- 11.5 EXAM_COHORTS POLICIES
DROP POLICY IF EXISTS "Cohorts viewable by authenticated" ON public.exam_cohorts;
CREATE POLICY "Cohorts viewable by authenticated"
    ON public.exam_cohorts FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated can create cohorts" ON public.exam_cohorts;
CREATE POLICY "Authenticated can create cohorts"
    ON public.exam_cohorts FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Cohort members or admins can update the WhatsApp link
DROP POLICY IF EXISTS "Cohort members or admins can update cohort link" ON public.exam_cohorts;
CREATE POLICY "Cohort members or admins can update cohort link"
    ON public.exam_cohorts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.cohort_members WHERE cohort_id = id AND student_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- 11.6 COHORT_MEMBERS POLICIES
DROP POLICY IF EXISTS "Cohort members viewable by authenticated" ON public.cohort_members;
CREATE POLICY "Cohort members viewable by authenticated"
    ON public.cohort_members FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Students can join cohort as self" ON public.cohort_members;
CREATE POLICY "Students can join cohort as self"
    ON public.cohort_members FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can leave cohort as self" ON public.cohort_members;
CREATE POLICY "Students can leave cohort as self"
    ON public.cohort_members FOR DELETE
    TO authenticated
    USING (student_id = auth.uid());

-- 11.7 COURSE_GROUP_LINKS POLICIES
DROP POLICY IF EXISTS "Course group links viewable" ON public.course_group_links;
CREATE POLICY "Course group links viewable"
    ON public.course_group_links FOR SELECT
    TO authenticated
    USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Students can submit course links" ON public.course_group_links;
CREATE POLICY "Students can submit course links"
    ON public.course_group_links FOR INSERT
    TO authenticated
    WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "Submitter or admin can update course link" ON public.course_group_links;
CREATE POLICY "Submitter or admin can update course link"
    ON public.course_group_links FOR UPDATE
    TO authenticated
    USING (submitted_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 11.8 REPORTS POLICIES
-- Students can view reports they submitted; admins can view all reports
DROP POLICY IF EXISTS "Reports viewable by submitter or admin" ON public.reports;
CREATE POLICY "Reports viewable by submitter or admin"
    ON public.reports FOR SELECT
    TO authenticated
    USING (reported_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Students can submit reports" ON public.reports;
CREATE POLICY "Students can submit reports"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (reported_by = auth.uid());

-- Only admins can resolve or dismiss reports
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
    ON public.reports FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ====================================================================
-- 12. INITIAL SEED DATA
-- Popular Andhra Pradesh / Telangana NPTEL Exam Centres & SRM AP Courses
-- ====================================================================

INSERT INTO public.centres (name, normalized_name, address, city, state, pincode, is_verified)
VALUES
('iON Digital Zone iDZ Patamata', 'ion digital zone idz patamata', 'Near Benz Circle, High School Road, Patamata', 'Vijayawada', 'Andhra Pradesh', '520010', true),
('iON Digital Zone iDZ Gannavaram', 'ion digital zone idz gannavaram', 'Opp. Airport Road, Gannavaram Mandal', 'Vijayawada', 'Andhra Pradesh', '521101', true),
('iON Digital Zone iDZ Perecherla', 'ion digital zone idz perecherla', 'Narsaraopet Road, Perecherla Village', 'Guntur', 'Andhra Pradesh', '522009', true),
('KL University Exam Centre', 'kl university exam centre', 'Green Fields, Vaddeswaram, Tadepalli Mandal', 'Guntur', 'Andhra Pradesh', '522502', true),
('iON Digital Zone iDZ Moula Ali', 'ion digital zone idz moula ali', 'Near Railway Station, Moula Ali', 'Hyderabad', 'Telangana', '500040', true),
('iON Digital Zone iDZ Karmanghat', 'ion digital zone idz karmanghat', 'Saroornagar Mandal, Karmanghat', 'Hyderabad', 'Telangana', '500079', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.courses (code, name, normalized_name)
VALUES
('noc24-cs101', 'Deep Learning', 'deep learning'),
('noc24-cs102', 'Cloud Computing', 'cloud computing'),
('noc24-cs103', 'Problem Solving Through Programming In C', 'problem solving through programming in c'),
('noc24-cs104', 'Database Management System', 'database management system'),
('noc24-cs105', 'Design and Analysis of Algorithms', 'design and analysis of algorithms'),
('noc24-ee101', 'Digital Circuits', 'digital circuits'),
('noc24-mg101', 'Principles of Management', 'principles of management'),
('noc24-cs108', 'Python for Data Science', 'python for data science')
ON CONFLICT (code) DO NOTHING;
