// Registration controller — dynamic form admin + public submission + role-driven
// auto-creation of Student/OJT child rows.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sequelize } from "../DB/DBconnection.js";
import { Op } from "sequelize";
import { Contact } from "../models/contactModel.js";
import {
  RegistrationForm,
  RegistrationSection,
  RegistrationField,
  Registration,
  RegistrationAnswer,
  RegistrationStatusLog,
  RegistrationRole,
  RegistrationStudent,
  RegistrationOJT,
  RegistrationEmployee,
} from "../models/registrationModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Helpers ───────────────────────────────────────────────────────────────
const E164 = /^\+?[1-9]\d{6,14}$/;
const EMAIL_RX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const CNIC_RX = /^\d{5}-\d{7}-\d{1}$|^\d{13}$/;

const validateCnic = (cnic, gender) => {
  if (!CNIC_RX.test(cnic)) return "CNIC must be 13 digits (with or without dashes)";
  const last = parseInt(String(cnic).replace(/\D/g, "")[12], 10);
  if (gender === "Male"   && last % 2 === 0) return "Last digit of CNIC for Male must be odd";
  if (gender === "Female" && last % 2 !== 0) return "Last digit of CNIC for Female must be even";
  return null;
};

const FULL_FORM_INCLUDES = [
  { model: RegistrationSection, as: "sections", separate: true, order: [["order_index", "ASC"]] },
  { model: RegistrationField,   as: "fields",   separate: true, order: [["order_index", "ASC"]] },
];

const FULL_REG_INCLUDES = [
  { model: RegistrationForm,      as: "form" },
  { model: RegistrationAnswer,    as: "answers" },
  { model: RegistrationStatusLog, as: "statusLogs" },
  { model: RegistrationRole,      as: "roles" },
  { model: RegistrationStudent,   as: "students" },
  { model: RegistrationOJT,       as: "ojts" },
  { model: RegistrationEmployee,  as: "employees" },
  { model: Contact,               as: "contact" },
];

// Generate a sequential identifier per-year per-prefix. Looks up the highest
// existing one and increments. Race-safe enough for a single Node process; for
// distributed deploys, replace with a DB sequence.
const nextSeq = async (Model, column, prefix) => {
  const year = new Date().getFullYear();
  const rows = await Model.findAll({
    where: { [column]: { [Op.like]: `${prefix}-${year}-%` } },
    attributes: [column],
  });
  const used = rows
    .map((r) => parseInt(String(r[column]).split("-")[2] || "0", 10))
    .filter((n) => !Number.isNaN(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(6, "0")}`;
};

// Auto-create a Student or OJT child row for a given role.
const createRoleChild = async (registration, roleName, transaction) => {
  if (roleName === "Student") {
    const student_number = await nextSeq(RegistrationStudent, "student_number", "STD");
    return RegistrationStudent.create({
      registrationId: registration.id,
      contactId: registration.contactId,
      student_number,
      enrollment_date: new Date(),
      status: "Active",
    }, { transaction });
  }
  if (roleName === "OJT") {
    const ojt_number = await nextSeq(RegistrationOJT, "ojt_number", "OJT");
    return RegistrationOJT.create({
      registrationId: registration.id,
      contactId: registration.contactId,
      ojt_number,
      status: "Pending",
    }, { transaction });
  }
  if (roleName === "Employee" || roleName === "Staff") {
    const employee_id = await nextSeq(RegistrationEmployee, "employee_id", "EMP");
    return RegistrationEmployee.create({
      registrationId: registration.id,
      contactId: registration.contactId,
      employee_id,
      joining_date: new Date(),
      designation: roleName === "Staff" ? "Staff" : "Employee",
      is_probation: true,
      status: "Probation",
    }, { transaction });
  }
  return null;
};

// Soft-archive a Student/OJT child row when its role is removed.
const archiveRoleChild = async (registrationId, roleName, transaction) => {
  if (roleName === "Student") {
    await RegistrationStudent.update(
      { status: "Dropped" },
      { where: { registrationId, status: { [Op.notIn]: ["Dropped", "Graduated"] } }, transaction }
    );
  }
  if (roleName === "OJT") {
    await RegistrationOJT.update(
      { status: "Terminated" },
      { where: { registrationId, status: { [Op.notIn]: ["Terminated", "Completed"] } }, transaction }
    );
  }
  if (roleName === "Employee" || roleName === "Staff") {
    await RegistrationEmployee.update(
      { status: "Resigned", leaving_date: new Date() },
      { where: { registrationId, status: { [Op.notIn]: ["Terminated", "Resigned", "Retired"] } }, transaction }
    );
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// FORM ADMIN
// ═══════════════════════════════════════════════════════════════════════════
export const getForms = async (req, res) => {
  try {
    const forms = await RegistrationForm.findAll({ order: [["createdAt", "DESC"]] });
    res.json(forms);
  } catch (e) {
    res.status(500).json({ message: "Failed to list forms", error: e.message });
  }
};

export const getFormById = async (req, res) => {
  try {
    const form = await RegistrationForm.findByPk(req.params.id, { include: FULL_FORM_INCLUDES });
    if (!form) return res.status(404).json({ message: "Form not found" });
    res.json(form);
  } catch (e) {
    res.status(500).json({ message: "Failed to load form", error: e.message });
  }
};

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 64);

export const createForm = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { title, slug, description, category, status, opens_at, closes_at, capacity,
            link_contact, require_cnic, require_payment, fee_amount, sections = [], fields = [] } = req.body;
    if (!title) { await t.rollback(); return res.status(400).json({ message: "Title required" }); }
    const finalSlug = slug ? slugify(slug) : slugify(title);

    const form = await RegistrationForm.create({
      title, slug: finalSlug, description, category, status: status || "Draft",
      opens_at, closes_at, capacity, link_contact, require_cnic, require_payment, fee_amount,
      created_by: req.body.created_by || null,
    }, { transaction: t });

    // Sections first (so their IDs can be referenced by fields)
    const secIdMap = {}; // temp_id (from client) → real UUID
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const row = await RegistrationSection.create({
        formId: form.id,
        title: s.title,
        description: s.description,
        order_index: s.order_index ?? i,
      }, { transaction: t });
      if (s.temp_id) secIdMap[s.temp_id] = row.id;
    }

    // Fields — unique field_key per form enforced
    const keys = new Set();
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.field_key || !f.label) {
        await t.rollback();
        return res.status(400).json({ message: `Field at index ${i} missing field_key or label` });
      }
      if (keys.has(f.field_key)) {
        await t.rollback();
        return res.status(400).json({ message: `Duplicate field_key "${f.field_key}"` });
      }
      keys.add(f.field_key);
      await RegistrationField.create({
        formId: form.id,
        sectionId: f.sectionId ? (secIdMap[f.sectionId] || f.sectionId) : null,
        field_key: f.field_key,
        label: f.label,
        help_text: f.help_text,
        field_type: f.field_type || "text",
        is_required: !!f.is_required,
        is_unique: !!f.is_unique,
        options: f.options || null,
        validation: f.validation || null,
        default_value: f.default_value,
        order_index: f.order_index ?? i,
        mapped_contact_field: f.mapped_contact_field,
        conditional_logic: f.conditional_logic || null,
      }, { transaction: t });
    }

    await t.commit();
    const full = await RegistrationForm.findByPk(form.id, { include: FULL_FORM_INCLUDES });
    res.status(201).json(full);
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Failed to create form", error: e.message });
  }
};

export const updateForm = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const form = await RegistrationForm.findByPk(req.params.id, { transaction: t });
    if (!form) { await t.rollback(); return res.status(404).json({ message: "Form not found" }); }

    const { title, slug, description, category, status, opens_at, closes_at, capacity,
            link_contact, require_cnic, require_payment, fee_amount, sections, fields } = req.body;
    await form.update({
      title: title ?? form.title,
      slug: slug ? slugify(slug) : form.slug,
      description, category, status, opens_at, closes_at, capacity,
      link_contact, require_cnic, require_payment, fee_amount,
    }, { transaction: t });

    if (Array.isArray(sections)) {
      await RegistrationSection.destroy({ where: { formId: form.id }, transaction: t });
      const secIdMap = {};
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const row = await RegistrationSection.create({
          formId: form.id, title: s.title, description: s.description, order_index: s.order_index ?? i,
        }, { transaction: t });
        if (s.temp_id) secIdMap[s.temp_id] = row.id;
      }
      if (Array.isArray(fields)) {
        await RegistrationField.destroy({ where: { formId: form.id }, transaction: t });
        const keys = new Set();
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          if (!f.field_key || !f.label) {
            await t.rollback();
            return res.status(400).json({ message: `Field at index ${i} missing field_key or label` });
          }
          if (keys.has(f.field_key)) {
            await t.rollback();
            return res.status(400).json({ message: `Duplicate field_key "${f.field_key}"` });
          }
          keys.add(f.field_key);
          await RegistrationField.create({
            formId: form.id,
            sectionId: f.sectionId ? (secIdMap[f.sectionId] || f.sectionId) : null,
            field_key: f.field_key, label: f.label, help_text: f.help_text,
            field_type: f.field_type || "text",
            is_required: !!f.is_required, is_unique: !!f.is_unique,
            options: f.options || null, validation: f.validation || null,
            default_value: f.default_value, order_index: f.order_index ?? i,
            mapped_contact_field: f.mapped_contact_field,
            conditional_logic: f.conditional_logic || null,
          }, { transaction: t });
        }
      }
    }

    await t.commit();
    const full = await RegistrationForm.findByPk(form.id, { include: FULL_FORM_INCLUDES });
    res.json(full);
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Failed to update form", error: e.message });
  }
};

export const deleteForm = async (req, res) => {
  try {
    const form = await RegistrationForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });
    await form.destroy();
    res.json({ message: "Form deleted (cascaded all sections, fields, registrations)" });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete form", error: e.message });
  }
};

export const publishForm = async (req, res) => {
  try {
    const form = await RegistrationForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });
    await form.update({ status: "Open" });
    res.json(form);
  } catch (e) {
    res.status(500).json({ message: "Failed to publish form", error: e.message });
  }
};

export const cloneForm = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const source = await RegistrationForm.findByPk(req.params.id, { include: FULL_FORM_INCLUDES, transaction: t });
    if (!source) { await t.rollback(); return res.status(404).json({ message: "Form not found" }); }
    const baseSlug = `${source.slug}-copy`;
    let i = 1, slug = baseSlug;
    while (await RegistrationForm.findOne({ where: { slug }, transaction: t })) {
      i += 1; slug = `${baseSlug}-${i}`;
    }
    const cloned = await RegistrationForm.create({
      title: `${source.title} (copy)`,
      slug,
      description: source.description, category: source.category, status: "Draft",
      opens_at: source.opens_at, closes_at: source.closes_at, capacity: source.capacity,
      link_contact: source.link_contact, require_cnic: source.require_cnic,
      require_payment: source.require_payment, fee_amount: source.fee_amount,
    }, { transaction: t });

    const secMap = {};
    for (const s of source.sections || []) {
      const ns = await RegistrationSection.create({
        formId: cloned.id, title: s.title, description: s.description, order_index: s.order_index,
      }, { transaction: t });
      secMap[s.id] = ns.id;
    }
    for (const f of source.fields || []) {
      await RegistrationField.create({
        formId: cloned.id, sectionId: f.sectionId ? secMap[f.sectionId] : null,
        field_key: f.field_key, label: f.label, help_text: f.help_text,
        field_type: f.field_type, is_required: f.is_required, is_unique: f.is_unique,
        options: f.options, validation: f.validation, default_value: f.default_value,
        order_index: f.order_index, mapped_contact_field: f.mapped_contact_field,
        conditional_logic: f.conditional_logic,
      }, { transaction: t });
    }
    await t.commit();
    const full = await RegistrationForm.findByPk(cloned.id, { include: FULL_FORM_INCLUDES });
    res.status(201).json(full);
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Failed to clone form", error: e.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC: get form by slug + submit
// ═══════════════════════════════════════════════════════════════════════════
export const getPublicForm = async (req, res) => {
  try {
    const form = await RegistrationForm.findOne({
      where: { slug: req.params.slug, status: "Open" },
      include: FULL_FORM_INCLUDES,
    });
    if (!form) return res.status(404).json({ message: "Form not found or not currently open" });
    res.json(form);
  } catch (e) {
    res.status(500).json({ message: "Failed to load form", error: e.message });
  }
};

const evalCondition = (fieldDef, answersByKey) => {
  const cl = fieldDef.conditional_logic;
  if (!cl?.show_if?.field_key) return true;
  const { field_key, op, value } = cl.show_if;
  const other = answersByKey[field_key];
  switch (op) {
    case "=":  case "==": case "equals": return String(other) === String(value);
    case "!=": case "not_equals":         return String(other) !== String(value);
    case "includes":                       return Array.isArray(other) && other.includes(value);
    case "exists":                         return other !== undefined && other !== null && other !== "";
    default:                               return true;
  }
};

export const submitRegistration = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const form = await RegistrationForm.findOne({
      where: { slug: req.params.slug, status: "Open" },
      include: FULL_FORM_INCLUDES, transaction: t,
    });
    if (!form) { await t.rollback(); return res.status(404).json({ message: "Form not found or not open" }); }

    // Capacity check (atomic-ish: count under the transaction)
    if (form.capacity) {
      const current = await Registration.count({
        where: { formId: form.id, status: { [Op.in]: ["Submitted", "Under Review", "Approved", "Waitlisted"] } },
        transaction: t,
      });
      if (current >= form.capacity) {
        await t.rollback();
        return res.status(409).json({ message: "This form has reached capacity. Try again later." });
      }
    }

    const rawBody = req.body || {};
    const answers = typeof rawBody.answers === "string" ? JSON.parse(rawBody.answers) : (rawBody.answers || {});
    const rolesIn = typeof rawBody.roles   === "string" ? JSON.parse(rawBody.roles)   : (rawBody.roles   || []);

    const fields = form.fields || [];
    const fieldByKey = Object.fromEntries(fields.map((f) => [f.field_key, f]));

    // Resolve conditional visibility first
    const visibleKeys = new Set();
    fields.forEach((f) => { if (evalCondition(f, answers)) visibleKeys.add(f.field_key); });

    // Validate each visible field
    for (const f of fields) {
      if (!visibleKeys.has(f.field_key)) continue;
      const val = answers[f.field_key];
      const present = !(val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0));
      if (f.is_required && !present) {
        await t.rollback();
        return res.status(400).json({ message: `${f.label} is required` });
      }
      if (!present) continue;
      const v = String(val);
      const rules = f.validation || {};
      if (f.field_type === "email" && !EMAIL_RX.test(v)) { await t.rollback(); return res.status(400).json({ message: `${f.label}: invalid email` }); }
      if (f.field_type === "phone" && !E164.test(v))   { await t.rollback(); return res.status(400).json({ message: `${f.label}: phone must be E.164 (+CC...)` }); }
      if (f.field_type === "cnic") {
        const err = validateCnic(v, answers.gender);
        if (err) { await t.rollback(); return res.status(400).json({ message: `${f.label}: ${err}` }); }
      }
      if (f.field_type === "url" && !/^https?:\/\//i.test(v)) { await t.rollback(); return res.status(400).json({ message: `${f.label}: URL must start with http(s)://` }); }
      if (rules.minLength && v.length < rules.minLength)    { await t.rollback(); return res.status(400).json({ message: `${f.label}: must be at least ${rules.minLength} characters` }); }
      if (rules.maxLength && v.length > rules.maxLength)    { await t.rollback(); return res.status(400).json({ message: `${f.label}: cannot exceed ${rules.maxLength} characters` }); }
      if (rules.regex && !new RegExp(rules.regex).test(v))  { await t.rollback(); return res.status(400).json({ message: `${f.label}: invalid format` }); }
      if (f.field_type === "number") {
        const n = Number(v);
        if (Number.isNaN(n)) { await t.rollback(); return res.status(400).json({ message: `${f.label}: must be a number` }); }
        if (rules.min !== undefined && n < rules.min) { await t.rollback(); return res.status(400).json({ message: `${f.label}: must be ≥ ${rules.min}` }); }
        if (rules.max !== undefined && n > rules.max) { await t.rollback(); return res.status(400).json({ message: `${f.label}: must be ≤ ${rules.max}` }); }
      }
      // is_unique — scan existing answers for the same field
      if (f.is_unique) {
        const conflict = await RegistrationAnswer.findOne({
          where: { fieldId: f.id, [Op.or]: [{ value_text: v }, { value_number: Number(v) || null }] },
          transaction: t,
        });
        if (conflict) { await t.rollback(); return res.status(409).json({ message: `${f.label}: "${v}" is already used in another submission` }); }
      }
    }

    // Date range checks across pairs that share a base key like *_start / *_end
    for (const f of fields) {
      if (!visibleKeys.has(f.field_key)) continue;
      if (f.field_key.endsWith("_end")) {
        const startKey = f.field_key.replace(/_end$/, "_start");
        if (answers[startKey] && answers[f.field_key] && new Date(answers[f.field_key]) < new Date(answers[startKey])) {
          await t.rollback();
          return res.status(400).json({ message: `${f.label}: end date cannot be before start date` });
        }
      }
    }

    // Contact link (by CNIC)
    let contactId = null;
    if (form.link_contact) {
      const cnicField = fields.find((f) => f.field_type === "cnic");
      const cnicVal = cnicField ? answers[cnicField.field_key] : null;
      if (cnicVal) {
        const digits = String(cnicVal).replace(/\D/g, "");
        const all = await Contact.findAll({ attributes: ["id", "cnic"], transaction: t });
        const match = all.find((c) => String(c.cnic || "").replace(/\D/g, "") === digits);
        if (match) {
          contactId = match.id;
        } else {
          // Build new Contact from mapped_contact_field values
          const mapped = {};
          fields.forEach((f) => {
            if (f.mapped_contact_field && answers[f.field_key] !== undefined) {
              mapped[f.mapped_contact_field] = answers[f.field_key];
            }
          });
          if (mapped.first_name && mapped.last_name && mapped.cnic && mapped.gender && mapped.dob) {
            try {
              const c = await Contact.create({
                first_name: mapped.first_name, last_name: mapped.last_name,
                cnic: mapped.cnic, gender: mapped.gender, dob: new Date(mapped.dob),
                is_syed: !!mapped.is_syed,
              }, { transaction: t });
              contactId = c.id;
            } catch { /* keep contactId null on collision */ }
          }
        }
      }
    }

    // Insert the registration row
    const registration_number = await nextSeq(Registration, "registration_number", "REG");
    const registration = await Registration.create({
      formId: form.id,
      contactId,
      registration_number,
      status: "Submitted",
      payment_status: form.require_payment ? "Pending" : "N/A",
      source: "Web",
      ip_address: req.ip,
    }, { transaction: t });

    // Initial status log
    await RegistrationStatusLog.create({
      registrationId: registration.id,
      from_status: null, to_status: "Submitted",
      note: "Submitted via public form",
    }, { transaction: t });

    // Answers
    for (const f of fields) {
      if (!visibleKeys.has(f.field_key)) continue;
      const val = answers[f.field_key];
      if (val === undefined || val === null || val === "") continue;
      const payload = { registrationId: registration.id, fieldId: f.id, field_key: f.field_key };
      if (["multiselect", "checkbox", "section_repeater"].includes(f.field_type)) {
        payload.value_json = Array.isArray(val) ? val : [val];
      } else if (f.field_type === "boolean") {
        payload.value_boolean = !!val;
      } else if (f.field_type === "number") {
        payload.value_number = Number(val);
      } else if (["date", "datetime"].includes(f.field_type)) {
        payload.value_date = new Date(val);
      } else if (f.field_type === "file") {
        payload.file_url = val;
      } else {
        payload.value_text = String(val);
      }
      await RegistrationAnswer.create(payload, { transaction: t });
    }

    // Roles — default to [Participant] if none supplied
    const rolesList = Array.isArray(rolesIn) && rolesIn.length
      ? rolesIn
      : [{ role_name: "Participant", is_primary: true }];

    // Only one primary allowed; if multiple sent, keep first.
    let primarySeen = false;
    for (const r of rolesList) {
      const isP = !!r.is_primary && !primarySeen;
      if (isP) primarySeen = true;
      const roleRow = await RegistrationRole.create({
        registrationId: registration.id,
        role_name: r.role_name || "Participant",
        role_label: r.role_label || null,
        is_primary: isP,
        start_date: r.start_date, end_date: r.end_date,
        permissions: r.permissions, notes: r.notes,
      }, { transaction: t });
      await createRoleChild(registration, roleRow.role_name, t);
    }

    await t.commit();
    const full = await Registration.findByPk(registration.id, { include: FULL_REG_INCLUDES });
    res.status(201).json(full);
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Failed to submit registration", error: e.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: list / detail / status / payment / export
// ═══════════════════════════════════════════════════════════════════════════
export const listRegistrations = async (req, res) => {
  try {
    const { formId } = req.params;
    const { status, payment_status, role, search, page = 1, pageSize = 25 } = req.query;
    const where = { formId };
    if (status) where.status = status;
    if (payment_status) where.payment_status = payment_status;
    if (search) {
      where[Op.or] = [{ registration_number: { [Op.like]: `%${search}%` } }];
    }
    const offset = (Number(page) - 1) * Number(pageSize);
    const include = [
      { model: RegistrationRole, as: "roles", required: !!role, where: role ? { role_name: role } : undefined },
      { model: Contact, as: "contact" },
    ];
    const { rows, count } = await Registration.findAndCountAll({
      where, include, order: [["submitted_at", "DESC"]], limit: Number(pageSize), offset, distinct: true,
    });
    res.json({ rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  } catch (e) {
    res.status(500).json({ message: "Failed to list registrations", error: e.message });
  }
};

export const getRegistrationById = async (req, res) => {
  try {
    const reg = await Registration.findByPk(req.params.id, { include: FULL_REG_INCLUDES });
    if (!reg) return res.status(404).json({ message: "Registration not found" });
    res.json(reg);
  } catch (e) {
    res.status(500).json({ message: "Failed to load registration", error: e.message });
  }
};

const VALID_TRANSITIONS = {
  "Submitted":     ["Under Review", "Approved", "Rejected", "Waitlisted", "Withdrawn", "Cancelled"],
  "Under Review":  ["Approved", "Rejected", "Waitlisted", "Withdrawn", "Cancelled"],
  "Waitlisted":    ["Approved", "Rejected", "Withdrawn", "Cancelled"],
  "Approved":      ["Cancelled", "Withdrawn"],
  "Rejected":      ["Under Review"],
  "Withdrawn":     [],
  "Cancelled":     [],
};

export const updateRegistrationStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const reg = await Registration.findByPk(req.params.id, { transaction: t });
    if (!reg) { await t.rollback(); return res.status(404).json({ message: "Not found" }); }
    const { to_status, note, changed_by } = req.body;
    if (!VALID_TRANSITIONS[reg.status]?.includes(to_status)) {
      await t.rollback();
      return res.status(400).json({ message: `Cannot transition ${reg.status} → ${to_status}` });
    }
    const from = reg.status;
    await reg.update({ status: to_status, reviewed_by: changed_by, reviewed_at: new Date(), review_notes: note }, { transaction: t });
    await RegistrationStatusLog.create({
      registrationId: reg.id, from_status: from, to_status, changed_by, note,
    }, { transaction: t });
    await t.commit();
    res.json({ message: "Status updated", from, to: to_status });
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Failed to update status", error: e.message });
  }
};

export const bulkUpdateStatus = async (req, res) => {
  const { ids, to_status, note, changed_by } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: "ids required" });
  const t = await sequelize.transaction();
  try {
    const regs = await Registration.findAll({ where: { id: { [Op.in]: ids } }, transaction: t });
    let updated = 0, skipped = 0;
    for (const r of regs) {
      if (!VALID_TRANSITIONS[r.status]?.includes(to_status)) { skipped += 1; continue; }
      const from = r.status;
      await r.update({ status: to_status, reviewed_by: changed_by, reviewed_at: new Date(), review_notes: note }, { transaction: t });
      await RegistrationStatusLog.create({
        registrationId: r.id, from_status: from, to_status, changed_by, note,
      }, { transaction: t });
      updated += 1;
    }
    await t.commit();
    res.json({ updated, skipped });
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Bulk update failed", error: e.message });
  }
};

export const recordPayment = async (req, res) => {
  try {
    const reg = await Registration.findByPk(req.params.id);
    if (!reg) return res.status(404).json({ message: "Not found" });
    const { payment_status, payment_ref } = req.body;
    await reg.update({ payment_status, payment_ref });
    res.json(reg);
  } catch (e) {
    res.status(500).json({ message: "Failed to record payment", error: e.message });
  }
};

export const exportRegistrationsCSV = async (req, res) => {
  try {
    const { id: formId } = req.params;
    const form = await RegistrationForm.findByPk(formId, { include: FULL_FORM_INCLUDES });
    if (!form) return res.status(404).json({ message: "Form not found" });
    const regs = await Registration.findAll({
      where: { formId },
      include: [
        { model: RegistrationAnswer, as: "answers" },
        { model: RegistrationRole,   as: "roles" },
      ],
      order: [["submitted_at", "DESC"]],
    });

    const fieldKeys = (form.fields || []).sort((a, b) => a.order_index - b.order_index).map((f) => f.field_key);
    const headers = ["registration_number", "status", "submitted_at", "payment_status", "roles", ...fieldKeys];
    const escape = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(",")];

    for (const r of regs) {
      const ans = Object.fromEntries(r.answers.map((a) => {
        let v = a.value_text;
        if (a.value_number !== null && v === null) v = a.value_number;
        if (a.value_date && !v) v = new Date(a.value_date).toISOString().slice(0, 10);
        if (a.value_boolean !== null && v === null) v = a.value_boolean ? "Yes" : "No";
        if (a.value_json && !v) v = JSON.stringify(a.value_json);
        if (a.file_url && !v) v = a.file_url;
        return [a.field_key, v];
      }));
      const roleNames = r.roles.map((rr) => rr.role_name).join("; ");
      const row = [
        r.registration_number, r.status, r.submitted_at?.toISOString(),
        r.payment_status, roleNames, ...fieldKeys.map((k) => ans[k] ?? ""),
      ].map(escape).join(",");
      lines.push(row);
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${form.slug}-registrations.csv"`);
    res.send(lines.join("\n"));
  } catch (e) {
    res.status(500).json({ message: "Export failed", error: e.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ROLES (child table of Registration) — add / patch / delete
// ═══════════════════════════════════════════════════════════════════════════
export const addRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const reg = await Registration.findByPk(req.params.id, { transaction: t });
    if (!reg) { await t.rollback(); return res.status(404).json({ message: "Registration not found" }); }
    const { role_name, role_label, is_primary, start_date, end_date, notes, permissions } = req.body;
    if (is_primary) {
      await RegistrationRole.update({ is_primary: false }, { where: { registrationId: reg.id }, transaction: t });
    }
    const role = await RegistrationRole.create({
      registrationId: reg.id, role_name, role_label, is_primary: !!is_primary,
      start_date, end_date, notes, permissions,
    }, { transaction: t });
    await createRoleChild(reg, role_name, t);
    await t.commit();
    res.status(201).json(role);
  } catch (e) {
    await t.rollback();
    if (e?.name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "This role is already assigned to the registration." });
    res.status(500).json({ message: "Failed to add role", error: e.message });
  }
};

export const updateRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = await RegistrationRole.findByPk(req.params.roleId, { transaction: t });
    if (!role || role.registrationId !== req.params.id) { await t.rollback(); return res.status(404).json({ message: "Role not found on this registration" }); }
    const { is_primary } = req.body;
    if (is_primary) {
      await RegistrationRole.update({ is_primary: false }, { where: { registrationId: role.registrationId }, transaction: t });
    }
    await role.update(req.body, { transaction: t });
    await t.commit();
    res.json(role);
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Failed to update role", error: e.message });
  }
};

export const removeRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = await RegistrationRole.findByPk(req.params.roleId, { transaction: t });
    if (!role || role.registrationId !== req.params.id) { await t.rollback(); return res.status(404).json({ message: "Role not found on this registration" }); }
    const name = role.role_name;
    await role.destroy({ transaction: t });
    await archiveRoleChild(req.params.id, name, t);
    await t.commit();
    res.json({ message: `Role "${name}" removed` });
  } catch (e) {
    await t.rollback();
    res.status(500).json({ message: "Failed to remove role", error: e.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS / OJTs (read/write child tables directly, no separate module)
// ═══════════════════════════════════════════════════════════════════════════
export const listStudents = async (req, res) => {
  try {
    const where = {};
    if (req.query.batch)   where.batch = req.query.batch;
    if (req.query.program) where.program = req.query.program;
    if (req.query.status)  where.status = req.query.status;
    const rows = await RegistrationStudent.findAll({
      where, order: [["createdAt", "DESC"]],
      include: [{ model: Contact, as: "contact" }, { model: Registration, as: "registration" }],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Failed to list students", error: e.message });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const row = await RegistrationStudent.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found" });
    await row.update(req.body);
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: "Failed to update student", error: e.message });
  }
};

export const listOJTs = async (req, res) => {
  try {
    const where = {};
    if (req.query.department)    where.department = req.query.department;
    if (req.query.status)        where.status     = req.query.status;
    if (req.query.supervisor_id) where.supervisor_id = req.query.supervisor_id;
    const rows = await RegistrationOJT.findAll({
      where, order: [["createdAt", "DESC"]],
      include: [
        { model: Contact, as: "contact" }, { model: Contact, as: "supervisor" },
        { model: Registration, as: "registration" },
      ],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Failed to list OJTs", error: e.message });
  }
};

export const updateOJT = async (req, res) => {
  try {
    const row = await RegistrationOJT.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found" });
    await row.update(req.body);
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: "Failed to update OJT", error: e.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYEES — direct read/write on registration_employees
// ═══════════════════════════════════════════════════════════════════════════
export const listEmployees = async (req, res) => {
  try {
    const where = {};
    if (req.query.department)   where.department = req.query.department;
    if (req.query.designation)  where.designation = req.query.designation;
    if (req.query.status)       where.status = req.query.status;
    if (req.query.reporting_to) where.reporting_to = req.query.reporting_to;
    const rows = await RegistrationEmployee.findAll({
      where, order: [["createdAt", "DESC"]],
      include: [
        { model: Contact, as: "contact" },
        { model: Contact, as: "manager" },
        { model: Registration, as: "registration" },
      ],
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Failed to list employees", error: e.message });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const row = await RegistrationEmployee.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found" });
    // confirmation_date ≥ joining_date when both set
    const j = req.body.joining_date || row.joining_date;
    const c = req.body.confirmation_date || row.confirmation_date;
    if (j && c && new Date(c) < new Date(j)) {
      return res.status(400).json({ message: "confirmation_date cannot be before joining_date" });
    }
    await row.update(req.body);
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: "Failed to update employee", error: e.message });
  }
};

export const confirmEmployee = async (req, res) => {
  try {
    const row = await RegistrationEmployee.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found" });
    const confirmation_date = req.body.confirmation_date || new Date();
    if (new Date(confirmation_date) < new Date(row.joining_date)) {
      return res.status(400).json({ message: "confirmation_date cannot be before joining_date" });
    }
    await row.update({
      confirmation_date,
      is_probation: false,
      status: "Active",
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: "Failed to confirm employee", error: e.message });
  }
};

export const terminateEmployee = async (req, res) => {
  try {
    const row = await RegistrationEmployee.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Not found" });
    const { leaving_date, reason } = req.body || {};
    await row.update({
      leaving_date: leaving_date || new Date(),
      status: "Terminated",
      notes: reason ? `${row.notes ? row.notes + "\n" : ""}Terminated: ${reason}` : row.notes,
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: "Failed to terminate employee", error: e.message });
  }
};
