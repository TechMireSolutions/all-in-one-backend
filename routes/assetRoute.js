import express from "express";
import { assetController } from "../controllers/assetController.js";

const router = express.Router();

// Base routes for assets
router.get("/", assetController.getAll);
router.post("/", assetController.create);

// Routes for specific asset by ID (with and without trailing slashes)
router.get("/:id", assetController.getById);
router.get("/:id/", assetController.getById);

router.put("/:id", assetController.update);
router.put("/:id/", assetController.update);
router.patch("/:id", assetController.update);
router.patch("/:id/", assetController.update);

router.delete("/:id", assetController.delete);
router.delete("/:id/", assetController.delete);

// Support Chat Route
router.post("/:id/support", assetController.support);
router.post("/:id/support/", assetController.support);

export default router;
