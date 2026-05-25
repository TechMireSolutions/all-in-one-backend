import express from "express";
import { academyEnrollmentController } from "../controllers/academyEnrollmentController.js";

const router = express.Router();

router.get("/me",     academyEnrollmentController.findByEmail);
router.post("/login", academyEnrollmentController.login);
router.get("/",       academyEnrollmentController.list);
router.post("/",      academyEnrollmentController.create);
router.put("/:id",    academyEnrollmentController.update);
router.delete("/:id", academyEnrollmentController.remove);

export default router;
