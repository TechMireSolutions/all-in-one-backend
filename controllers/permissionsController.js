import { sequelize } from "../DB/DBconnection.js";
import { QueryTypes } from "sequelize";
import HrUser from "../models/hrUsers.js";
import OJT from "../models/ojtModel.js";
import Student from "../models/studentModel.js";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-cbc";
const keyBuffer = ENCRYPTION_KEY ? Buffer.from(ENCRYPTION_KEY, "hex") : null;

const decrypt = (text) => {
  if (!text || typeof text !== "string") return null;
  try {
    if (!text.includes(":")) return text;
    const parts = text.split(":");
    if (parts.length !== 2 || !keyBuffer) return text;
    const iv = Buffer.from(parts[0], "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    let dec = decipher.update(parts[1], "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
  } catch {
    return text;
  }
};

const parseAllowed = (raw) => {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

export const permissionsController = {
  // List all users that can have permissions assigned (HR + Employees + OJT + Students)
  listUsers: async (req, res) => {
    try {
      const hrs = await HrUser.findAll({ attributes: ["id", "email", "allowed_pages"] });

      const employees = await sequelize.query(
        "SELECT id, full_name, email, allowed_pages FROM users WHERE record_type = 'employee'",
        { type: QueryTypes.SELECT }
      );

      const ojts = await OJT.findAll({ attributes: ["id", "full_name", "email", "allowed_pages"] }).catch(() => []);
      const students = await Student.findAll({ attributes: ["id", "full_name", "email", "allowed_pages"] }).catch(() => []);

      const result = [
        ...hrs.map((h) => ({
          id: h.id,
          type: "hr",
          email: h.email,
          full_name: h.email,
          allowed_pages: parseAllowed(h.allowed_pages),
        })),
        ...employees.map((e) => ({
          id: e.id,
          type: "employee",
          email: decrypt(e.email) || e.email,
          full_name: e.full_name,
          allowed_pages: parseAllowed(e.allowed_pages),
        })),
        ...ojts.map((o) => ({
          id: o.id,
          type: "ojt",
          email: o.email,
          full_name: o.full_name,
          allowed_pages: parseAllowed(o.allowed_pages),
        })),
        ...students.map((s) => ({
          id: s.id,
          type: "student",
          email: s.email,
          full_name: s.full_name,
          allowed_pages: parseAllowed(s.allowed_pages),
        })),
      ];

      return res.status(200).json({ users: result });
    } catch (err) {
      console.error("listUsers error:", err);
      return res.status(500).json({ message: "Failed to list users" });
    }
  },

  // Update allowed_pages for a single user
  updateAllowedPages: async (req, res) => {
    const { type, id } = req.params;
    const { allowed_pages } = req.body;

    if (allowed_pages !== null && !Array.isArray(allowed_pages)) {
      return res.status(400).json({ message: "allowed_pages must be an array or null" });
    }

    try {
      const payload = allowed_pages === null ? null : JSON.stringify(allowed_pages);

      let affected = 0;
      if (type === "hr") {
        [, affected] = await sequelize.query(
          "UPDATE hr_users SET allowed_pages = :p WHERE id = :id",
          { replacements: { p: payload, id }, type: QueryTypes.UPDATE }
        );
      } else if (type === "employee") {
        [, affected] = await sequelize.query(
          "UPDATE users SET allowed_pages = :p WHERE id = :id",
          { replacements: { p: payload, id }, type: QueryTypes.UPDATE }
        );
      } else if (type === "ojt") {
        [, affected] = await sequelize.query(
          "UPDATE ojts SET allowed_pages = :p WHERE id = :id",
          { replacements: { p: payload, id }, type: QueryTypes.UPDATE }
        );
      } else if (type === "student") {
        [, affected] = await sequelize.query(
          "UPDATE students SET allowed_pages = :p WHERE id = :id",
          { replacements: { p: payload, id }, type: QueryTypes.UPDATE }
        );
      } else {
        return res.status(400).json({ message: "Invalid user type" });
      }

      return res.status(200).json({ message: "Permissions updated", allowed_pages });
    } catch (err) {
      console.error("updateAllowedPages error:", err);
      return res.status(500).json({ message: "Failed to update permissions" });
    }
  },
};
