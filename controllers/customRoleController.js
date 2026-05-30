import { sequelize } from "../DB/DBconnection.js";
import { QueryTypes } from "sequelize";
import CustomRole from "../models/customRoleModel.js";
// Lazy bootstrap: make sure the table + needed column exist before the request
// runs, so the feature works without requiring a manual backend restart.
let bootstrapped = false;
const ensureSchema = async () => {
  if (bootstrapped) return;
  await CustomRole.sync();
  try {
    const { DataTypes: DT } = await import("sequelize");
    const desc = await sequelize.getQueryInterface().describeTable("contacts");
    if (!desc.custom_role_id) {
      await sequelize.getQueryInterface().addColumn("contacts", "custom_role_id", { type: DT.INTEGER, allowNull: true });
    }
  } catch {}
  bootstrapped = true;
};

export const customRoleController = {
  // GET /api/roles
  list: async (_req, res) => {
    try {
      await ensureSchema();
      const rows = await CustomRole.findAll({ order: [["createdAt", "DESC"]] });
      return res.status(200).json({ roles: rows });
    } catch (err) {
      console.error("roles list:", err);
      return res.status(500).json({ message: err.message || "Failed to list roles" });
    }
  },

  // POST /api/roles  body: { name, description, allowed_pages }
  create: async (req, res) => {
    const { name, description, allowed_pages } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ message: "name required" });
    try {
      await ensureSchema();
      const row = await CustomRole.create({
        name: name.trim(),
        description: description || null,
        allowed_pages: Array.isArray(allowed_pages) ? allowed_pages : [],
      });
      return res.status(201).json({ role: row });
    } catch (err) {
      if (err.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ message: "A role with that name already exists" });
      }
      console.error("roles create:", err);
      return res.status(500).json({ message: err.message || "Failed to create role" });
    }
  },

  // PUT /api/roles/:id  body: { name, description, allowed_pages }
  update: async (req, res) => {
    try {
      await ensureSchema();
      const row = await CustomRole.findByPk(req.params.id);
      if (!row) return res.status(404).json({ message: "Not found" });
      const { name, description, allowed_pages } = req.body || {};
      if (name !== undefined) row.name = String(name).trim();
      if (description !== undefined) row.description = description || null;
      if (allowed_pages !== undefined) row.allowed_pages = Array.isArray(allowed_pages) ? allowed_pages : [];
      await row.save();
      return res.status(200).json({ role: row });
    } catch (err) {
      console.error("roles update:", err);
      return res.status(500).json({ message: err.message || "Failed to update role" });
    }
  },

  // DELETE /api/roles/:id
  remove: async (req, res) => {
    try {
      const row = await CustomRole.findByPk(req.params.id);
      if (!row) return res.status(404).json({ message: "Not found" });
      await row.destroy();
      try {
        await sequelize.query(`UPDATE contacts SET custom_role_id = NULL WHERE custom_role_id = :id`, {
          replacements: { id: req.params.id }, type: QueryTypes.UPDATE,
        });
      } catch {}
      return res.status(200).json({ message: "Removed" });
    } catch (err) {
      console.error("roles remove:", err);
      return res.status(500).json({ message: "Failed to remove" });
    }
  },

  // GET /api/roles/users  → all contacts with their primary email and assigned role
  listUsers: async (_req, res) => {
    try {
      await ensureSchema();
      const users = [];

      const safeQuery = async (sql, opts = {}) => {
        try { return await sequelize.query(sql, { type: QueryTypes.SELECT, ...opts }); }
        catch (e) { console.error("roles listUsers query failed:", sql, "→", e.message); return []; }
      };
      const describe = async (t) => { try { return await sequelize.getQueryInterface().describeTable(t); } catch { return {}; } };

      // ── Contacts ────────────────────────────────────────────────────────
      const cCols = await describe("contacts");
      if (cCols.id) {
        const cols = ["id", "first_name", "last_name", cCols.custom_role_id ? "custom_role_id" : null].filter(Boolean);
        const rows = await safeQuery(`SELECT ${cols.join(", ")} FROM contacts`);
        let emailsByContact = {};
        try {
          const ec = await describe("contact_emails");
          const fkCol = ec.contactId ? `"contactId"` : (ec.contact_id ? "contact_id" : null);
          if (fkCol && ec.email_address && rows.length) {
            const ids = rows.map((r) => r.id);
            const er = await safeQuery(
              `SELECT ${fkCol} AS fk, email_address FROM contact_emails WHERE ${fkCol} IN (:ids)`,
              { replacements: { ids } }
            );
            er.forEach((r) => { if (!emailsByContact[r.fk]) emailsByContact[r.fk] = r.email_address; });
          }
        } catch {}
        rows.forEach((c) => users.push({
          id: c.id, type: "contact",
          email: emailsByContact[c.id] || "",
          full_name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          custom_role_id: c.custom_role_id || null,
        }));
      }

      // ── HR ──────────────────────────────────────────────────────────────
      const hrCols = await describe("hr_users");
      if (hrCols.id) {
        const cols = ["id", "email", hrCols.custom_role_id ? "custom_role_id" : null].filter(Boolean);
        const rows = await safeQuery(`SELECT ${cols.join(", ")} FROM hr_users`);
        rows.forEach((r) => users.push({
          id: r.id, type: "hr", email: r.email, full_name: r.email,
          custom_role_id: r.custom_role_id || null,
        }));
      }

      // ── Employees (record_type = 'employee' inside users) ──────────────
      const uCols = await describe("users");
      if (uCols.id) {
        const cols = ["id", uCols.full_name ? "full_name" : null, uCols.email ? "email" : null, uCols.custom_role_id ? "custom_role_id" : null].filter(Boolean);
        const where = uCols.record_type ? `WHERE record_type = 'employee'` : "";
        const rows = await safeQuery(`SELECT ${cols.join(", ")} FROM users ${where}`);
        rows.forEach((r) => users.push({
          id: r.id, type: "employee",
          email: r.email || "",  // may be encrypted; left as-is
          full_name: r.full_name || "",
          custom_role_id: r.custom_role_id || null,
        }));
      }

      // ── OJT trainees ───────────────────────────────────────────────────
      const oCols = await describe("ojts");
      if (oCols.id) {
        const cols = ["id", "full_name", "email", oCols.custom_role_id ? "custom_role_id" : null].filter(Boolean);
        const rows = await safeQuery(`SELECT ${cols.join(", ")} FROM ojts`);
        rows.forEach((r) => users.push({
          id: r.id, type: "ojt", email: r.email || "", full_name: r.full_name || "",
          custom_role_id: r.custom_role_id || null,
        }));
      }

      // ── Students ───────────────────────────────────────────────────────
      const sCols = await describe("students");
      if (sCols.id) {
        const cols = ["id", "full_name", "email", sCols.custom_role_id ? "custom_role_id" : null].filter(Boolean);
        const rows = await safeQuery(`SELECT ${cols.join(", ")} FROM students`);
        rows.forEach((r) => users.push({
          id: r.id, type: "student", email: r.email || "", full_name: r.full_name || "",
          custom_role_id: r.custom_role_id || null,
        }));
      }

      return res.status(200).json({ users });
    } catch (err) {
      console.error("roles listUsers:", err);
      return res.status(500).json({ message: err.message || "Failed to list users" });
    }
  },

  // PUT /api/roles/assign/:type/:id  body: { custom_role_id }
  assign: async (req, res) => {
    const { type, id } = req.params;
    const { custom_role_id } = req.body || {};
    const tableMap = { contact: "contacts", hr: "hr_users", employee: "users", ojt: "ojts", student: "students" };
    const table = tableMap[type];
    if (!table) return res.status(400).json({ message: "Invalid user type" });
    try {
      await ensureSchema();
      await sequelize.query(
        `UPDATE ${table} SET custom_role_id = :rid WHERE id = :id`,
        { replacements: { rid: custom_role_id || null, id }, type: QueryTypes.UPDATE }
      );
      return res.status(200).json({ message: "Role assigned", custom_role_id: custom_role_id || null });
    } catch (err) {
      console.error("roles assign:", err);
      return res.status(500).json({ message: "Failed to assign role" });
    }
  },
};
