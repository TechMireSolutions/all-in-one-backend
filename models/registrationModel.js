// Dynamic Registration module — 9 tables.
//   1 root parent : registration_forms
//   8 child tables: registration_sections, registration_fields,
//                   registrations, registration_answers,
//                   registration_status_logs, registration_roles,
//                   registration_students, registration_ojts
import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";
import { Contact } from "./contactModel.js";

// ─────────────────────────────────────────────────────────────────────────────
// A. RegistrationForm (PARENT / root)
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationForm = sequelize.define(
  "RegistrationForm",
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title:           { type: DataTypes.STRING, allowNull: false },
    slug:            { type: DataTypes.STRING, allowNull: false, unique: true, comment: "URL-safe identifier for the public form" },
    description:     { type: DataTypes.TEXT,   allowNull: true },
    category:        { type: DataTypes.ENUM("Event", "Course", "Program", "Workshop", "Camp", "Other"), allowNull: false, defaultValue: "Other" },
    status:          { type: DataTypes.ENUM("Draft", "Open", "Closed", "Archived"), allowNull: false, defaultValue: "Draft" },
    opens_at:        { type: DataTypes.DATE, allowNull: true },
    closes_at:       { type: DataTypes.DATE, allowNull: true },
    capacity:        { type: DataTypes.INTEGER, allowNull: true, comment: "Max simultaneous active registrations (null = unlimited)" },
    link_contact:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true,  comment: "If true, auto-link/create Contact by CNIC on submit" },
    require_cnic:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    require_payment: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    fee_amount:      { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    created_by:      { type: DataTypes.UUID, allowNull: true },
  },
  { tableName: "registration_forms", timestamps: true, indexes: [{ unique: true, fields: ["slug"] }] }
);

// ─────────────────────────────────────────────────────────────────────────────
// B. RegistrationSection (child of Form)
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationSection = sequelize.define(
  "RegistrationSection",
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formId:      { type: DataTypes.UUID, allowNull: false },
    title:       { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT,   allowNull: true },
    order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: "registration_sections", timestamps: true, indexes: [{ fields: ["formId"] }] }
);

// ─────────────────────────────────────────────────────────────────────────────
// C. RegistrationField (child of Form + Section)
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationField = sequelize.define(
  "RegistrationField",
  {
    id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formId:               { type: DataTypes.UUID, allowNull: false },
    sectionId:            { type: DataTypes.UUID, allowNull: true,  comment: "Null = ungrouped field directly under the form" },
    field_key:            { type: DataTypes.STRING, allowNull: false, comment: "Slug/key used in the answer payload, unique per form" },
    label:                { type: DataTypes.STRING, allowNull: false },
    help_text:            { type: DataTypes.STRING, allowNull: true },
    field_type:           {
      type: DataTypes.ENUM(
        "text", "textarea", "number", "email", "phone", "cnic", "date", "datetime",
        "select", "multiselect", "radio", "checkbox", "file", "url", "boolean", "section_repeater"
      ),
      allowNull: false,
      defaultValue: "text",
    },
    is_required:          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_unique:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, comment: "If true, value must be unique across all submissions to this form" },
    options:              { type: DataTypes.JSON,    allowNull: true,  comment: "For select/multiselect/radio/checkbox: array of { value, label }" },
    validation:           { type: DataTypes.JSON,    allowNull: true,  comment: "{ min, max, minLength, maxLength, regex, fileTypes:[], maxSizeMB }" },
    default_value:        { type: DataTypes.STRING,  allowNull: true },
    order_index:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    mapped_contact_field: { type: DataTypes.STRING,  allowNull: true, comment: "Optional Contact field name to mirror this answer into" },
    conditional_logic:    { type: DataTypes.JSON,    allowNull: true, comment: "{ show_if: { field_key, op, value } }" },
  },
  {
    tableName: "registration_fields",
    timestamps: true,
    indexes: [
      { fields: ["formId"] },
      { fields: ["sectionId"] },
      { unique: true, fields: ["formId", "field_key"] },
    ],
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// D. Registration (a submission — child of Form, sub-parent for E..I)
// ─────────────────────────────────────────────────────────────────────────────
const Registration = sequelize.define(
  "Registration",
  {
    id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formId:              { type: DataTypes.UUID, allowNull: false },
    contactId:           { type: DataTypes.UUID, allowNull: true },
    registration_number: { type: DataTypes.STRING, allowNull: false, unique: true, comment: "REG-{year}-{6-digit-seq}" },
    status:              {
      type: DataTypes.ENUM(
        "Submitted", "Under Review", "Approved", "Rejected",
        "Waitlisted", "Withdrawn", "Cancelled"
      ),
      allowNull: false,
      defaultValue: "Submitted",
    },
    submitted_at:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reviewed_by:         { type: DataTypes.UUID, allowNull: true },
    reviewed_at:         { type: DataTypes.DATE, allowNull: true },
    review_notes:        { type: DataTypes.TEXT, allowNull: true },
    payment_status:      { type: DataTypes.ENUM("N/A", "Pending", "Paid", "Refunded", "Failed"), allowNull: false, defaultValue: "N/A" },
    payment_ref:         { type: DataTypes.STRING, allowNull: true },
    source:              { type: DataTypes.ENUM("Web", "Admin", "Import", "API"), allowNull: false, defaultValue: "Web" },
    ip_address:          { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "registrations",
    timestamps: true,
    indexes: [
      { fields: ["formId"] },
      { fields: ["contactId"] },
      { unique: true, fields: ["registration_number"] },
      { fields: ["status"] },
    ],
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// E. RegistrationAnswer (child of Registration)
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationAnswer = sequelize.define(
  "RegistrationAnswer",
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    registrationId: { type: DataTypes.UUID, allowNull: false },
    fieldId:        { type: DataTypes.UUID, allowNull: false },
    field_key:      { type: DataTypes.STRING, allowNull: false, comment: "Snapshot of field_key for CSV export resilience" },
    value_text:     { type: DataTypes.TEXT,    allowNull: true },
    value_number:   { type: DataTypes.DECIMAL(18, 4), allowNull: true },
    value_date:     { type: DataTypes.DATE,    allowNull: true },
    value_boolean:  { type: DataTypes.BOOLEAN, allowNull: true },
    value_json:     { type: DataTypes.JSON,    allowNull: true, comment: "For multiselect/checkbox arrays + section_repeater payloads" },
    file_url:       { type: DataTypes.STRING,  allowNull: true },
  },
  {
    tableName: "registration_answers",
    timestamps: true,
    indexes: [
      { fields: ["registrationId"] },
      { fields: ["fieldId"] },
      { unique: true, fields: ["registrationId", "fieldId"] },
    ],
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// F. RegistrationStatusLog (child of Registration)
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationStatusLog = sequelize.define(
  "RegistrationStatusLog",
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    registrationId: { type: DataTypes.UUID, allowNull: false },
    from_status:    { type: DataTypes.STRING, allowNull: true },
    to_status:      { type: DataTypes.STRING, allowNull: false },
    changed_by:     { type: DataTypes.UUID,   allowNull: true },
    changed_at:     { type: DataTypes.DATE,   allowNull: false, defaultValue: DataTypes.NOW },
    note:           { type: DataTypes.TEXT,   allowNull: true },
  },
  { tableName: "registration_status_logs", timestamps: true, indexes: [{ fields: ["registrationId"] }] }
);

// ─────────────────────────────────────────────────────────────────────────────
// G. RegistrationRole (child of Registration) — this person's role IN this event
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationRole = sequelize.define(
  "RegistrationRole",
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    registrationId: { type: DataTypes.UUID, allowNull: false },
    role_name:      {
      type: DataTypes.ENUM(
        "Participant", "Student", "OJT", "Instructor", "Volunteer",
        "Organizer", "Speaker", "Mentor", "Attendee", "Staff", "Other"
      ),
      allowNull: false,
      defaultValue: "Participant",
    },
    role_label:     { type: DataTypes.STRING, allowNull: true, comment: "Optional human-readable name when role_name=Other" },
    assigned_by:    { type: DataTypes.UUID,   allowNull: true },
    assigned_at:    { type: DataTypes.DATE,   allowNull: false, defaultValue: DataTypes.NOW },
    start_date:     { type: DataTypes.DATEONLY, allowNull: true },
    end_date:       { type: DataTypes.DATEONLY, allowNull: true },
    is_primary:     { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: false },
    permissions:    { type: DataTypes.JSON,     allowNull: true, comment: "Optional event-scoped permission flags" },
    notes:          { type: DataTypes.TEXT,     allowNull: true },
  },
  {
    tableName: "registration_roles",
    timestamps: true,
    indexes: [
      { fields: ["registrationId"] },
      { fields: ["role_name"] },
      { unique: true, fields: ["registrationId", "role_name"] },
    ],
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// H. RegistrationStudent (child of Registration; auto-created when role=Student)
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationStudent = sequelize.define(
  "RegistrationStudent",
  {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    registrationId:     { type: DataTypes.UUID, allowNull: false },
    contactId:          { type: DataTypes.UUID, allowNull: true },
    student_number:     { type: DataTypes.STRING, allowNull: false, unique: true, comment: "STD-{year}-{seq}" },
    enrollment_date:    { type: DataTypes.DATEONLY, allowNull: true },
    class_level:        { type: DataTypes.STRING,   allowNull: true },
    section:            { type: DataTypes.STRING,   allowNull: true },
    program:            { type: DataTypes.ENUM("Hifz", "Nazra", "Aalim", "Academic", "Other"), allowNull: false, defaultValue: "Other" },
    batch:              { type: DataTypes.STRING,   allowNull: true },
    roll_number:        { type: DataTypes.STRING,   allowNull: true },
    guardian_name:      { type: DataTypes.STRING,   allowNull: true },
    guardian_phone:     { type: DataTypes.STRING,   allowNull: true, comment: "E.164" },
    guardian_relation:  { type: DataTypes.ENUM("Father", "Mother", "Spouse", "Sibling", "Guardian", "Other"), allowNull: true },
    hostel_required:    { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: false },
    transport_required: { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: false },
    scholarship:        { type: DataTypes.STRING,   allowNull: true },
    fee_status:         { type: DataTypes.ENUM("Unpaid", "Partial", "Paid", "Waived"), allowNull: false, defaultValue: "Unpaid" },
    status:             { type: DataTypes.ENUM("Active", "On-Leave", "Graduated", "Dropped", "Suspended"), allowNull: false, defaultValue: "Active" },
    notes:              { type: DataTypes.TEXT,     allowNull: true },
  },
  {
    tableName: "registration_students",
    timestamps: true,
    indexes: [
      { fields: ["registrationId"] },
      { fields: ["contactId"] },
      { unique: true, fields: ["student_number"] },
      { fields: ["status"] },
      { fields: ["batch"] },
      { fields: ["program"] },
    ],
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// I. RegistrationOJT (child of Registration; auto-created when role=OJT)
// ─────────────────────────────────────────────────────────────────────────────
const RegistrationOJT = sequelize.define(
  "RegistrationOJT",
  {
    id:                       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    registrationId:           { type: DataTypes.UUID, allowNull: false },
    contactId:                { type: DataTypes.UUID, allowNull: true },
    ojt_number:               { type: DataTypes.STRING, allowNull: false, unique: true, comment: "OJT-{year}-{seq}" },
    start_date:               { type: DataTypes.DATEONLY, allowNull: true },
    end_date:                 { type: DataTypes.DATEONLY, allowNull: true },
    duration_months:          { type: DataTypes.INTEGER,  allowNull: true },
    department:               { type: DataTypes.STRING,   allowNull: true },
    assigned_post:            { type: DataTypes.STRING,   allowNull: true },
    supervisor_id:            { type: DataTypes.UUID,     allowNull: true, comment: "FK to contacts.id (the OJT's supervisor)" },
    training_type:            { type: DataTypes.ENUM("Paid", "Unpaid", "Stipend"), allowNull: false, defaultValue: "Unpaid" },
    stipend_amount:           { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    working_hours_per_week:   { type: DataTypes.INTEGER, allowNull: true },
    institution:              { type: DataTypes.STRING,  allowNull: true },
    completion_certificate_url:{ type: DataTypes.STRING, allowNull: true },
    evaluation_score:         { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    status:                   { type: DataTypes.ENUM("Pending", "Active", "Completed", "Terminated", "Extended"), allowNull: false, defaultValue: "Pending" },
    remarks:                  { type: DataTypes.TEXT,    allowNull: true },
  },
  {
    tableName: "registration_ojts",
    timestamps: true,
    indexes: [
      { fields: ["registrationId"] },
      { fields: ["contactId"] },
      { unique: true, fields: ["ojt_number"] },
      { fields: ["status"] },
      { fields: ["department"] },
      { fields: ["supervisor_id"] },
    ],
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Associations
// ─────────────────────────────────────────────────────────────────────────────
// Form -> its children
RegistrationForm.hasMany(RegistrationSection,    { as: "sections",     foreignKey: "formId", onDelete: "CASCADE" });
RegistrationSection.belongsTo(RegistrationForm,  { as: "form",         foreignKey: "formId" });
RegistrationForm.hasMany(RegistrationField,      { as: "fields",       foreignKey: "formId", onDelete: "CASCADE" });
RegistrationField.belongsTo(RegistrationForm,    { as: "form",         foreignKey: "formId" });
RegistrationForm.hasMany(Registration,           { as: "registrations", foreignKey: "formId", onDelete: "CASCADE" });
Registration.belongsTo(RegistrationForm,         { as: "form",         foreignKey: "formId" });

// Section -> nested Field child
RegistrationSection.hasMany(RegistrationField,   { as: "fields",   foreignKey: "sectionId", onDelete: "CASCADE" });
RegistrationField.belongsTo(RegistrationSection, { as: "section",  foreignKey: "sectionId" });

// Registration -> its 5 child tables
Registration.hasMany(RegistrationAnswer,    { as: "answers",    foreignKey: "registrationId", onDelete: "CASCADE" });
RegistrationAnswer.belongsTo(Registration,  { as: "registration", foreignKey: "registrationId" });
Registration.hasMany(RegistrationStatusLog, { as: "statusLogs", foreignKey: "registrationId", onDelete: "CASCADE" });
RegistrationStatusLog.belongsTo(Registration, { as: "registration", foreignKey: "registrationId" });
Registration.hasMany(RegistrationRole,      { as: "roles",      foreignKey: "registrationId", onDelete: "CASCADE" });
RegistrationRole.belongsTo(Registration,    { as: "registration", foreignKey: "registrationId" });
Registration.hasMany(RegistrationStudent,   { as: "students",   foreignKey: "registrationId", onDelete: "CASCADE" });
RegistrationStudent.belongsTo(Registration, { as: "registration", foreignKey: "registrationId" });
Registration.hasMany(RegistrationOJT,       { as: "ojts",       foreignKey: "registrationId", onDelete: "CASCADE" });
RegistrationOJT.belongsTo(Registration,     { as: "registration", foreignKey: "registrationId" });

// Field <- Answer
RegistrationAnswer.belongsTo(RegistrationField, { as: "field", foreignKey: "fieldId" });
RegistrationField.hasMany(RegistrationAnswer,   { as: "answers", foreignKey: "fieldId" });

// Cross-module Contact joins
Registration.belongsTo(Contact,        { as: "contact",    foreignKey: "contactId" });
RegistrationStudent.belongsTo(Contact, { as: "contact",    foreignKey: "contactId" });
RegistrationOJT.belongsTo(Contact,     { as: "contact",    foreignKey: "contactId" });
RegistrationOJT.belongsTo(Contact,     { as: "supervisor", foreignKey: "supervisor_id" });

export {
  RegistrationForm,
  RegistrationSection,
  RegistrationField,
  Registration,
  RegistrationAnswer,
  RegistrationStatusLog,
  RegistrationRole,
  RegistrationStudent,
  RegistrationOJT,
};
