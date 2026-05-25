import Student from "../models/studentModel.js"

export const studentController = {
  // ✅ Create a new student
  create: async (req, res) => {
    try {
      const {
        student_id, full_name, email, cnic, contact_number,
        gender, dob, joining_date, courses, institute,
        degree, course_start_date, course_end_date, status, description,
        custom_role_id,
      } = req.body

      if (!student_id || !full_name || !email || !cnic || !joining_date) {
        return res.status(400).json({ message: "student_id, full_name, email, cnic, and joining_date are required" })
      }

      const existing = await Student.findOne({ where: { email } })
      if (existing) return res.status(400).json({ message: "A student with this email already exists" })

      const existingCnic = await Student.findOne({ where: { cnic } })
      if (existingCnic) return res.status(400).json({ message: "A student with this CNIC already exists" })

      const student = await Student.create({
        student_id, full_name, email, cnic, contact_number,
        gender, dob, joining_date,
        courses: courses || [],
        institute, degree, course_start_date, course_end_date,
        status: status || "Active",
        description,
        custom_role_id: custom_role_id || null,
      })

      return res.status(201).json({ message: "Student created successfully", student })
    } catch (error) {
      console.error("❌ Create student error:", error.stack)
      return res.status(500).json({ message: "Failed to create student" })
    }
  },

  // ✅ Get all students
  getAll: async (req, res) => {
    try {
      const students = await Student.findAll({ order: [["createdAt", "DESC"]] })
      return res.status(200).json({ students })
    } catch (error) {
      console.error("❌ Get students error:", error.stack)
      return res.status(500).json({ message: "Failed to fetch students" })
    }
  },

  // ✅ Get single student by ID
  getById: async (req, res) => {
    try {
      const student = await Student.findByPk(req.params.id)
      if (!student) return res.status(404).json({ message: "Student not found" })
      return res.status(200).json({ student })
    } catch (error) {
      console.error("❌ Get student error:", error.stack)
      return res.status(500).json({ message: "Failed to fetch student" })
    }
  },

  // ✅ Update student
  update: async (req, res) => {
    try {
      const student = await Student.findByPk(req.params.id)
      if (!student) return res.status(404).json({ message: "Student not found" })

      await student.update(req.body)
      return res.status(200).json({ message: "Student updated successfully", student })
    } catch (error) {
      console.error("❌ Update student error:", error.stack)
      return res.status(500).json({ message: "Failed to update student" })
    }
  },

  // ✅ Delete student
  delete: async (req, res) => {
    try {
      const student = await Student.findByPk(req.params.id)
      if (!student) return res.status(404).json({ message: "Student not found" })

      await student.destroy()
      return res.status(200).json({ message: "Student deleted successfully" })
    } catch (error) {
      console.error("❌ Delete student error:", error.stack)
      return res.status(500).json({ message: "Failed to delete student" })
    }
  },
}
