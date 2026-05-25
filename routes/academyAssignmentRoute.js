import express from "express";
import { academyAssignmentController } from "../controllers/academyAssignmentController.js";

const router = express.Router();

router.post("/:contentId/submissions", academyAssignmentController.submit);
router.get("/:contentId/submissions",  academyAssignmentController.list);
router.put("/submissions/:id",         academyAssignmentController.grade);

export default router;
