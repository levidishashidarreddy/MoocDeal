// Core Application Types for MoocDeal — SRM DEALINGS

export type Branch =
  | 'CSE'
  | 'ECE'
  | 'EEE'
  | 'MECH'
  | 'CIVIL'
  | 'AI_ML'
  | 'DATA_SCIENCE'
  | 'CYBER_SECURITY'
  | 'OTHER';

export type AcademicYear = '1st Year' | '2nd Year' | '3rd Year' | '4th Year';

export type ShiftType = 'FN' | 'AN';

export type ExamStatus = 'CONFIRMED' | 'PENDING_DETAILS';

export interface StudentProfile {
  id: string;
  reg_no: string;          // Unique SRMAP Registration Number e.g. AP21110010123
  full_name: string;       // Chosen display name
  branch: Branch;
  academic_year: AcademicYear;
  section: string;         // e.g., 'A', 'B', 'CSE-A', etc.
  phone_visible: boolean;  // Privacy control: whether to reveal WhatsApp contact or keep private
  is_admin?: boolean;      // Admin privileges for centre resolution and link moderation
  is_verified?: boolean;   // Verified SRM AP student account status
  created_at: string;
  updated_at?: string;
}

export interface ExamCentre {
  id: string;
  name: string;
  normalized_name: string;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  is_verified: boolean;    // false for auto-suggested centres awaiting admin confirmation
  created_by?: string;
  created_at: string;
}

export interface Course {
  id: string;
  code: string;            // e.g. "noc24-cs101" or "CS101"
  name: string;            // e.g. "Deep Learning"
  normalized_name: string;
  organiser_id?: string | null;
  organiser_claimed_at?: string | null;
  organiser_status?: 'NONE' | 'CLAIMED' | 'COMPLETED' | null;
  created_at: string;
}

export interface StudentExam {
  id: string;
  student_id: string;
  course_id: string;
  centre_id?: string | null;
  exam_date?: string | null;        // ISO format YYYY-MM-DD
  reporting_time?: string | null;   // HH:MM (Asia/Kolkata)
  exam_start_time?: string | null;  // HH:MM (Asia/Kolkata)
  shift?: ShiftType | null;         // 'FN' or 'AN'
  status: ExamStatus;               // 'CONFIRMED' (has centre/slot) or 'PENDING_DETAILS' (course only)
  created_at: string;
  updated_at?: string;

  // Joined relations
  course?: Course;
  centre?: ExamCentre;
}

export interface ExamCohort {
  id: string;
  centre_id: string;
  exam_date: string;                // YYYY-MM-DD
  reporting_time: string;           // HH:MM
  whatsapp_group_link?: string | null;
  link_submitted_by?: string | null;
  link_updated_at?: string | null;
  organiser_id?: string | null;
  organiser_claimed_at?: string | null;
  organiser_status?: 'NONE' | 'CLAIMED' | 'COMPLETED' | null;
  created_at: string;

  // Joined/Computed fields
  centre?: ExamCentre;
  member_count?: number;
  members?: CohortMember[];
  has_group_link?: boolean;
  is_eligible?: boolean;
  can_edit_link?: boolean;
}

export interface CohortMember {
  id: string;
  cohort_id: string;
  student_id: string;
  exam_id: string;
  joined_at: string;
  student?: StudentProfile;
  course?: Course;
}

export interface CourseGroupLink {
  id: string;
  course_id: string;
  whatsapp_group_link: string;
  submitted_by: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  submitter?: StudentProfile;
  can_edit?: boolean;
}

export interface CourseBuddiesResult {
  course: Course | null;
  students: {
    profile: StudentProfile;
    exam: StudentExam;
    centre?: ExamCentre;
  }[];
  groupLink: CourseGroupLink | null;
  hasGroupLink?: boolean;
  isEligible?: boolean;
  canEditLink?: boolean;
  organiser_id?: string | null;
  organiser_status?: 'NONE' | 'CLAIMED' | 'COMPLETED' | null;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface LinkReport {
  id: string;
  link_type: 'COHORT' | 'COURSE';
  target_id: string;       // cohort_id or course_id
  whatsapp_link: string;
  reported_by: string;
  reason: 'SPAM' | 'EXPIRED' | 'INAPPROPRIATE' | 'WRONG_GROUP';
  details?: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
  reporter?: StudentProfile;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// AI Extraction Response Schema
export interface HallTicketExtractionResult {
  course_id?: string;
  course_name: string;
  course_code: string;
  candidate_name?: string;
  reg_no?: string;
  exam_date: string;             // YYYY-MM-DD
  reporting_time: string;        // HH:MM (Asia/Kolkata)
  exam_start_time: string;       // HH:MM (Asia/Kolkata)
  shift: ShiftType;              // 'FN' | 'AN'
  centre_name: string;
  centre_address: string;
  city: string;
  state: string;
  pincode: string;
  ambiguous_fields: string[];    // list of field keys that may need student verification
  confidence_score: number;      // 0 - 100
  notes?: string;
  is_hall_ticket?: boolean;
}

export interface ExtractionResponse {
  success: boolean;
  data?: HallTicketExtractionResult;
  error?: string;
  details?: string;
}
