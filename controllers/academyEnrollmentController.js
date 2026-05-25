import AcademyEnrollment from "../models/academyEnrollmentModel.js";

export const academyEnrollmentController = {
  // Look up a learner's enrollment by email (used to auto-show "my courses").
  findByEmail: async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "email is required" });
    try {
      const row = await AcademyEnrollment.findOne({ where: { email } });
      if (!row) return res.status(404).json({ message: "No enrollment found for this email" });
      return res.status(200).json({
        enrollment: {
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          courses: row.courses || [],
          status: row.status,
        },
      });
    } catch (err) {
      console.error("findByEmail error:", err);
      return res.status(500).json({ message: "Failed to look up enrollment" });
    }
  },

  // Verify email + password and return the learner's courses.
  login: async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email and password are required" });
    try {
      const row = await AcademyEnrollment.findOne({ where: { email } });
      if (!row || row.password !== password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (row.status !== "active") {
        return res.status(403).json({ message: "Your enrollment is suspended. Contact the Super Admin." });
      }
      return res.status(200).json({
        enrollment: {
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          courses: row.courses || [],
          status: row.status,
        },
      });
    } catch (err) {
      console.error("academy login error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
  },

  list: async (req, res) => {
    try {
      const items = await AcademyEnrollment.findAll({
        attributes: ["id", "full_name", "email", "courses", "status", "createdAt"],
        order: [["createdAt", "DESC"]],
      });
      return res.status(200).json({ enrollments: items });
    } catch (err) {
      console.error("Academy list error:", err);
      return res.status(500).json({ message: "Failed to list enrollments" });
    }
  },

  create: async (req, res) => {
    const { full_name, email, password, courses } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: "full_name, email and password are required" });
    }
    try {
      const exists = await AcademyEnrollment.findOne({ where: { email } });
      if (exists) return res.status(400).json({ message: "An enrollment with this email already exists" });

      const created = await AcademyEnrollment.create({
        full_name,
        email,
        password,
        courses: Array.isArray(courses) ? courses : [],
      });
      return res.status(201).json({ enrollment: { id: created.id, full_name, email, courses: created.courses, status: created.status } });
    } catch (err) {
      console.error("Academy create error:", err);
      // Surface Sequelize validation / unique-constraint details so the UI can show why.
      const detail =
        err?.errors?.[0]?.message ||
        (err?.name === "SequelizeUniqueConstraintError" ? "An enrollment with this email already exists" : null) ||
        (err?.name === "SequelizeValidationError" ? "Invalid input" : null) ||
        err?.message ||
        "Failed to create enrollment";
      return res.status(500).json({ message: detail });
    }
  },

  update: async (req, res) => {
    const { id } = req.params;
    const { courses, status } = req.body;
    try {
      const row = await AcademyEnrollment.findByPk(id);
      if (!row) return res.status(404).json({ message: "Enrollment not found" });
      if (Array.isArray(courses)) row.courses = courses;
      if (status === "active" || status === "suspended") row.status = status;
      await row.save();
      return res.status(200).json({ enrollment: row });
    } catch (err) {
      console.error("Academy update error:", err);
      return res.status(500).json({ message: "Failed to update enrollment" });
    }
  },

  remove: async (req, res) => {
    const { id } = req.params;
    try {
      const row = await AcademyEnrollment.findByPk(id);
      if (!row) return res.status(404).json({ message: "Enrollment not found" });
      await row.destroy();
      return res.status(200).json({ message: "Enrollment removed" });
    } catch (err) {
      console.error("Academy delete error:", err);
      return res.status(500).json({ message: "Failed to remove enrollment" });
    }
  },
};
