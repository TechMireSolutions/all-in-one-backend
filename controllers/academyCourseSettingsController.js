import AcademyCourseSettings from "../models/academyCourseSettingsModel.js";
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
export const courseImageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const FIELDS = [
  "full_name", "short_name", "category", "visibility",
  "start_date", "end_date", "end_date_enabled", "course_id_number",
  "summary", "image_url",
  "format", "hidden_sections", "course_layout",
  "force_language", "num_announcements", "show_gradebook",
  "show_activity_reports", "show_activity_dates",
  "max_upload_size",
  "completion_enabled", "show_completion_conditions",
  "group_mode", "force_group_mode", "default_grouping",
  "tags",
  "course_duration",
];

export const academyCourseSettingsController = {
  // POST /api/academy/course-settings/upload-image (multipart "file")
  uploadImage: async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    return res.status(200).json({
      image_url: `/uploads/academy/${req.file.filename}`,
      file_name: req.file.originalname,
    });
  },

  // GET /api/academy/course-settings?course=...
  get: async (req, res) => {
    const { course } = req.query;
    if (!course) return res.status(400).json({ message: "course is required" });
    try {
      const row = await AcademyCourseSettings.findOne({ where: { course } });
      return res.status(200).json({ settings: row || null });
    } catch (err) {
      console.error("course-settings get error:", err);
      return res.status(500).json({ message: "Failed to load settings" });
    }
  },

  // PUT /api/academy/course-settings  (upsert by course title in body)
  upsert: async (req, res) => {
    const { course } = req.body;
    if (!course) return res.status(400).json({ message: "course is required" });
    try {
      const payload = { course };
      for (const f of FIELDS) if (f in req.body) payload[f] = req.body[f];
      const existing = await AcademyCourseSettings.findOne({ where: { course } });
      let row;
      if (existing) {
        await existing.update(payload);
        row = existing;
      } else {
        row = await AcademyCourseSettings.create(payload);
      }
      return res.status(200).json({ settings: row });
    } catch (err) {
      console.error("course-settings upsert error:", err);
      return res.status(500).json({ message: "Failed to save settings" });
    }
  },
};
