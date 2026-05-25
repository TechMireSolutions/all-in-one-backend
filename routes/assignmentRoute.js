import express from "express";
import { assignmentController } from "../controllers/assignmentController.js";

const router = express.Router();

router.get("/", assignmentController.getAll);
router.post("/", assignmentController.create);

router.get("/:id", assignmentController.getById);
router.get("/:id/", assignmentController.getById);

router.put("/:id", assignmentController.update);
router.put("/:id/", assignmentController.update);

router.delete("/:id", assignmentController.delete);
router.delete("/:id/", assignmentController.delete);

export default router;
