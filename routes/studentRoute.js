import express from "express"
import { studentController } from "../controllers/studentController.js"

const router = express.Router()

router.post("/", studentController.create)
router.get("/", studentController.getAll)
router.get("/:id", studentController.getById)
router.put("/:id", studentController.update)
router.delete("/:id", studentController.delete)

export default router
