import express from "express";
import { policyController, upload } from "../controllers/policyController.js";

const router = express.Router();

router.post("/",      upload.single("policyFile"), policyController.create);
router.get("/",       policyController.getAll);
router.get("/:id",    policyController.getById);
router.put("/:id",    upload.single("policyFile"), policyController.update);
router.delete("/:id", policyController.delete);

export default router;
