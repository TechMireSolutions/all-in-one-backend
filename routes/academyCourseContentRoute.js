import express from "express";
import { academyCourseContentController, academyUpload } from "../controllers/academyCourseContentController.js";

const router = express.Router();

router.post("/upload", academyUpload.single("file"), academyCourseContentController.uploadFile);
router.get("/",       academyCourseContentController.list);
router.post("/",      academyCourseContentController.create);
router.put("/:id",    academyCourseContentController.update);
router.delete("/:id", academyCourseContentController.remove);

export default router;
