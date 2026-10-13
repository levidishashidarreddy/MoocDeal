# MoocDeal — SRM DEALINGS

A minimal, student buddy-discovery web application built for students associated with the unofficial **SRM DEALINGS** student community at **SRM University–AP**.

Designed with the **MasterOS** sleek dark aesthetic (deep midnight black, elevated cards, purple/violet accents, generous whitespace, and restrained typography).

---

## 1. Product Identity & Purpose

**MoocDeal** is a simple, focused buddy-discovery platform—not a college management system or transport booking app:
- **Same Exam Centre & Time**: Connect with SRM AP peers attending an NPTEL exam at the *same test venue*, on the *same date*, and at the *exact same official reporting time* for auto-sharing, group travel from Vijayawada or Guntur, and morning coordination.
- **Same MOOC Course**: Discover peers enrolled in the same online course across sections and centres for assignment discussions, doubt clearing, and study resources.
- **Independent WhatsApp Groups**: Students create their own WhatsApp groups and paste invite links into the matching cohort or course view.
- **Privacy First**: Zero image retention for uploaded hall tickets; in-memory OCR parsing only; masked student registration numbers (`AP21110*****5`).

---

## 2. MasterOS Design System

- **Background Palette**: Deep midnight `#0A0B10` (`bg-dark-900`) and dark canvas `#0F1017`.
- **Card Styling**: Elevated dark `#13141D` (`bg-dark-800`) with subtle border `#1E202D` (`border-subtle-border`).
- **Brand Accents**: Vibrant purple/violet `#7C3AED` (`brand-violet`) and `#8B5CF6` (`brand-purple`) with subtle glow effects.
- **Typography**: Clean Inter typography with small uppercase section tracking labels (`MY EXAM`, `MATCHING STUDENTS`).
- **Minimal Navigation**: MoocDeal logo, dual-state switcher (`My Exam` / `Find Buddies`), student profile avatar pill, and logout.

---

## 3. Core Architecture Rules

### Strictly One Exam Per Student
- Each student has exactly **one** NPTEL exam record in the application.
- Enforced at both the database level via PostgreSQL constraint:
  ```sql
  CONSTRAINT unique_student_exam UNIQUE (student_id)
  ```
  and the application layer via atomic upsert operations (`onConflict: 'student_id'`).
- The dashboard displays one compact **My Exam** card with an unobtrusive **Edit Exam** modal option.

### Minimal First-Login Onboarding
On initial login, students configure their MOOC exam with two clear choices:
1. **Upload Hall Ticket**: In-memory AI vision extraction autofills course, centre, exam date, reporting time, start time, and shift. The screenshot is discarded immediately after processing.
2. **I Don't Have My Hall Ticket Yet**: Requires only the MOOC course name/code. The slot is marked as `PENDING_DETAILS` without forcing centre, date, or reporting time.

### Minimal Dashboard
- Welcome greeting with display name: `Welcome, Name 👋`
- Single **My Exam** card (course code/name, centre venue, date, reporting time, start time, confirmed status).
- Unobtrusive **Upload Hall Ticket** button if the exam record is pending hall ticket details.
- Primary CTA: **Find Buddies**.

### Find Buddies Discovery
Two clean tabs:
1. **Same Exam Centre & Time**: Matches students attending the same verified centre, date, and reporting time (regardless of course). Displays cohort WhatsApp group link (join/update/report) and masked student roster.
2. **Same MOOC Course**: Matches all students enrolled in the same course (regardless of venue). Displays course discussion group link and peer roster.

---

## 4. Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS with custom MasterOS design tokens
- **Backend & Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **AI Admit Card OCR**: In-memory vision processing (`/api/extract-hallticket.ts`)
- **Testing**: Vitest unit and integration test suite

---

## 5. Local Setup & Running

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Run test suite
npm test

# 4. Build production bundle
npm run build
```

The application runs on `http://localhost:5173/`.

### Environment Variables (.env)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Google Gemini API Configuration (Server-Side Only)
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash
```

*Note: In local development without Supabase keys, the application smoothly runs with local storage state management and realistic SRM AP student data.*

---

## 6. Database Migrations

Database migrations are located in `supabase/migrations/`:
- [`20261013_consolidated_production_migration.sql`](supabase/migrations/20261013_consolidated_production_migration.sql): Consolidated production deployment migration (schema, RLS policies, official 91-course SRM AP MOOC catalogue seed, and server-side brute-force lockout RPC `authenticate_student`).
- Individual versioned migrations (`20261012_*` to `20261013_*`) are preserved for sequential history and rollback references.

---

## 7. Verification & Testing

Run the automated test suite:
```bash
npm test
```

Verified test coverage includes:
- Unique registration number constraint
- Password recovery / account recovery flow
- Single exam per student constraint & upsert replacement
- WhatsApp link format validation (`https://chat.whatsapp.com/...`)
- Masked registration number privacy protection
- In-memory OCR extraction without persistent storage
