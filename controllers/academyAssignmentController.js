import AcademyAssignmentSubmission from "../models/academyAssignmentSubmissionModel.js";

export const academyAssignmentController = {
  // POST /api/academy/assignments/:contentId/submissions
  submit: async (req, res) => {
    const { contentId } = req.params;
    const { student_email, student_name, text, file_name, file_url } = req.body;
    if (!student_email) return res.status(400).json({ message: "student_email required" });
    if (!text && !file_url) return res.status(400).json({ message: "Provide either text or an uploaded file" });
    try {
      const existing = await AcademyAssignmentSubmission.findOne({
        where: { content_id: Number(contentId), student_email },
      });
      const payload = {
        content_id: Number(contentId),
        student_email,
        student_name: student_name || null,
        text: text || null,
        file_name: file_name || null,
        file_url: file_url || null,
        submitted_at: new Date(),
      };
      let row;
      if (existing) {
        await existing.update(payload);
        row = existing;
      } else {
        row = await AcademyAssignmentSubmission.create(payload);
      }
      return res.status(200).json({ submission: row });
    } catch (err) {
      console.error("assignment submit:", err);
      return res.status(500).json({ message: "Failed to submit" });
    }
  },

  // GET /api/academy/assignments/:contentId/submissions?email=...
  list: async (req, res) => {
    const { contentId } = req.params;
    const { email } = req.query;
    try {
      const where = { content_id: contentId };
      if (email) where.student_email = email;
      const rows = await AcademyAssignmentSubmission.findAll({
        where,
        order: [["submitted_at", "DESC"]],
      });
      return res.status(200).json({ submissions: rows });
    } catch (err) {
      console.error("assignment list:", err);
      return res.status(500).json({ message: "Failed to list" });
    }
  },

  // PUT /api/academy/assignments/submissions/:id   (admin grade/feedback)
  grade: async (req, res) => {
    const { id } = req.params;
    const { grade, feedback } = req.body;
    try {
      const row = await AcademyAssignmentSubmission.findByPk(id);
      if (!row) return res.status(404).json({ message: "Not found" });
      if (grade !== undefined) row.grade = grade;
      if (feedback !== undefined) row.feedback = feedback;
      await row.save();
      return res.status(200).json({ submission: row });
    } catch (err) {
      console.error("assignment grade:", err);
      return res.status(500).json({ message: "Failed to grade" });
    }
  },
};
