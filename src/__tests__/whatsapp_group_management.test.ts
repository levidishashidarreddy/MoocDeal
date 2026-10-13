import { describe, it, expect, beforeEach } from 'vitest';
import { dataService, isValidWhatsAppLink, localStore } from '../services/dataService';
import { rateLimiter } from '../services/rateLimiter';

describe('WhatsApp Group Link Management & Privacy Controls', () => {
  beforeEach(() => {
    localStore.resetToDefaults();
    rateLimiter.reset();
  });

  describe('1. WhatsApp URL Format Validation', () => {
    it('accepts valid WhatsApp group invite links', () => {
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/LKn82s0Dkae390Ka0192Aa')).toBe(true);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/ABCDEF1234567890abcdef')).toBe(true);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/DL101SRMAPNptelStudy24')).toBe(true);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/CloudSRMAPNptelGroup24/')).toBe(true); // trailing slash trimmed
    });

    it('rejects invalid, phishing, or malicious URLs', () => {
      // Empty or non-string
      expect(isValidWhatsAppLink('')).toBe(false);
      expect(isValidWhatsAppLink('   ')).toBe(false);

      // Insecure HTTP
      expect(isValidWhatsAppLink('http://chat.whatsapp.com/LKn82s0Dkae390Ka0192Aa')).toBe(false);

      // Phishing and spoofing domains
      expect(isValidWhatsAppLink('https://phishing-site.com/chat.whatsapp.com/LKn82s0Dkae390Ka0192Aa')).toBe(false);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com.attacker.com/LKn82s0Dkae390Ka0192Aa')).toBe(false);

      // Non-group personal chat links
      expect(isValidWhatsAppLink('https://wa.me/919876543210')).toBe(false);
      expect(isValidWhatsAppLink('https://api.whatsapp.com/send?phone=919876543210')).toBe(false);

      // Dangerous schemes
      expect(isValidWhatsAppLink('javascript:alert(1)')).toBe(false);
      expect(isValidWhatsAppLink('data:text/html,<script>alert(1)</script>')).toBe(false);

      // Suspicious parameters or open redirects
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/LKn82s0Dkae390Ka0192Aa?open=redirect')).toBe(false);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/LKn82s0Dkae390Ka0192Aa#fragment')).toBe(false);

      // Invalid token lengths
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/shortCode123')).toBe(false); // < 20 chars
      expect(isValidWhatsAppLink(`https://chat.whatsapp.com/${'A'.repeat(40)}`)).toBe(false); // > 32 chars
    });
  });

  describe('2. Visibility & Privacy Access Control', () => {
    it('shows cohort group link ONLY to verified members taking exams in that cohort', async () => {
      // Setup a cohort with a group link
      const cohorts = await dataService.getCohorts();
      const cohort = cohorts[0];
      const validLink = 'https://chat.whatsapp.com/CohortSecretLink12345';

      // Member student
      const member = cohort.members?.[0]?.student;
      expect(member).toBeDefined();

      // Submit link as member
      await dataService.updateCohortWhatsAppLink(cohort.id, validLink, member!.id);

      // 1. Member requests cohorts: Link is visible
      const memberView = await dataService.getCohorts(undefined, member!.id);
      const memberCohort = memberView.find(c => c.id === cohort.id);
      expect(memberCohort?.is_eligible).toBe(true);
      expect(memberCohort?.whatsapp_group_link).toBe(validLink);
      expect(memberCohort?.has_group_link).toBe(true);

      // 2. Non-member student requests cohorts: Link is redacted (null)
      const nonMemberStudentId = 'student-different-slot';
      const nonMemberView = await dataService.getCohorts(undefined, nonMemberStudentId);
      const nonMemberCohort = nonMemberView.find(c => c.id === cohort.id);
      expect(nonMemberCohort?.is_eligible).toBe(false);
      expect(nonMemberCohort?.whatsapp_group_link).toBeNull();
      expect(nonMemberCohort?.has_group_link).toBe(true); // Flag indicates group exists without leaking URL

      // 3. Unauthenticated / Public request: Link is completely redacted (null)
      const publicView = await dataService.getCohorts();
      const publicCohort = publicView.find(c => c.id === cohort.id);
      expect(publicCohort?.is_eligible).toBe(false);
      expect(publicCohort?.whatsapp_group_link).toBeNull();
      expect(publicCohort?.has_group_link).toBe(true);
    });

    it('shows course study group link ONLY to verified students enrolled in the course', async () => {
      const courses = await dataService.getCourses();
      const course = courses[0];
      const validCourseLink = 'https://chat.whatsapp.com/CourseStudyLink12345';

      // Find an enrolled student
      const exams = localStore.getExams();
      const enrolledExam = exams.find(e => e.course_id === course.id);
      expect(enrolledExam).toBeDefined();
      const enrolledStudentId = enrolledExam!.student_id;

      // Update link as enrolled student
      await dataService.updateCourseWhatsAppLink(course.id, validCourseLink, enrolledStudentId);

      // 1. Enrolled student view: Link is visible
      const enrolledView = await dataService.getStudentsByCourse(course.id, undefined, enrolledStudentId);
      expect(enrolledView.isEligible).toBe(true);
      expect(enrolledView.groupLink?.whatsapp_group_link).toBe(validCourseLink);

      // 2. Non-enrolled student view: Link is redacted (null)
      const nonEnrolledStudentId = 'student-not-enrolled-123';
      const nonEnrolledView = await dataService.getStudentsByCourse(course.id, undefined, nonEnrolledStudentId);
      expect(nonEnrolledView.isEligible).toBe(false);
      expect(nonEnrolledView.groupLink).toBeNull();
      expect(nonEnrolledView.hasGroupLink).toBe(true); // Flag indicates link exists

      // 3. Unauthenticated public view: Link is redacted (null)
      const publicView = await dataService.getStudentsByCourse(course.id);
      expect(publicView.isEligible).toBe(false);
      expect(publicView.groupLink).toBeNull();
      expect(publicView.hasGroupLink).toBe(true);
    });
  });

  describe('3. Link Authorship & Edit / Replace Rules', () => {
    it('allows link author to edit or replace their own cohort group link', async () => {
      const cohorts = await dataService.getCohorts();
      const cohort = cohorts[0];
      const member = cohort.members?.[0]?.student;
      expect(member).toBeDefined();

      const initialLink = 'https://chat.whatsapp.com/InitialCohortLink123';
      await dataService.updateCohortWhatsAppLink(cohort.id, initialLink, member!.id);

      // Author replaces their own link
      const replacedLink = 'https://chat.whatsapp.com/ReplacedCohortLink456';
      const updated = await dataService.updateCohortWhatsAppLink(cohort.id, replacedLink, member!.id);

      expect(updated.whatsapp_group_link).toBe(replacedLink);
      expect(updated.link_submitted_by).toBe(member!.id);
    });

    it('prevents non-authors from overwriting an active cohort group link', async () => {
      const cohorts = await dataService.getCohorts();
      const cohort = cohorts[0];
      const author = cohort.members?.[0]?.student;
      const otherStudent = cohort.members?.[1]?.student;
      expect(author).toBeDefined();
      expect(otherStudent).toBeDefined();

      const authorLink = 'https://chat.whatsapp.com/AuthorGroupLink12345';
      await dataService.updateCohortWhatsAppLink(cohort.id, authorLink, author!.id);

      // Other student tries to overwrite
      const intruderLink = 'https://chat.whatsapp.com/IntruderGroupLink1234';
      await expect(
        dataService.updateCohortWhatsAppLink(cohort.id, intruderLink, otherStudent!.id)
      ).rejects.toThrow(/only the author or an administrator can edit or replace/i);

      // Verify original link remains intact
      const refreshed = await dataService.getCohorts(undefined, author!.id);
      const match = refreshed.find(c => c.id === cohort.id);
      expect(match?.whatsapp_group_link).toBe(authorLink);
    });

    it('allows community admin to update or remove any cohort link', async () => {
      const cohorts = await dataService.getCohorts();
      const cohort = cohorts[0];
      const author = cohort.members?.[0]?.student;
      expect(author).toBeDefined();

      await dataService.updateCohortWhatsAppLink(cohort.id, 'https://chat.whatsapp.com/AuthorGroupLink12345', author!.id);

      // Admin user
      const adminStudent = {
        id: 'admin-super-user',
        full_name: 'Community Admin',
        reg_no: 'ADMIN001',
        branch: 'CSE' as const,
        academic_year: '4th Year' as const,
        section: 'A',
        is_admin: true,
        is_verified: true,
        phone_visible: false,
        created_at: new Date().toISOString(),
      };
      const students = localStore.getStudents();
      students.push(adminStudent);
      localStore.saveStudents(students);

      // Admin replaces link
      const adminLink = 'https://chat.whatsapp.com/AdminModeratedLink123';
      const updated = await dataService.updateCohortWhatsAppLink(cohort.id, adminLink, adminStudent.id);
      expect(updated.whatsapp_group_link).toBe(adminLink);

      // Admin removes link
      await dataService.removeCohortWhatsAppLink(cohort.id, adminStudent.id);
      const cleared = (await dataService.getCohorts(undefined, adminStudent.id)).find(c => c.id === cohort.id);
      expect(cleared?.whatsapp_group_link).toBeNull();
    });
  });

  describe('4. Link Moderation & Reporting', () => {
    it('records reports with valid reasons and details', async () => {
      const studentId = 'student-reporter-99';
      const report = await dataService.reportLink({
        link_type: 'COHORT',
        target_id: 'ch-test-venue-1',
        whatsapp_link: 'https://chat.whatsapp.com/ExpiredOrBrokenLink12',
        reported_by: studentId,
        reason: 'EXPIRED',
        details: 'Invite link has expired and is no longer joinable.',
      });

      expect(report).toBeDefined();
      expect(report.status).toBe('PENDING');
      expect(report.reason).toBe('EXPIRED');
      expect(report.reported_by).toBe(studentId);
    });

    it('prevents duplicate pending reports by the same student on the same link', async () => {
      const studentId = 'student-reporter-duplicate';
      const targetId = 'ch-duplicate-target';

      await dataService.reportLink({
        link_type: 'COHORT',
        target_id: targetId,
        whatsapp_link: 'https://chat.whatsapp.com/SpammyGroupLink12345',
        reported_by: studentId,
        reason: 'SPAM',
      });

      // Second identical report should be rejected
      await expect(
        dataService.reportLink({
          link_type: 'COHORT',
          target_id: targetId,
          whatsapp_link: 'https://chat.whatsapp.com/SpammyGroupLink12345',
          reported_by: studentId,
          reason: 'SPAM',
        })
      ).rejects.toThrow(/already submitted a pending report/i);
    });

    it('resolves a report and clears the invalid link when action is REMOVE_LINK', async () => {
      const cohorts = await dataService.getCohorts();
      const cohort = cohorts[0];
      const member = cohort.members?.[0]?.student;
      expect(member).toBeDefined();

      const brokenLink = 'https://chat.whatsapp.com/BrokenGroupLink12345';
      await dataService.updateCohortWhatsAppLink(cohort.id, brokenLink, member!.id);

      const report = await dataService.reportLink({
        link_type: 'COHORT',
        target_id: cohort.id,
        whatsapp_link: brokenLink,
        reported_by: 'student-tester-1',
        reason: 'EXPIRED',
      });

      // Admin resolves report
      await dataService.resolveReport(report.id, 'REMOVE_LINK');

      // Check that link is now cleared
      const refreshedCohorts = await dataService.getCohorts(undefined, member!.id);
      const updatedCohort = refreshedCohorts.find(c => c.id === cohort.id);
      expect(updatedCohort?.whatsapp_group_link).toBeNull();
    });
  });

  describe('5. Rate Limiting Protection', () => {
    it('enforces rate limit of max 5 link updates per 10 minutes per student', async () => {
      const cohorts = await dataService.getCohorts();
      const cohort = cohorts[0];
      const studentId = 'rate-limit-student-1';

      // 5 submissions should succeed
      for (let i = 1; i <= 5; i++) {
        await dataService.updateCohortWhatsAppLink(
          cohort.id,
          `https://chat.whatsapp.com/TestLinkSubmission${i}12345`,
          studentId
        );
      }

      // 6th submission within the window must fail
      await expect(
        dataService.updateCohortWhatsAppLink(
          cohort.id,
          'https://chat.whatsapp.com/ExcessiveLinkUpdate123',
          studentId
        )
      ).rejects.toThrow(/rate limit reached/i);
    });

    it('enforces rate limit of max 3 reports per 10 minutes per student', async () => {
      const reporterId = 'rate-limit-reporter-1';

      // 3 reports on different targets should succeed
      for (let i = 1; i <= 3; i++) {
        await dataService.reportLink({
          link_type: 'COHORT',
          target_id: `target-slot-${i}`,
          whatsapp_link: `https://chat.whatsapp.com/SpamGroupSlot${i}12345`,
          reported_by: reporterId,
          reason: 'SPAM',
        });
      }

      // 4th report within the window must fail
      await expect(
        dataService.reportLink({
          link_type: 'COHORT',
          target_id: 'target-slot-4',
          whatsapp_link: 'https://chat.whatsapp.com/SpamGroupSlot412345',
          reported_by: reporterId,
          reason: 'SPAM',
        })
      ).rejects.toThrow(/rate limit reached/i);
    });
  });
});
