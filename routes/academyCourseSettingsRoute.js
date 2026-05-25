import express from "express";
import {
  academyCourseSettingsController,
  courseImageUpload,
} from "../controllers/academyCourseSettingsController.js";

const router = express.Router();

router.post("/upload-image", courseImageUpload.single("file"), academyCourseSettingsController.uploadImage);
router.get("/",  academyCourseSettingsController.get);
router.put("/",  academyCourseSettingsController.upsert);

export default router;
