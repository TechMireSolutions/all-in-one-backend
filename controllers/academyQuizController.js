import AcademyQuizQuestion from "../models/academyQuizQuestionModel.js";
import AcademyQuizAttempt from "../models/academyQuizAttemptModel.js";
import AcademyCourseContent from "../models/academyCourseContentModel.js";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export const quizPdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Parse MCQ blocks from raw PDF text.
// Expected pattern (loose): "<n>. <question text>"  followed by lines like "A) ...", "B) ...", etc.
// Optional answer key line "Answer: B" / "Correct: C" / "Ans: A" updates correct_index.
const parseMcqs = (text) => {
  const norm = (text || "")
    .replace(/ /g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  const blockRe = /(?:^|\s)(\d{1,3})[.)]\s+(.+?)(?=(?:\s\d{1,3}[.)]\s+)|$)/g;
  const blocks = [];
  let bm;
  while ((bm = blockRe.exec(norm)) !== null) blocks.push(bm[2]);

  const optRe = /(?:^|\s)\(?([A-Ha-h])\)?[).:\-]\s+/g;
  const ansRe = /\b(?:answer|correct|ans)\s*[:\-]?\s*\(?([A-Ha-h])\)?/i;

  const out = [];
  for (const blkBody of blocks) {
    let body = blkBody.trim();
    let correct_index = 0;
    const ansMatch = body.match(ansRe);
    if (ansMatch) {
      correct_index = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
      body = body.slice(0, ansMatch.index).trim();
    }

    const positions = [];
    let om;
    optRe.lastIndex = 0;
    while ((om = optRe.exec(body)) !== null) {
      const matchedAt = om.index + (om[0].startsWith(" ") ? 1 : 0);
      positions.push({ idx: matchedAt, end: om.index + om[0].length });
    }
    if (positions.length < 2) continue;

    const question_text = body.slice(0, positions[0].idx).trim();
    if (!question_text) continue;

    const options = [];
    for (let i = 0; i < positions.length && options.length < 8; i++) {
      const start = positions[i].end;
      const end = i + 1 < positions.length ? positions[i + 1].idx : body.length;
      const opt = body.slice(start, end).trim();
      if (opt) options.push(opt);
    }
    if (options.length < 2) continue;
    if (correct_index < 0 || correct_index >= options.length) correct_index = 0;
    out.push({ question_text, options, correct_index });
  }
  return out;
};


const sanitizeQuestionRow = (q, includeAnswer = true) => ({
  id: q.id,
  content_id: q.content_id,
  question_text: q.question_text,
  options: q.options || [],
  sort_order: q.sort_order,
  ...(includeAnswer ? { correct_index: q.correct_index } : {}),
});

const sanitizeQuestion = (q, includeAnswer = false) => {
  const base = {
    id: q.id,
    content_id: q.content_id,
    question_text: q.question_text,
    options: q.options || [],
    sort_order: q.sort_order,
  };
  if (includeAnswer) base.correct_index = q.correct_index;
  return base;
};

// Shared helper: insert parsed MCQs into the quiz_questions table.
const insertParsedMcqs = async (contentId, mcqs) => {
  const existing = await AcademyQuizQuestion.count({ where: { content_id: contentId } });
  const rows = [];
  for (let i = 0; i < mcqs.length; i++) {
    const m = mcqs[i];
    const row = await AcademyQuizQuestion.create({
      content_id: Number(contentId),
      question_text: m.question_text,
      options: m.options,
      correct_index: m.correct_index || 0,
      sort_order: existing + i,
    });
    rows.push(sanitizeQuestionRow(row, true));
  }
  return rows;
};

export const academyQuizController = {
  // POST /api/academy/quiz/:contentId/import-uploaded-pdf  body: { file_url }
  importUploadedPdf: async (req, res) => {
    const { contentId } = req.params;
    const { file_url } = req.body || {};
    if (!file_url) return res.status(400).json({ message: "file_url required" });
    try {
      const path = await import("path");
      const fs = await import("fs");
      const { fileURLToPath } = await import("url");
      const __filename = fileURLToPath(import.meta.url);
      const __dirname  = path.dirname(__filename);
      // Resolve "/uploads/..." against the backend root.
      const rel = file_url.replace(/^\//, "");
      const abs = path.join(__dirname, "..", rel);
      if (!fs.existsSync(abs)) return res.status(404).json({ message: "Uploaded file not found on server" });
      const buf = fs.readFileSync(abs);
      const lower = abs.toLowerCase();
      let extractedText = "";
      if (lower.endsWith(".pdf")) {
        const parsed = await pdfParse(buf);
        extractedText = parsed.text || "";
      } else if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) {
        extractedText = buf.toString("utf8");
      } else {
        return res.status(400).json({ message: "Unsupported file type — use .pdf or .txt" });
      }
      const mcqs = parseMcqs(extractedText);
      if (mcqs.length === 0) {
        const snippet = extractedText.replace(/\s+/g, " ").slice(0, 300);
        return res.status(400).json({ message: `No MCQs detected. Extracted text: "${snippet}"` });
      }
      const rows = await insertParsedMcqs(contentId, mcqs);
      return res.status(201).json({ imported: rows.length, questions: rows });
    } catch (err) {
      console.error("quiz importUploadedPdf:", err);
      return res.status(500).json({ message: err.message || "Failed to import" });
    }
  },

  // POST /api/academy/quiz/:contentId/import-text  body: { text }
  importText: async (req, res) => {
    const { contentId } = req.params;
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ message: "Paste the MCQ text in the 'text' field." });
    try {
      const mcqs = parseMcqs(text);
      if (mcqs.length === 0) {
        const snippet = text.replace(/\s+/g, " ").slice(0, 200);
        return res.status(400).json({
          message: `Could not detect any MCQs. Expected '1. Question A) opt B) opt C) opt …'. You pasted: "${snippet}"`,
        });
      }
      const rows = await insertParsedMcqs(contentId, mcqs);
      return res.status(201).json({ imported: rows.length, questions: rows });
    } catch (err) {
      console.error("quiz importText:", err);
      return res.status(500).json({ message: err.message || "Failed to import text" });
    }
  },

  // POST /api/academy/quiz/:contentId/import-pdf  (multipart "file")
  importPdf: async (req, res) => {
    const { contentId } = req.params;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const parsed = await pdfParse(req.file.buffer);
      const rawText = parsed.text || "";
      const mcqs = parseMcqs(rawText);
      if (mcqs.length === 0) {
        // Include a snippet of the extracted text so the admin can see why parsing failed.
        const snippet = rawText.replace(/\s+/g, " ").slice(0, 400);
        return res.status(400).json({
          message: `Could not detect any MCQs in this PDF. Expected numbered questions (e.g. '1.') with options 'A) ... B) ...'. Extracted text starts with: "${snippet}"`,
        });
      }
      const existing = await AcademyQuizQuestion.count({ where: { content_id: contentId } });
      const rows = [];
      for (let i = 0; i < mcqs.length; i++) {
        const m = mcqs[i];
        const row = await AcademyQuizQuestion.create({
          content_id: Number(contentId),
          question_text: m.question_text,
          options: m.options,
          correct_index: m.correct_index || 0,
          sort_order: existing + i,
        });
        rows.push(sanitizeQuestionRow(row, true));
      }
      return res.status(201).json({ imported: rows.length, questions: rows });
    } catch (err) {
      console.error("quiz importPdf:", err);
      return res.status(500).json({ message: "Failed to import PDF" });
    }
  },

  // GET /api/academy/quiz/:contentId/questions?reveal=1
  listQuestions: async (req, res) => {
    const { contentId } = req.params;
    const reveal = req.query.reveal === "1";
    try {
      const rows = await AcademyQuizQuestion.findAll({
        where: { content_id: contentId },
        order: [["sort_order", "ASC"], ["id", "ASC"]],
      });
      return res.status(200).json({ questions: rows.map((r) => sanitizeQuestion(r, reveal)) });
    } catch (err) {
      console.error("quiz listQuestions:", err);
      return res.status(500).json({ message: "Failed to list questions" });
    }
  },

  // POST /api/academy/quiz/:contentId/questions
  createQuestion: async (req, res) => {
    const { contentId } = req.params;
    const { question_text, options, correct_index, sort_order } = req.body;
    if (!question_text || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: "question_text and at least 2 options required" });
    }
    try {
      const row = await AcademyQuizQuestion.create({
        content_id: Number(contentId),
        question_text,
        options,
        correct_index: Number.isInteger(correct_index) ? correct_index : 0,
        sort_order: Number.isInteger(sort_order) ? sort_order : 0,
      });
      return res.status(201).json({ question: sanitizeQuestion(row, true) });
    } catch (err) {
      console.error("quiz createQuestion:", err);
      return res.status(500).json({ message: "Failed to create question" });
    }
  },

  // PUT /api/academy/quiz/questions/:id
  updateQuestion: async (req, res) => {
    const { id } = req.params;
    try {
      const row = await AcademyQuizQuestion.findByPk(id);
      if (!row) return res.status(404).json({ message: "Not found" });
      const fields = ["question_text", "options", "correct_index", "sort_order"];
      for (const f of fields) if (f in req.body) row[f] = req.body[f];
      await row.save();
      return res.status(200).json({ question: sanitizeQuestion(row, true) });
    } catch (err) {
      console.error("quiz updateQuestion:", err);
      return res.status(500).json({ message: "Failed to update question" });
    }
  },

  // DELETE /api/academy/quiz/questions/:id
  removeQuestion: async (req, res) => {
    const { id } = req.params;
    try {
      const row = await AcademyQuizQuestion.findByPk(id);
      if (!row) return res.status(404).json({ message: "Not found" });
      await row.destroy();
      return res.status(200).json({ message: "Removed" });
    } catch (err) {
      console.error("quiz removeQuestion:", err);
      return res.status(500).json({ message: "Failed to remove" });
    }
  },

  // POST /api/academy/quiz/:contentId/attempts/start  body: { email }
  startAttempt: async (req, res) => {
    const { contentId } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email required" });
    try {
      const content = await AcademyCourseContent.findByPk(contentId);
      if (!content) return res.status(404).json({ message: "Quiz not found" });

      // Enforce attempts_allowed if set.
      const attemptsAllowed = content.attempts_allowed || 2;
      const finished = await AcademyQuizAttempt.count({
        where: { content_id: contentId, student_email: email, status: "finished" },
      });
      if (finished >= attemptsAllowed) {
        return res.status(403).json({ message: `Maximum attempts (${attemptsAllowed}) reached.` });
      }

      // Resume any in-progress attempt instead of creating a new one.
      let attempt = await AcademyQuizAttempt.findOne({
        where: { content_id: contentId, student_email: email, status: "in_progress" },
      });
      if (!attempt) {
        attempt = await AcademyQuizAttempt.create({
          content_id: Number(contentId),
          student_email: email,
          started_at: new Date(),
          answers: {},
        });
      }

      const questions = await AcademyQuizQuestion.findAll({
        where: { content_id: contentId },
        order: [["sort_order", "ASC"], ["id", "ASC"]],
      });

      return res.status(200).json({
        attempt: {
          id: attempt.id,
          started_at: attempt.started_at,
          answers: attempt.answers || {},
          time_limit_minutes: content.time_limit_minutes || 0,
          time_per_question_seconds: content.time_per_question_seconds || 0,
          negative_marks: content.negative_marks || 0,
        },
        questions: questions.map((q) => sanitizeQuestion(q, false)),
      });
    } catch (err) {
      console.error("quiz startAttempt:", err);
      return res.status(500).json({ message: "Failed to start attempt" });
    }
  },

  // PUT /api/academy/quiz/attempts/:id   body: { answers, finish }
  saveAttempt: async (req, res) => {
    const { id } = req.params;
    const { answers, finish } = req.body;
    try {
      const attempt = await AcademyQuizAttempt.findByPk(id);
      if (!attempt) return res.status(404).json({ message: "Attempt not found" });
      if (attempt.status === "finished") return res.status(400).json({ message: "Already finished" });

      if (answers && typeof answers === "object") attempt.answers = answers;

      if (finish) {
        const questions = await AcademyQuizQuestion.findAll({ where: { content_id: attempt.content_id } });
        const content = await AcademyCourseContent.findByPk(attempt.content_id);
        const negative = Number(content?.negative_marks || 0.25);
        let score = 0;
        const ans = attempt.answers || {};
        questions.forEach((q) => {
          const given = ans[q.id];
          if (given == null) return;
          if (Number(given) === Number(q.correct_index)) score += 1;
          else score -= negative;
        });
        if (score < 0) score = 0;
        attempt.score = score;
        attempt.total = questions.length;
        attempt.status = "finished";
        attempt.finished_at = new Date();
      }
      await attempt.save();
      return res.status(200).json({ attempt });
    } catch (err) {
      console.error("quiz saveAttempt:", err);
      return res.status(500).json({ message: "Failed to save attempt" });
    }
  },

  // GET /api/academy/quiz/:contentId/attempts?email=...
  listAttempts: async (req, res) => {
    const { contentId } = req.params;
    const { email } = req.query;
    try {
      const where = { content_id: contentId };
      if (email) where.student_email = email;
      const rows = await AcademyQuizAttempt.findAll({
        where,
        order: [["createdAt", "DESC"]],
      });
      return res.status(200).json({ attempts: rows });
    } catch (err) {
      console.error("quiz listAttempts:", err);
      return res.status(500).json({ message: "Failed to list attempts" });
    }
  },
};
