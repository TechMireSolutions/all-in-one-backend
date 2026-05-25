import express from "express";
import { permissionsController } from "../controllers/permissionsController.js";

const router = express.Router();

router.get("/users", permissionsController.listUsers);
router.put("/users/:type/:id", permissionsController.updateAllowedPages);

export default router;
