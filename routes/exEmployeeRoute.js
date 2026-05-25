// routes/exEmployeeRoute.js
import express from "express";
import { getExEmployees, deleteExEmployee, createExEmployee } from "../controllers/exEmployeeController.js";

const router = express.Router();

// Routes
router.get("/", getExEmployees); // Fetch all ex-employees
router.post("/", createExEmployee); // Create/Add a new ex-employee directly
router.delete("/:id", deleteExEmployee); // Delete an ex-employee by ID

export default router;