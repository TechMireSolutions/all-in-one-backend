import AcademyCourseContent from "../models/academyCourseContentModel.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads", "academy");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
export const academyUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

export const academyCourseContentController = {
  // POST /api/academy/course-contents/upload (multipart "file")
  uploadFile: async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const publicPath = `/uploads/academy/${req.file.filename}`;
    return res.status(200).json({
      file_name: req.file.originalname,
      file_url: publicPath,
      size: req.file.size,
    });
  },

  list: async (req, res) => {
    const { course } = req.query;
    try {
      const where = course ? { course } : undefined;
      const rows = await AcademyCourseContent.findAll({
        where,
        order: [["section", "ASC"], ["sort_order", "ASC"], ["createdAt", "ASC"]],
      });
      return res.status(200).json({ contents: rows });
    } catch (err) {
      console.error("course-content list error:", err);
      return res.status(500).json({ message: "Failed to list contents" });
    }
  },

  create: async (req, res) => {
    const { course, section, type, title, description, body, url, file_name, file_url, sort_order, time_limit_minutes, attempts_allowed, grading_method } = req.body;
    if (!course || !type || !title) {
      return res.status(400).json({ message: "course, type and title are required" });
    }
    try {
      const row = await AcademyCourseContent.create({
        course,
        section: section || "General",
        type,
        title,
        description: description || null,
        body: body || null,
        url: url || null,
        file_name: file_name || null,
        file_url:  file_url  || null,
        sort_order: Number.isInteger(sort_order) ? sort_order : 0,
        time_limit_minutes: Number.isInteger(time_limit_minutes) ? time_limit_minutes : 0,
        attempts_allowed:   Number.isInteger(attempts_allowed)   ? attempts_allowed   : 0,
        grading_method:     grading_method || "Highest grade",
      });
      return res.status(201).json({ content: row });
    } catch (err) {
      console.error("course-content create error:", err);
      return res.status(500).json({ message: "Failed to create content" });
    }
  },

  update: async (req, res) => {
    const { id } = req.params;
    try {
      const row = await AcademyCourseContent.findByPk(id);
      if (!row) return res.status(404).json({ message: "Not found" });
      const fields = ["section", "type", "title", "description", "body", "url", "file_name", "file_url", "sort_order", "time_limit_minutes", "attempts_allowed", "grading_method", "time_per_question_seconds", "negative_marks"];
      for (const f of fields) if (f in req.body) row[f] = req.body[f];
      await row.save();
      return res.status(200).json({ content: row });
    } catch (err) {
      console.error("course-content update error:", err);
      return res.status(500).json({ message: "Failed to update content" });
    }
  },

  remove: async (req, res) => {
    const { id } = req.params;
    try {
      const row = await AcademyCourseContent.findByPk(id);
      if (!row) return res.status(404).json({ message: "Not found" });
      await row.destroy();
      return res.status(200).json({ message: "Removed" });
    } catch (err) {
      console.error("course-content delete error:", err);
      return res.status(500).json({ message: "Failed to remove content" });
    }
  },
};
