-- MoocDeal Migration: Official SRM AP MOOC Course Catalogue
-- Single source of truth from official university administration
-- Seeds exactly 91 official courses idempotently
-- Enforces strict catalog constraints and RLS (no student-created courses)

-- 1. Relax old single-column unique constraints to accommodate official MOOC list
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_courses_code') THEN
        ALTER TABLE public.courses DROP CONSTRAINT unique_courses_code;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_courses_normalized_name') THEN
        ALTER TABLE public.courses DROP CONSTRAINT unique_courses_normalized_name;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_courses_code_upper') THEN
        DROP INDEX IF EXISTS public.idx_courses_code_upper;
    END IF;
END $$;

-- 2. Create composite unique index for official MOOC code and normalized name
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code_normalized
    ON public.courses (UPPER(TRIM(code)), normalized_name);

-- 3. Idempotently insert/update the official 91 SRM AP courses
INSERT INTO public.courses (id, code, name, normalized_name, organiser_status, created_at, updated_at)
VALUES
  ('8f123057-59eb-4574-8544-1d658d1b0c74', 'MOOC 495', 'INTRODUCTION TO MACHINE LEARNING', 'introduction to machine learning', 'NONE', NOW(), NOW()),
  ('f583249d-b7ea-4e05-8520-f7d7ab8d23cf', 'MOOC 496', 'POWER ELECTRONICS WITH WIDE BAND GAP DEVICES', 'power electronics with wide band gap devices', 'NONE', NOW(), NOW()),
  ('c2582d7b-1d13-4cca-8bb0-52bfc154f6ca', 'MOOC 497', 'INTRODUCTION TO MULTI-AGENT SYSTEMS', 'introduction to multi agent systems', 'NONE', NOW(), NOW()),
  ('cfa7bc83-ce07-4e40-82cc-ac2955b03aff', 'MOOC 498', 'CONVEX OPTIMIZATION IN CONTROL', 'convex optimization in control', 'NONE', NOW(), NOW()),
  ('04722529-7db5-47c5-8083-6fc7ad72f7a4', 'MOOC 499', 'CONTROL AND TUNING METHODS IN SWITCHED MODE POWER CONVERTERS', 'control and tuning methods in switched mode power converters', 'NONE', NOW(), NOW()),
  ('6929a854-1ad0-44f6-8000-112d28723a23', 'MOOC 500', 'ELECTRONIC SYSTEMS DESIGN: HANDS-ON CIRCUITS AND PCB DESIGN WITH CAD SOFTWARE', 'electronic systems design hands on circuits and pcb design with cad software', 'NONE', NOW(), NOW()),
  ('77d37138-88db-40a1-86dd-6565222637f9', 'MOOC 501', 'LINE COMMUTATED AND PWM RECTIFIERS', 'line commutated and pwm rectifiers', 'NONE', NOW(), NOW()),
  ('63f5d8fe-4318-43f2-8271-9fb1c18d3c20', 'MOOC 502', 'POWER ELECTRONICS APPLICATIONS IN POWER SYSTEMS', 'power electronics applications in power systems', 'NONE', NOW(), NOW()),
  ('8da96c6f-86ba-4475-8a10-adc99ad1a091', 'MOOC 503', 'MODELING AND TCAD SIMULATION OF SOLAR PV CELL', 'modeling and tcad simulation of solar pv cell', 'NONE', NOW(), NOW()),
  ('95b8bc99-ed57-41eb-8019-b429c0f67921', 'MOOC 504', 'ELECTRIC VEHICLE: ITS COMPONENTS, CHARGING INFRASTRUCTURE AND GRID INTEGRATION SOLUTION', 'electric vehicle its components charging infrastructure and grid integration solution', 'NONE', NOW(), NOW()),
  ('d123d9e2-5d94-46a5-82da-697882171192', 'MOOC 505', 'SLIDING MODE CONTROL AND APPLICATIONS', 'sliding mode control and applications', 'NONE', NOW(), NOW()),
  ('b3aa4bb0-caf3-467a-8bef-5f592f04cc76', 'MOOC 506', 'DRONE SYSTEMS AND CONTROL', 'drone systems and control', 'NONE', NOW(), NOW()),
  ('8afeefc9-3dcf-4947-83ff-a349067cc406', 'MOOC 507', 'SUSTAINABLE ENGINEERING CONCEPTS AND LIFE CYCLE ANALYSIS', 'sustainable engineering concepts and life cycle analysis', 'NONE', NOW(), NOW()),
  ('55c95c23-80ed-424f-84ec-9f37c358ac14', 'MOOC 508', 'REMOTE SENSING AND GIS', 'remote sensing and gis', 'NONE', NOW(), NOW()),
  ('cda597e3-23b6-40e8-8101-db0c90afef68', 'MOOC 509', 'CARBON ACCOUNTING AND SUSTAINABLE DESIGNS IN PRODUCT LIFECYCLE MANAGEMENT', 'carbon accounting and sustainable designs in product lifecycle management', 'NONE', NOW(), NOW()),
  ('936cb050-a47f-4adb-834b-ea8a9f80ae20', 'MOOC 510', 'BASIC ENVIRONMENTAL ENGINEERING AND POLLUTION ABATEMENT', 'basic environmental engineering and pollution abatement', 'NONE', NOW(), NOW()),
  ('b3cf5ef8-40f4-4600-858a-1b4cfb3aa15e', 'MOOC 511', 'MECHANISMS IN ORGANIC CHEMISTRY', 'mechanisms in organic chemistry', 'NONE', NOW(), NOW()),
  ('71814fdf-f2b9-4653-89ea-70cdcedda9b1', 'MOOC 512', 'INTRODUCTION TO POLYMER SCIENCE', 'introduction to polymer science', 'NONE', NOW(), NOW()),
  ('a8b96c6f-19b1-4743-8153-4682f6b99d5d', 'MOOC 513', 'APPLICATION OF SPECTROSCOPIC METHODS IN MOLECULAR STRUCTURE DETERMINATION', 'application of spectroscopic methods in molecular structure determination', 'NONE', NOW(), NOW()),
  ('dd514a3e-4a0b-4555-86df-7e879add1d93', 'MOOC 514', 'ANALYTICAL CHEMISTRY', 'analytical chemistry', 'NONE', NOW(), NOW()),
  ('2814d0dc-6551-428d-838b-778b2213c784', 'MOOC 548', 'EPIGENETICS', 'epigenetics', 'NONE', NOW(), NOW()),
  ('565d6787-a86e-4c04-880d-15187bf7b510', 'MOOC 549', 'FUNDAMENTALS OF CRYO-ELECTRON MICROSCOPY (CRYO-EM) AND 3D IMAGE PROCESSING IN STRUCTURAL BIOLOGY', 'fundamentals of cryo electron microscopy cryo em and 3d image processing in structural biology', 'NONE', NOW(), NOW()),
  ('16e2e111-4353-451a-891e-11b25ed37f8d', 'MOOC 519', 'INTRODUCTION TO BIOSTATISTICS', 'introduction to biostatistics', 'NONE', NOW(), NOW()),
  ('0b650ffd-1e75-4387-8901-a18bbe36fa9e', 'MOOC 550', 'INTRODUCTION TO PROTEOGENOMICS', 'introduction to proteogenomics', 'NONE', NOW(), NOW()),
  ('eb001a64-1a69-4a9d-8f58-4eea2c8f44ad', 'MOOC 505', 'HUMAN PHYSIOLOGY', 'human physiology', 'NONE', NOW(), NOW()),
  ('e98b5899-7c52-4bb4-803e-5d4603f74354', 'MOOC 506', 'INTRODUCTION TO CELL BIOLOGY', 'introduction to cell biology', 'NONE', NOW(), NOW()),
  ('3b7301f6-0165-4855-80b1-2325ec976ed4', 'MOOC 349', 'NEXT GENERATION SEQUENCING TECHNOLOGIES : DATA ANALYSIS AND APPLICATIONS', 'next generation sequencing technologies data analysis and applications', 'NONE', NOW(), NOW()),
  ('dd4253d0-89df-4415-8dbf-6f59b8c0befd', 'MOOC 551', 'ADVANCED ENGINEERING MATHEMATICS', 'advanced engineering mathematics', 'NONE', NOW(), NOW()),
  ('415e8163-f580-48c8-82c8-d738cfbe2882', 'MOOC 520', 'OPERATIONS RESEARCH - IITR', 'operations research iitr', 'NONE', NOW(), NOW()),
  ('0a963ab2-8776-4227-8d14-d7f6c7f970ab', 'MOOC 552', 'FRACTALS AND MULTIFRACTALS', 'fractals and multifractals', 'NONE', NOW(), NOW()),
  ('844a6a7e-6acc-4fa7-85cb-3222fbf95c88', 'MOOC 439', 'A PRIMER TO MATHEMATICAL OPTIMIZATION', 'a primer to mathematical optimization', 'NONE', NOW(), NOW()),
  ('feae280d-d99c-4263-8f52-53c5d86996c6', 'MOOC 362', 'PROBABILITY THEORY FOR DATA SCIENCE', 'probability theory for data science', 'NONE', NOW(), NOW()),
  ('e9d2d50f-dd4c-4eb3-8eda-2c3ce3922fea', 'MOOC 553', 'MATHEMATICAL METHODS AND ITS APPLICATIONS', 'mathematical methods and its applications', 'NONE', NOW(), NOW()),
  ('a75ad09a-adc8-4ba9-8c8f-e40b6d334415', 'MOOC 521', 'CALCULUS FOR ECONOMICS, COMMERCE AND MANAGEMENT', 'calculus for economics commerce and management', 'NONE', NOW(), NOW()),
  ('1abde64e-9c80-45b2-8f77-5d245a4815b4', 'MOOC 417', 'NUMERICAL METHODS', 'numerical methods', 'NONE', NOW(), NOW()),
  ('d682c1d0-59a3-4a6f-8fff-d4d240fe2993', 'MOOC 522', 'DESIGN OF FIXED WING UNMANNED AERIAL VEHICLES', 'design of fixed wing unmanned aerial vehicles', 'NONE', NOW(), NOW()),
  ('1e55869e-d34c-476d-8acc-ec3644903c55', 'MOOC 523', 'INTRODUCTION TO URBAN PLANNING', 'introduction to urban planning', 'NONE', NOW(), NOW()),
  ('cc8ee6ad-3d43-4bca-8f67-6d02908c09cc', 'MOOC 524', 'FINISHING MATERIALS AND SYSTEMS FOR BUILDING APPLICATIONS', 'finishing materials and systems for building applications', 'NONE', NOW(), NOW()),
  ('dddd1c25-582a-4e6c-86c5-914903359a9f', 'MOOC 525', 'PROJECT PLANNING AND CONTROL', 'project planning and control', 'NONE', NOW(), NOW()),
  ('50416da5-169b-4be5-818a-24b1906f32c4', 'MOOC 554', 'SMART STRUCTURES', 'smart structures', 'NONE', NOW(), NOW()),
  ('d2d8b12d-5eab-4aed-8ac3-2ac720a17c4a', 'MOOC 555', 'BEHAVIOR AND DESIGN OF COLD FORMED STEEL STRUCTURES', 'behavior and design of cold formed steel structures', 'NONE', NOW(), NOW()),
  ('2e0d369a-9506-4d42-8b2a-e26eea8851e7', 'MOOC 526', 'DESIGN OF FIXED WING UNMANNED AERIAL VEHICLES', 'design of fixed wing unmanned aerial vehicles', 'NONE', NOW(), NOW()),
  ('f099c6b4-b0b8-4c1b-8d0d-f2a92d396954', 'MOOC 527', 'MECHANICS AND CONTROL OF ROBOTIC MANIPULATORS', 'mechanics and control of robotic manipulators', 'NONE', NOW(), NOW()),
  ('1287bbce-d38b-4182-8898-ec5b203d2be3', 'MOOC 528', 'PROJECT MANAGEMENT', 'project management', 'NONE', NOW(), NOW()),
  ('980df8ae-621f-4183-86be-2e68fd9f75fb', 'MOOC 529', 'RENEWABLE ENERGY SOURCES: FUNDAMENTALS AND TECHNOLOGIES', 'renewable energy sources fundamentals and technologies', 'NONE', NOW(), NOW()),
  ('2a1b1afa-712a-414f-85e5-37f5d78c4eb3', 'MOOC 530', 'PRINCIPLES OF METAL FORMING TECHNOLOGY', 'principles of metal forming technology', 'NONE', NOW(), NOW()),
  ('6b850c0f-2b4f-48e3-8bf9-0ad10da70345', 'MOOC 556', 'FOUNDATIONS OF PSYCHOLOGY: CONCEPTS AND APPLICATIONS', 'foundations of psychology concepts and applications', 'NONE', NOW(), NOW()),
  ('ae8d7672-d0a5-480f-8c78-8f5ea115ce5d', 'MOOC 426', 'APPLIED POSITIVE PSYCHOLOGY', 'applied positive psychology', 'NONE', NOW(), NOW()),
  ('0d5b79f9-75bd-404a-8cc8-feb2ff72c313', 'MOOC 163', 'PSYCHOLOGY OF STRESS, HEALTH AND WELL-BEING', 'psychology of stress health and well being', 'NONE', NOW(), NOW()),
  ('a1103437-3180-4f53-8b07-22d769d2c7c8', 'MOOC 435', 'MENTAL HEALTH AND WELLBEING', 'mental health and wellbeing', 'NONE', NOW(), NOW()),
  ('287ee9ea-0f90-414c-8064-f4467b8bef1a', 'MOOC 251', 'PSYCHOLOGY OF LEARNING', 'psychology of learning', 'NONE', NOW(), NOW()),
  ('92ae61ae-2cb1-4113-8128-2f1cbbdaddde', 'MOOC 557', 'HEALTH AND DISABILITY IN HUMANITIES', 'health and disability in humanities', 'NONE', NOW(), NOW()),
  ('1fbf87ad-1051-4563-89e3-75c8105554b8', 'MOOC 558', 'FABRICATION TECHNIQUES FOR MEMS-BASED SENSORS: CLINICAL PERSPECTIVE', 'fabrication techniques for mems based sensors clinical perspective', 'NONE', NOW(), NOW()),
  ('23732cc4-a469-486f-8007-c22754f3ac08', 'MOOC 249', 'DESIGN OF PHOTOVOLTAIC SYSTEMS', 'design of photovoltaic systems', 'NONE', NOW(), NOW()),
  ('d1236d99-ed5a-4339-8e68-9d9710cbcb28', 'MOOC 371', 'ELECTRONIC SYSTEMS DESIGN: HANDS-ON CIRCUITS AND PCB DESIGN WITH CAD SOFTWARE', 'electronic systems design hands on circuits and pcb design with cad software', 'NONE', NOW(), NOW()),
  ('eab3afea-974b-4a4c-8489-1c968bf7afd5', 'MOOC 559', 'MICROSENSORS AND NANOSENSORS', 'microsensors and nanosensors', 'NONE', NOW(), NOW()),
  ('313f7358-9486-46db-8cd1-1846cfc5ab2c', 'MOOC 430', 'SOLAR ENERGY ENGINEERING AND TECHNOLOGY', 'solar energy engineering and technology', 'NONE', NOW(), NOW()),
  ('2a00b7da-adab-4515-8495-94b01eb5ba04', 'MOOC 385', 'MICROFLUIDICS AND NANOFLUIDICS', 'microfluidics and nanofluidics', 'NONE', NOW(), NOW()),
  ('dd062d9c-5595-43be-8ff1-952c790e0ccf', 'MOOC 560', 'FUNDAMENTALS OF SOLAR PHOTOVOLTAICS AND TECHNOLOGIES', 'fundamentals of solar photovoltaics and technologies', 'NONE', NOW(), NOW()),
  ('9712bf13-1319-4c4e-819d-07282fc77abf', 'MOOC 531', 'HARDWARE MODELING USING VERILOG', 'hardware modeling using verilog', 'NONE', NOW(), NOW()),
  ('89849263-9c22-4438-8f9f-cf334808a798', 'MOOC 532', 'LOW VOLTAGE CMOS CIRCUIT OPERATION', 'low voltage cmos circuit operation', 'NONE', NOW(), NOW()),
  ('eadd314e-d6bc-417d-83a1-0dfbb99f21cf', 'MOOC 534', 'SENSOR TECHNOLOGIES: PHYSICS, FABRICATION, AND CIRCUITS', 'sensor technologies physics fabrication and circuits', 'NONE', NOW(), NOW()),
  ('6533bc86-2272-4e02-8c8f-e362f99e550d', 'MOOC 535', 'SYSTEM DESIGN THROUGH VERILOG', 'system design through verilog', 'NONE', NOW(), NOW()),
  ('2e2020c9-8334-415f-857f-9606697c8be1', 'MOOC 536', 'NANOTECHNOLOGY, SCIENCE AND APPLICATIONS', 'nanotechnology science and applications', 'NONE', NOW(), NOW()),
  ('57cd286b-a320-43bf-8397-3ac60fa4d8a2', 'MOOC 537', 'SOLAR PHOTOVOLTAICS FUNDAMENTALS, TECHNOLOGY AND APPLICATIONS', 'solar photovoltaics fundamentals technology and applications', 'NONE', NOW(), NOW()),
  ('e91b9889-70af-4273-88de-473eb9eba4aa', 'MOOC 538', 'ADVANCED QUANTUM MECHANICS WITH APPLICATIONS', 'advanced quantum mechanics with applications', 'NONE', NOW(), NOW()),
  ('96b5f78e-bded-41ed-8e1f-98a23f129e1c', 'MOOC 562', 'MANAGEMENT ACCOUNTING', 'management accounting', 'NONE', NOW(), NOW()),
  ('e4b62fec-a1f0-4512-867c-f67b40dc89ad', 'MOOC 561', 'WORKING CAPITAL MANAGEMENT', 'working capital management', 'NONE', NOW(), NOW()),
  ('aaa93cfb-5320-43db-8b4f-6ce0c817f288', 'MOOC 565', 'MARKETING RESEARCH AND ANALYSIS', 'marketing research and analysis', 'NONE', NOW(), NOW()),
  ('fc72c362-0794-4028-8192-0b5386286f81', 'MOOC 132', 'PROJECT MANAGEMENT FOR MANAGERS', 'project management for managers', 'NONE', NOW(), NOW()),
  ('ffc3ff9c-bb79-4a8b-8590-c3260f694816', 'MOOC 425', 'MANAGERIAL SKILLS FOR INTERPERSONAL DYNAMICS', 'managerial skills for interpersonal dynamics', 'NONE', NOW(), NOW()),
  ('22c9d0cf-8405-466d-8917-6d4749af6cf3', 'MOOC 138', 'TRAINING OF TRAINERS', 'training of trainers', 'NONE', NOW(), NOW()),
  ('b0957316-e86f-4990-82ee-0d2e01baa97b', 'MOOC 208', 'PRODUCT AND BRAND MANAGEMENT', 'product and brand management', 'NONE', NOW(), NOW()),
  ('d4f4b9b3-50be-4f73-834f-b52d9bc8cd69', 'MOOC 452', 'QUANTITATIVE INVESTMENT MANAGEMENT', 'quantitative investment management', 'NONE', NOW(), NOW()),
  ('b22cfd53-4e98-4c57-8234-123b2a5f1b67', 'MOOC 566', 'SECURITY ANALYSIS & PORTFOLIO MANAGEMENT', 'security analysis portfolio management', 'NONE', NOW(), NOW()),
  ('7e387534-1b26-41fc-80e3-b06793376419', 'MOOC 207', 'OPERATIONS AND SUPPLY CHAIN MANAGEMENT', 'operations and supply chain management', 'NONE', NOW(), NOW()),
  ('898f6da5-7884-4607-89e0-da20339eca5a', 'MOOC 114', 'ENTREPRENEURSHIP', 'entrepreneurship', 'NONE', NOW(), NOW()),
  ('b202f16b-d47c-472d-8b7c-e789a2422b26', 'MOOC 567', 'PROJECT SELECTION AND FINANCE FOR PROFESSIONALS', 'project selection and finance for professionals', 'NONE', NOW(), NOW()),
  ('9e477a8b-ee84-4e94-82aa-f533b2eddc57', 'MOOC 563', 'BUSINESS TO BUSINESS MARKETING (B2B)', 'business to business marketing b2b', 'NONE', NOW(), NOW()),
  ('af47dee7-7c4e-415e-80d3-9ae74d1e1629', 'MOOC 438', 'STRATEGIC MANAGEMENT', 'strategic management', 'NONE', NOW(), NOW()),
  ('c6a5949a-9c84-451a-8416-4a5d35749f3f', 'MOOC 568', 'PATH INTEGRAL METHODS IN PHYSICS AND FINANCE', 'path integral methods in physics and finance', 'NONE', NOW(), NOW()),
  ('8485f699-bfb7-426e-8e89-3ff85212d206', 'MOOC 569', 'PRINCIPLES OF BEHAVIORAL ECONOMICS', 'principles of behavioral economics', 'NONE', NOW(), NOW()),
  ('ea119444-e187-4e8a-8830-399fbc7dd0e0', 'MOOC 335', 'DECISION MAKING WITH SPREADSHEET', 'decision making with spreadsheet', 'NONE', NOW(), NOW()),
  ('828de3ca-d8b9-4d99-86b1-52b3cb7e6943', 'MOOC 453', 'ADVANCED R PROGRAMMING FOR DATA ANALYTICS IN BUSINESS', 'advanced r programming for data analytics in business', 'NONE', NOW(), NOW()),
  ('65e28f07-d897-4699-8515-bf07f40ef058', 'MOOC 564', 'PRODUCTION AND OPERATIONS MANAGEMENT: THEORY AND APPLICATION', 'production and operations management theory and application', 'NONE', NOW(), NOW()),
  ('abfdf2a9-776b-4727-863e-6228c7d9cea5', 'MOOC 570', 'SIX SIGMA', 'six sigma', 'NONE', NOW(), NOW()),
  ('4d788455-eb99-4cc1-8a8c-7fc4e2fc1e75', 'MOOC 247', 'HUMAN FACTORS ENGINEERING', 'human factors engineering', 'NONE', NOW(), NOW()),
  ('705943b2-2562-4bfa-8c3e-c7125d762844', 'MOOC 571', 'AUTOMATION IN PRODUCTION SYSTEMS AND MANAGEMENT', 'automation in production systems and management', 'NONE', NOW(), NOW()),
  ('cb764f96-9d32-4985-887a-e5e801b5747e', 'MOOC 231', 'E-BUSINESS', 'e business', 'NONE', NOW(), NOW()),
  ('f36e3520-f1bf-46a7-8df9-f673d295b640', 'MOOC 424', 'STRATEGY AND TECHNOLOGY: A PRACTICAL PRIMER', 'strategy and technology a practical primer', 'NONE', NOW(), NOW()),
  ('53dfb609-1844-4058-8386-a26713749573', 'MOOC 572', 'FOUNDATIONS OF ENTREPRENEURSHIP', 'foundations of entrepreneurship', 'NONE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    updated_at = NOW();

-- 4. Secure RLS Policies: Students can READ catalog, but CANNOT insert or create arbitrary courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated and anonymous students to read the official catalogue
DROP POLICY IF EXISTS "courses_select_all" ON public.courses;
DROP POLICY IF EXISTS "courses_read_all" ON public.courses;
CREATE POLICY "courses_read_all" ON public.courses
    FOR SELECT TO anon, authenticated
    USING (true);

-- Drop permissive public insert policy (absolutely no student-created courses)
DROP POLICY IF EXISTS "courses_insert_policy" ON public.courses;
DROP POLICY IF EXISTS "courses_insert_admin" ON public.courses;
CREATE POLICY "courses_insert_admin" ON public.courses
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Only admins can update courses
DROP POLICY IF EXISTS "courses_update_policy" ON public.courses;
DROP POLICY IF EXISTS "courses_update_admin" ON public.courses;
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

-- 5. Updated resolve_canonical_course RPC: ONLY matches existing official catalog records, never creates arbitrary rows
CREATE OR REPLACE FUNCTION public.resolve_canonical_course(
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
BEGIN
    v_clean_code := upper(trim(COALESCE(p_code, '')));
    v_norm := lower(regexp_replace(trim(COALESCE(p_name, '')), '[^a-zA-Z0-9 ]', '', 'g'));
    v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');

    -- 1. Match official code and normalized name
    IF v_clean_code <> '' THEN
        SELECT * INTO v_course
        FROM public.courses
        WHERE upper(trim(code)) = v_clean_code AND normalized_name = v_norm
        LIMIT 1;

        IF v_course.id IS NOT NULL THEN
            RETURN to_jsonb(v_course);
        END IF;

        -- Check code only if unique
        SELECT * INTO v_course
        FROM public.courses
        WHERE upper(trim(code)) = v_clean_code
        LIMIT 1;

        IF v_course.id IS NOT NULL THEN
            RETURN to_jsonb(v_course);
        END IF;
    END IF;

    -- 2. Match exact normalized name
    SELECT * INTO v_course
    FROM public.courses
    WHERE normalized_name = v_norm
    LIMIT 1;

    IF v_course.id IS NOT NULL THEN
        RETURN to_jsonb(v_course);
    END IF;

    -- 3. Match substring / fuzzy
    SELECT * INTO v_course
    FROM public.courses
    WHERE normalized_name LIKE '%' || v_norm || '%'
       OR v_norm LIKE '%' || normalized_name || '%'
    ORDER BY length(normalized_name) ASC
    LIMIT 1;

    IF v_course.id IS NOT NULL THEN
        RETURN to_jsonb(v_course);
    END IF;

    -- No match in official university catalog
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_canonical_course(TEXT, TEXT) TO anon, authenticated, service_role;
