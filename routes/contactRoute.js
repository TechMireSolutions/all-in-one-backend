// backend/routes/contactRoute.js
import express from "express";
import multer from "multer";
import {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  checkDuplicates,
  mergeContacts,
  undoMerge,
  getMergeLogs,
} from "../controllers/contactController.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// CRUD operations
router.get("/", getContacts);
router.get("/duplicates", checkDuplicates);
router.get("/logs", getMergeLogs);
router.get("/:id", getContactById);

router.post("/", upload.single("profile_picture"), createContact);
router.post("/merge", mergeContacts);
router.post("/undo", undoMerge);

router.put("/:id", upload.single("profile_picture"), updateContact);
router.delete("/:id", deleteContact);

export default router;
