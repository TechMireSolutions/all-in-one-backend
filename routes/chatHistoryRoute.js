import express from "express";
import { chatHistoryController } from "../controllers/chatHistoryController.js";

const router = express.Router();

router.get("/", chatHistoryController.getAll);
router.get("/ ", chatHistoryController.getAll); // Handles trailing slash if hit as folder

export default router;
