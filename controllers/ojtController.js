import OJT from "../models/ojtModel.js"

export const ojtController = {
  // ✅ Create a new OJT trainee
  create: async (req, res) => {
    try {
      const {
        ojt_id, full_name, email, cnic, contact_number,
        gender, dob, joining_date, level, department,
        institute, degree, project_name, project_description,
        project_technologies, supervisor, status, description,
        project_start_date, project_end_date,
        custom_role_id,
      } = req.body

      if (!ojt_id || !full_name || !email || !cnic || !joining_date) {
        return res.status(400).json({ message: "ojt_id, full_name, email, cnic, and joining_date are required" })
      }

      const existing = await OJT.findOne({ where: { email } })
      if (existing) return res.status(400).json({ message: "An OJT trainee with this email already exists" })

      const existingCnic = await OJT.findOne({ where: { cnic } })
      if (existingCnic) return res.status(400).json({ message: "An OJT trainee with this CNIC already exists" })

      const ojt = await OJT.create({
        ojt_id, full_name, email, cnic, contact_number,
        gender, dob, joining_date,
        level: level || "ojt level 1",
        department, institute, degree,
        project_name, project_description,
        project_technologies: project_technologies || [],
        project_start_date, project_end_date,
        supervisor,
        status: status || "Active",
        description,
        custom_role_id: custom_role_id || null,
      })

      return res.status(201).json({ message: "OJT trainee created successfully", ojt })
    } catch (error) {
      console.error("❌ Create OJT error:", error.stack)
      return res.status(500).json({ message: "Failed to create OJT trainee" })
    }
  },

  // ✅ Get all OJT trainees
  getAll: async (req, res) => {
    try {
      const ojts = await OJT.findAll({ order: [["createdAt", "DESC"]] })
      return res.status(200).json({ ojts })
    } catch (error) {
      console.error("❌ Get OJT error:", error.stack)
      return res.status(500).json({ message: "Failed to fetch OJT trainees" })
    }
  },

  // ✅ Get single OJT by ID
  getById: async (req, res) => {
    try {
      const ojt = await OJT.findByPk(req.params.id)
      if (!ojt) return res.status(404).json({ message: "OJT trainee not found" })
      return res.status(200).json({ ojt })
    } catch (error) {
      console.error("❌ Get OJT error:", error.stack)
      return res.status(500).json({ message: "Failed to fetch OJT trainee" })
    }
  },

  // ✅ Update OJT trainee
  update: async (req, res) => {
    try {
      const ojt = await OJT.findByPk(req.params.id)
      if (!ojt) return res.status(404).json({ message: "OJT trainee not found" })

      await ojt.update(req.body)
      return res.status(200).json({ message: "OJT trainee updated successfully", ojt })
    } catch (error) {
      console.error("❌ Update OJT error:", error.stack)
      return res.status(500).json({ message: "Failed to update OJT trainee" })
    }
  },

  // ✅ Delete OJT trainee
  delete: async (req, res) => {
    try {
      const ojt = await OJT.findByPk(req.params.id)
      if (!ojt) return res.status(404).json({ message: "OJT trainee not found" })

      await ojt.destroy()
      return res.status(200).json({ message: "OJT trainee deleted successfully" })
    } catch (error) {
      console.error("❌ Delete OJT error:", error.stack)
      return res.status(500).json({ message: "Failed to delete OJT trainee" })
    }
  },
}
