# NPTEL Exam Buddy — SRM AP

A complete, production-ready, responsive student cohort & study buddy discovery platform built for students associated with the unofficial **SRM DEALINGS** student community at **SRM University–AP**.

---

## 1. Core Purpose & Architectural Scope

This platform is a **student buddy-discovery platform** designed specifically for NPTEL examination logistics and MOOC coursework:
- **Same Exam Centre & Reporting Time**: Matches students taking an NPTEL exam at the *same test centre*, on the *same date*, and with the *same official reporting time* (even across different courses) for travel coordination, auto-sharing from Vijayawada or Guntur, and morning arrival.
- **Same MOOC Course**: Matches students studying the same NPTEL online course across all dates and centres for assignment doubts, peer discussions, and coursework study materials.
- **Independent WhatsApp Group Coordination**: Students create their own WhatsApp groups in the WhatsApp application and paste their invite links into the matching cohort or course page.
- **Zero-Storage AI Vision Parsing**: Hall tickets are analyzed in server memory using vision models to extract logistics fields and are immediately discarded.

---

## 2. Technology Stack

- **Frontend**: React 18 / 19, TypeScript, Vite
- **Styling**: Tailwind CSS with custom university design system (`#0B192C` Deep Navy, White, Slate, and Emerald accents)
- **Backend & Database**: Supabase PostgreSQL (Full SQL migrations, RLS policies, indexes, and atomic trigger functions)
- **Authentication**: Unique SRMAP Registration Number (`AP21110010xxx`) with hashed credentials and session persistence
- **Serverless API**: `/api/extract-hallticket` (Vercel Serverless Function and Vite dev server middleware)
- **AI Vision**: Vision model extraction with strict JSON schema validation and zero-storage data policy
- **Deployment**: Vercel & GitHub with Supabase as managed backend

---

## 3. Database Schema & Migrations

The database migration is located at:
[`supabase/migrations/20261012_init_nptel_buddy.sql`](file:///d:/Programming/DealingsMooc/supabase/migrations/20261012_init_nptel_buddy.sql)

### Tables Included:
1. `profiles`: Primary student profiles with unique normalized SRMAP registration number, branch, academic year, section, and admin flag.
2. `centres`: Dynamic examination centres with `normalized_name`, address, city, state, pincode, and `is_verified` boolean.
3. `courses`: Canonical NPTEL course catalogue (e.g. Deep Learning, Cloud Computing, C Programming).
4. `student_exams`: Student enrolled exams with status (`CONFIRMED` or `PENDING_DETAILS`), reporting time, start time, shift (`FN`/`AN`).
5. `exam_cohorts`: Unique cohorts constrained by `UNIQUE(centre_id, exam_date, reporting_time)`.
6. `cohort_members`: Junction table linking students to cohorts (`UNIQUE(cohort_id, student_id)`).
7. `course_group_links`: Study group WhatsApp invite links for course-level matching.
8. `link_reports`: Community reporting queue for expired, spam, or inappropriate WhatsApp links.

### Atomic Functions & Triggers:
- `handle_student_exam_sync()`: PostgreSQL trigger on `student_exams` that automatically creates or retrieves the matching `exam_cohort` and assigns `cohort_members` atomically on insert/update, preventing race conditions.
- **Row Level Security (RLS)**: Strict policies ensuring students can only modify their own profile and exam records, while enabling cohort discovery and restricting admin actions to authorized administrators.

---

## 4. Environment Variables

Create a `.env` file in the project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google Gemini Vision API (for Hall Ticket OCR parsing)
GEMINI_API_KEY=AIzaSy...
```

*Note: If environment variables are omitted or empty, the application automatically runs in **University Sandbox Mode** with pre-populated realistic SRM AP student data (Karthik Varma, Ananya Reddy, Sai Teja P., etc.), centres in Vijayawada & Guntur, and mock AI vision extraction so all features can be demonstrated immediately without setup friction.*

---

## 5. Local Setup & Running

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Build production bundle
npm run build
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 6. Key Features Implemented

### A. First-Login Onboarding
- **Option A (Upload Hall Ticket)**:
  - File drag-and-drop supporting JPEG, PNG, WebP (< 5MB).
  - Sends image to `/api/extract-hallticket` for in-memory OCR.
  - Returns structured logistics: MOOC course name, course code, exam date, reporting time (07:30) distinct from exam start time (09:00), FN/AN shift, test centre name, address, city, pincode.
  - Automatically loads an editable review form for student confirmation.
  - Discards temporary image memory immediately after parsing.
- **Option B (I Don't Have My Hall Ticket)**:
  - Asks only for the MOOC course title/code.
  - Does NOT require test centre, date, or reporting time.
  - Saves exam as `PENDING_DETAILS` so students can immediately find course study buddies.

### B. Same Centre & Reporting Time Discovery
- Grouped by `(Centre, Exam Date, Official Reporting Time)`.
- Matches students taking different courses at the same venue and hour.
- Cohort cards with venue address, city, and active buddies count.
- Community WhatsApp group button (`chat.whatsapp.com/...`), link updater, and link report modal.
- Student table displaying Name, masked/full Registration Number, Course, Branch, Year, and Section.

### C. Same MOOC Course Discovery
- Search and filter across courses (Deep Learning, Cloud Computing, etc.).
- Independent of test centre and date.
- Peer study WhatsApp group integration with URL validation and moderation.

### D. Dynamic Centre Resolution & Administration
- Suggests new centres automatically when extracted from hall tickets (`is_verified = false`).
- Dedicated Admin Portal for authorized accounts (`user.is_admin`):
  - Review & approve pending centre suggestions.
  - Merge duplicate centres into canonical verified venues.
  - Review and resolve flagged WhatsApp links (dismiss or remove).
  - View real-time platform metrics.

### E. Privacy & Security Protections
- Registration number masking toggle: students can mask their registration number (`AP21110*****5`) from general cohort listings.
- Zero image retention policy with dedicated Privacy Notice modal.
- Client-side and server-side WhatsApp URL validation (`^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{20,}$`).
- No candidate photographs, DOB, signatures, or personal phone numbers are ever stored.

---

## 7. Deployment Instructions (Vercel & Supabase)

### Supabase Setup:
1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in Supabase Dashboard.
3. Paste and run the entire script from [`supabase/migrations/20261012_init_nptel_buddy.sql`](file:///d:/Programming/DealingsMooc/supabase/migrations/20261012_init_nptel_buddy.sql).
4. Retrieve your Project URL and anon public key from **Project Settings > API**.

### Vercel Deployment:
1. Push your repository to GitHub.
2. In Vercel, click **Add New Project** and import the repository.
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
4. Click **Deploy**. Vercel will automatically build the Vite frontend and deploy `/api/extract-hallticket.ts` as a serverless function.

---

## 8. Verification & Tests Run

1. **TypeScript & Bundler Verification**:
   - Executed `npm run build` using Vite & TypeScript compiler.
   - Output: Clean production bundle generated in `dist/` with 0 type errors.
2. **Serverless Dev Middleware**:
   - Configured Vite middleware in `vite.config.ts` to route `/api/extract-hallticket` directly during local development.
3. **Database Migration Consistency**:
   - Verified PostgreSQL DDL syntax, unique constraints, RLS policies, trigger procedures, and seed records for Vijayawada, Guntur, and Hyderabad centres.
4. **Local Dev Server Execution**:
   - Launched `npm run dev` at `http://localhost:5173/`.
   - Verified landing page rendering, dashboard navigation, and registration number privacy toggle.
