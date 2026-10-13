-- ====================================================================
-- MoocDeal — SRM DEALINGS
-- Initial Database Migration
-- PostgreSQL / Supabase Schema with Row Level Security & Atomic Functions
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
-- Linked to Supabase auth.users or custom student auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    reg_no VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    branch VARCHAR(30) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    section VARCHAR(20) NOT NULL,
    phone_visible BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on normalized registration number
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_reg_no_unique
    ON public.profiles (UPPER(TRIM(reg_no)));

-- 2. CENTRES TABLE
CREATE TABLE IF NOT EXISTS public.centres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'Andhra Pradesh',
    pincode VARCHAR(10),
    is_verified BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for dynamic centre lookups and duplicate prevention
CREATE INDEX IF NOT EXISTS idx_centres_normalized_city
    ON public.centres (normalized_name, city);

-- 3. COURSES TABLE (NPTEL Course Catalogue)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code_unique
    ON public.courses (UPPER(TRIM(code)));
CREATE INDEX IF NOT EXISTS idx_courses_normalized_name
    ON public.courses (normalized_name);

-- 4. STUDENT_EXAMS TABLE
CREATE TABLE IF NOT EXISTS public.student_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    centre_id UUID REFERENCES public.centres(id) ON DELETE SET NULL,
    exam_date DATE,
    reporting_time TIME,
    exam_start_time TIME,
    shift VARCHAR(10) CHECK (shift IN ('FN', 'AN', NULL)),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_DETAILS' CHECK (status IN ('CONFIRMED', 'PENDING_DETAILS')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_exam UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_exams_matching
    ON public.student_exams (centre_id, exam_date, reporting_time)
    WHERE status = 'CONFIRMED';
CREATE INDEX IF NOT EXISTS idx_student_exams_course
    ON public.student_exams (course_id);

-- 5. EXAM_COHORTS TABLE
-- Unique cohort per centre, date, and reporting time
CREATE TABLE IF NOT EXISTS public.exam_cohorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    centre_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
    exam_date DATE NOT NULL,
    reporting_time TIME NOT NULL,
    whatsapp_group_link TEXT,
    link_submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    link_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_centre_date_reporting_time UNIQUE (centre_id, exam_date, reporting_time)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_lookup
    ON public.exam_cohorts (centre_id, exam_date, reporting_time);

-- 6. COHORT_MEMBERS TABLE
-- Junction table linking students to exam cohorts
CREATE TABLE IF NOT EXISTS public.cohort_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cohort_id UUID NOT NULL REFERENCES public.exam_cohorts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.student_exams(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_cohort_student UNIQUE (cohort_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort
    ON public.cohort_members (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_student
    ON public.cohort_members (student_id);

-- 7. COURSE_GROUP_LINKS TABLE
-- WhatsApp links for course-level study buddies
CREATE TABLE IF NOT EXISTS public.course_group_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    whatsapp_group_link TEXT NOT NULL,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_group_links_course
    ON public.course_group_links (course_id, is_active);

-- 8. LINK_REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.link_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    link_type VARCHAR(20) NOT NULL CHECK (link_type IN ('COHORT', 'COURSE')),
    target_id UUID NOT NULL, -- references exam_cohorts(id) or course_group_links(id)
    whatsapp_link TEXT NOT NULL,
    reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason VARCHAR(30) NOT NULL CHECK (reason IN ('SPAM', 'EXPIRED', 'INAPPROPRIATE', 'WRONG_GROUP')),
    details TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ATOMIC FUNCTIONS & TRIGGERS
-- ====================================================================

-- Function to atomically place student in cohort when exam is CONFIRMED
CREATE OR REPLACE FUNCTION public.handle_student_exam_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_cohort_id UUID;
BEGIN
    -- If exam status changed from CONFIRMED or centre/date/time changed, remove from old cohort
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM public.cohort_members WHERE exam_id = OLD.id;
    END IF;

    -- If newly confirmed with all details
    IF NEW.status = 'CONFIRMED' AND NEW.centre_id IS NOT NULL AND NEW.exam_date IS NOT NULL AND NEW.reporting_time IS NOT NULL THEN
        -- Atomic insert or retrieve existing cohort
        INSERT INTO public.exam_cohorts (centre_id, exam_date, reporting_time)
        VALUES (NEW.centre_id, NEW.exam_date, NEW.reporting_time)
        ON CONFLICT (centre_id, exam_date, reporting_time)
        DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_cohort_id;

        -- Link student to cohort
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_reports ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated students can view other students' matching cards, but only edit own profile
CREATE POLICY "Authenticated users can read profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Centres: Read by all authenticated users; Insert by authenticated; Update only by admins
CREATE POLICY "Centres are viewable by authenticated users"
    ON public.centres FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can submit new centres"
    ON public.centres FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can update centres"
    ON public.centres FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Courses: Read by authenticated users
CREATE POLICY "Courses are viewable by authenticated users"
    ON public.courses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can add courses if not found"
    ON public.courses FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Student Exams: Students manage their own exam records; read permitted for matching
CREATE POLICY "Users can view student exams"
    ON public.student_exams FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage own exams"
    ON public.student_exams FOR ALL
    TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

-- Exam Cohorts: Viewable by authenticated students
CREATE POLICY "Cohorts viewable by authenticated users"
    ON public.exam_cohorts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Cohort link update by members or admins"
    ON public.exam_cohorts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.cohort_members WHERE cohort_id = id AND student_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Cohort Members: Viewable by authenticated
CREATE POLICY "Cohort members viewable by authenticated"
    ON public.cohort_members FOR SELECT
    TO authenticated
    USING (true);

-- Course Group Links: Viewable by authenticated; Manageable by submitter or admin
CREATE POLICY "Course group links viewable by authenticated"
    ON public.course_group_links FOR SELECT
    TO authenticated
    USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Authenticated users can add course links"
    ON public.course_group_links FOR INSERT
    TO authenticated
    WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Submitters or admins can update course links"
    ON public.course_group_links FOR UPDATE
    TO authenticated
    USING (submitted_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Reports: Authenticated students can create reports; Admins can view and resolve
CREATE POLICY "Users can submit reports"
    ON public.link_reports FOR INSERT
    TO authenticated
    WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Admins can view reports"
    ON public.link_reports FOR SELECT
    TO authenticated
    USING (reported_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update reports"
    ON public.link_reports FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ====================================================================
-- SEED DATA (POPULAR ANDHRA PRADESH & TELANGANA NPTEL CENTRES & COURSES)
-- ====================================================================

-- Verified examination centres near SRM University–AP (Amaravati / Guntur / Vijayawada)
INSERT INTO public.centres (name, normalized_name, address, city, state, pincode, is_verified)
VALUES
('iON Digital Zone iDZ Patamata', 'ion digital zone idz patamata', 'Near Benz Circle, High School Road, Patamata', 'Vijayawada', 'Andhra Pradesh', '520010', true),
('iON Digital Zone iDZ Gannavaram', 'ion digital zone idz gannavaram', 'Opp. Airport Road, Gannavaram Mandal', 'Vijayawada', 'Andhra Pradesh', '521101', true),
('iON Digital Zone iDZ Perecherla', 'ion digital zone idz perecherla', 'Narsaraopet Road, Perecherla Village', 'Guntur', 'Andhra Pradesh', '522009', true),
('KL University Exam Centre', 'kl university exam centre', 'Green Fields, Vaddeswaram, Tadepalli Mandal', 'Guntur', 'Andhra Pradesh', '522502', true),
('iON Digital Zone iDZ Moula Ali', 'ion digital zone idz moula ali', 'Near Railway Station, Moula Ali', 'Hyderabad', 'Telangana', '500040', true),
('iON Digital Zone iDZ Karmanghat', 'ion digital zone idz karmanghat', 'Saroornagar Mandal, Karmanghat', 'Hyderabad', 'Telangana', '500079', true)
ON CONFLICT DO NOTHING;

-- Standard NPTEL MOOC Courses popular at SRM AP
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
ON CONFLICT DO NOTHING;
