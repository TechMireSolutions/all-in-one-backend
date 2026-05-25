import express from "express";
import { academyQuizController, quizPdfUpload } from "../controllers/academyQuizController.js";

const router = express.Router();

// Import MCQs from PDF
router.post("/:contentId/import-pdf", quizPdfUpload.single("file"), academyQuizController.importPdf);
router.post("/:contentId/import-text", academyQuizController.importText);
router.post("/:contentId/import-uploaded-pdf", academyQuizController.importUploadedPdf);

// Questions
router.get("/:contentId/questions",    academyQuizController.listQuestions);
router.post("/:contentId/questions",   academyQuizController.createQuestion);
router.put("/questions/:id",           academyQuizController.updateQuestion);
router.delete("/questions/:id",        academyQuizController.removeQuestion);

// Attempts
router.post("/:contentId/attempts/start", academyQuizController.startAttempt);
router.put("/attempts/:id",               academyQuizController.saveAttempt);
router.get("/:contentId/attempts",        academyQuizController.listAttempts);

export default router;
