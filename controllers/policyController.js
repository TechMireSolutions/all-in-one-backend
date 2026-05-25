import Policy from "../models/policyModel.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Multer setup ─────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "..", "uploads", "policies");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg"];
  const ext = path.extname(file.originalname).toLowerCase();
  allowed.includes(ext) ? cb(null, true) : cb(new Error("Unsupported file type"), false);
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Controller ───────────────────────────────────────────────────────────────
export const policyController = {
  // ✅ Create a new policy (with optional file)
  create: async (req, res) => {
    try {
      const { title, content, category, createdBy } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required." });
      }
      if (!content && !req.file) {
        return res.status(400).json({ message: "Provide policy content or upload a file." });
      }

      const fileUrl = req.file
        ? `/uploads/policies/${req.file.filename}`
        : null;

      const policy = await Policy.create({
        title,
        content: content || "",
        category: category || "Revised Course Enrollment Annextures new 2026",
        createdBy: createdBy || "Admin",
        fileUrl,
      });

      return res.status(201).json({ message: "Policy created successfully", policy });
    } catch (error) {
      console.error("❌ Create policy error:", error.stack);
      return res.status(500).json({ message: "Failed to create policy" });
    }
  },

  // ✅ Get all policies
  getAll: async (req, res) => {
    try {
      const policies = await Policy.findAll({ order: [["createdAt", "DESC"]] });
      return res.status(200).json({ policies });
    } catch (error) {
      console.error("❌ Get policies error:", error.stack);
      return res.status(500).json({ message: "Failed to fetch policies" });
    }
  },

  // ✅ Get single policy by ID
  getById: async (req, res) => {
    try {
      const policy = await Policy.findByPk(req.params.id);
      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }
      return res.status(200).json({ policy });
    } catch (error) {
      console.error("❌ Get policy error:", error.stack);
      return res.status(500).json({ message: "Failed to fetch policy" });
    }
  },

  // ✅ Update policy (with optional new file)
  update: async (req, res) => {
    try {
      const policy = await Policy.findByPk(req.params.id);
      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }

      let fileUrl = policy.fileUrl;

      if (req.file) {
        // Delete old file if exists
        if (policy.fileUrl) {
          const oldPath = path.join(__dirname, "..", policy.fileUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        fileUrl = `/uploads/policies/${req.file.filename}`;
      }

      // Allow removing file if removeFile flag is sent
      if (req.body.removeFile === "true") {
        if (policy.fileUrl) {
          const oldPath = path.join(__dirname, "..", policy.fileUrl);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        fileUrl = null;
      }

      await policy.update({ ...req.body, fileUrl });
      return res.status(200).json({ message: "Policy updated successfully", policy });
    } catch (error) {
      console.error("❌ Update policy error:", error.stack);
      return res.status(500).json({ message: "Failed to update policy" });
    }
  },

  // ✅ Delete policy (also removes file)
  delete: async (req, res) => {
    try {
      const policy = await Policy.findByPk(req.params.id);
      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }

      // Delete associated file if exists
      if (policy.fileUrl) {
        const filePath = path.join(__dirname, "..", policy.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      await policy.destroy();
      return res.status(200).json({ message: "Policy deleted successfully" });
    } catch (error) {
      console.error("❌ Delete policy error:", error.stack);
      return res.status(500).json({ message: "Failed to delete policy" });
    }
  },
};
