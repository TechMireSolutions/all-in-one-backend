import express from "express"
import { ojtController } from "../controllers/ojtController.js"

const router = express.Router()

router.post("/", ojtController.create)
router.get("/", ojtController.getAll)
router.get("/:id", ojtController.getById)
router.put("/:id", ojtController.update)
router.delete("/:id", ojtController.delete)

export default router
