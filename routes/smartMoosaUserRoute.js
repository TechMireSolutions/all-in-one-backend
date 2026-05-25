import express from "express";
import { smartMoosaUserController } from "../controllers/smartMoosaUserController.js";

const router = express.Router();

// Support both trailing-slash and normal endpoints to mirror Django's routing
router.post("/register", smartMoosaUserController.register);
router.post("/register/", smartMoosaUserController.register);

router.post("/token", smartMoosaUserController.token);
router.post("/token/", smartMoosaUserController.token);

export default router;
