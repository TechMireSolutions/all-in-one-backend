import Assignment from "../models/assignmentModel.js";
import Asset from "../models/assetModel.js";

export const assignmentController = {
  // ✅ Get all assignments
  getAll: async (req, res) => {
    try {
      const assignments = await Assignment.findAll({
        include: [{ model: Asset, as: "asset" }],
        order: [["createdAt", "DESC"]],
      });
      return res.status(200).json(assignments);
    } catch (error) {
      console.error("❌ Get all assignments error:", error.stack);
      return res.status(500).json({ error: "Failed to fetch assignments" });
    }
  },

  // ✅ Get single assignment by ID
  getById: async (req, res) => {
    try {
      const assignment = await Assignment.findByPk(req.params.id, {
        include: [{ model: Asset, as: "asset" }],
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      return res.status(200).json(assignment);
    } catch (error) {
      console.error("❌ Get assignment error:", error.stack);
      return res.status(500).json({ error: "Failed to fetch assignment" });
    }
  },

  // ✅ Create new assignment (Replicates signals.py post_save)
  create: async (req, res) => {
    try {
      const { asset: assetId, employee_name, shift, assignment_date, return_date } = req.body;

      if (!assetId || !employee_name) {
        return res.status(400).json({ error: "assetId and employee_name are required" });
      }

      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        return res.status(404).json({ error: "Associated Asset not found" });
      }

      const assignment = await Assignment.create({
        assetId,
        employee_name,
        shift: shift || "Full-time",
        assignment_date: assignment_date || new Date(),
        return_date: return_date || null
      });

      // Mirror Django signals: update asset status to 'Assigned'
      await asset.update({ status: "Assigned" });

      return res.status(201).json(assignment);
    } catch (error) {
      console.error("❌ Create assignment error:", error.stack);
      return res.status(500).json({ error: "Failed to create assignment" });
    }
  },

  // ✅ Update assignment
  update: async (req, res) => {
    try {
      const assignment = await Assignment.findByPk(req.params.id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      await assignment.update(req.body);
      return res.status(200).json(assignment);
    } catch (error) {
      console.error("❌ Update assignment error:", error.stack);
      return res.status(500).json({ error: "Failed to update assignment" });
    }
  },

  // ✅ Delete assignment
  delete: async (req, res) => {
    try {
      const assignment = await Assignment.findByPk(req.params.id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Optional: When assignment is deleted/returned, we can reset asset status back to 'Available'
      const asset = await Asset.findByPk(assignment.assetId);
      if (asset) {
        await asset.update({ status: "Available" });
      }

      await assignment.destroy();
      return res.status(204).send();
    } catch (error) {
      console.error("❌ Delete assignment error:", error.stack);
      return res.status(500).json({ error: "Failed to delete assignment" });
    }
  },
};
