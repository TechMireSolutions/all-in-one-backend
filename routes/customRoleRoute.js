import express from "express";
import { customRoleController } from "../controllers/customRoleController.js";

const router = express.Router();

router.get("/",         customRoleController.list);
router.post("/",        customRoleController.create);
router.put("/:id",      customRoleController.update);
router.delete("/:id",   customRoleController.remove);
router.get("/users",    customRoleController.listUsers);
router.put("/assign/:type/:id", customRoleController.assign);

export default router;
