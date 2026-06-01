import express from "express";
import {
  // Forms
  getForms, getFormById, createForm, updateForm, deleteForm, publishForm, cloneForm,
  // Public
  getPublicForm, submitRegistration,
  // Admin: registrations
  listRegistrations, getRegistrationById,
  updateRegistrationStatus, bulkUpdateStatus, recordPayment, exportRegistrationsCSV,
  // Roles (child of Registration)
  addRole, updateRole, removeRole,
  // Students / OJTs (read/write child tables)
  listStudents, updateStudent, listOJTs, updateOJT,
} from "../controllers/registrationController.js";

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────────────────
router.get("/public/forms/:slug",         getPublicForm);
router.post("/public/forms/:slug/submit", submitRegistration);

// ── Forms (admin) ──────────────────────────────────────────────────────────
router.get("/forms",         getForms);
router.post("/forms",        createForm);
router.get("/forms/:id",     getFormById);
router.put("/forms/:id",     updateForm);
router.delete("/forms/:id",  deleteForm);
router.post("/forms/:id/publish", publishForm);
router.post("/forms/:id/clone",   cloneForm);

// Registrations under a form
router.get("/forms/:formId/registrations", listRegistrations);
router.get("/forms/:id/export.csv",        exportRegistrationsCSV);

// ── Registration detail / status / payment ─────────────────────────────────
router.get("/registrations/:id",               getRegistrationById);
router.patch("/registrations/:id/status",      updateRegistrationStatus);
router.patch("/registrations/bulk-status",     bulkUpdateStatus);
router.post("/registrations/:id/payment",      recordPayment);

// ── Roles (child of Registration) ──────────────────────────────────────────
router.post("/registrations/:id/roles",            addRole);
router.patch("/registrations/:id/roles/:roleId",   updateRole);
router.delete("/registrations/:id/roles/:roleId",  removeRole);

// ── Students / OJTs — direct child-table endpoints (no separate module) ────
router.get("/students",    listStudents);
router.patch("/students/:id", updateStudent);
router.get("/ojts",        listOJTs);
router.patch("/ojts/:id",  updateOJT);

export default router;
