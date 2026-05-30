import express from "express";
import multer from "multer";
import { projectTrackerController } from "../controllers/projectTrackerController.js";

const router = express.Router();
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

router.post("/", projectTrackerController.create);
router.get("/", projectTrackerController.getAll);
router.post("/bulk-import", projectTrackerController.bulkImport);
router.post("/parse-pdf", pdfUpload.single("file"), projectTrackerController.parsePdf);
router.get("/:id", projectTrackerController.getById);
router.put("/:id", projectTrackerController.update);
router.delete("/:id", projectTrackerController.delete);

export default router;
