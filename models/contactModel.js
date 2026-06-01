import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — Solar + Hijri lunar age
// ─────────────────────────────────────────────────────────────────────────────
const getSolarAge = (dob) => {
  if (!dob) return null;
  const dobDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  if (
    today.getMonth() < dobDate.getMonth() ||
    (today.getMonth() === dobDate.getMonth() && today.getDate() < dobDate.getDate())
  ) {
    age--;
  }
  return age;
};

const getLunarAge = (dob) => {
  if (!dob) return null;
  const dobDate = new Date(dob);
  const parseHijri = (str) => {
    const clean = str.replace(/[^0-9/]/g, "");
    const parts = clean.split("/");
    return parts.length === 3
      ? { month: parseInt(parts[0], 10), day: parseInt(parts[1], 10), year: parseInt(parts[2], 10) }
      : null;
  };
  try {
    const fmt = new Intl.DateTimeFormat("en-US-u-ca-islamic", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const dobH = parseHijri(fmt.format(dobDate));
    const todayH = parseHijri(fmt.format(new Date()));
    if (!dobH || !todayH) {
      const diffMs = new Date() - dobDate;
      return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 354.367));
    }
    let age = todayH.year - dobH.year;
    if (
      todayH.month < dobH.month ||
      (todayH.month === dobH.month && todayH.day < dobH.day)
    ) {
      age--;
    }
    return age;
  } catch (e) {
    const diffMs = new Date() - dobDate;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 354.367));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Core Contact entity
// ─────────────────────────────────────────────────────────────────────────────
const Contact = sequelize.define(
  "Contact",
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, comment: "Unique contact identifier using UUIDv4" },
    first_name:      { type: DataTypes.STRING, allowNull: false },
    last_name:       { type: DataTypes.STRING, allowNull: false },
    cnic:            { type: DataTypes.STRING, allowNull: false, unique: true, comment: "Validated CNIC XXXXX-XXXXXXX-X" },
    gender:          { type: DataTypes.ENUM("Male", "Female", "Other", "Prefer not to say"), allowNull: false },
    dob:             { type: DataTypes.DATE, allowNull: false, comment: "Date of Birth" },
    profile_picture: { type: DataTypes.STRING, allowNull: true, comment: "Public URL under /uploads/contacts/" },
    is_syed:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    current_age_solar: { type: DataTypes.VIRTUAL, get() { return getSolarAge(this.getDataValue("dob")); } },
    current_age_lunar: { type: DataTypes.VIRTUAL, get() { return getLunarAge(this.getDataValue("dob")); } },
  },
  {
    tableName: "contacts",
    timestamps: true,
    indexes: [{ unique: true, fields: ["cnic"] }],
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Existing 1:Many tables (kept verbatim)
// ─────────────────────────────────────────────────────────────────────────────
const ContactPhoneNumber = sequelize.define(
  "ContactPhoneNumber",
  {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:   { type: DataTypes.UUID, allowNull: false },
    phone_number:{ type: DataTypes.STRING, allowNull: false, comment: "E.164 phone, e.g. +923001234567" },
    phone_type:  { type: DataTypes.ENUM("Home", "Office", "Mobile", "WhatsApp", "Other"), allowNull: false },
  },
  { tableName: "contact_phones", timestamps: true, indexes: [{ fields: ["contactId"] }, { fields: ["phone_number"] }] }
);

const ContactEmail = sequelize.define(
  "ContactEmail",
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:    { type: DataTypes.UUID, allowNull: false },
    email_address:{ type: DataTypes.STRING, allowNull: false, comment: "RFC 5322 email" },
    email_type:   { type: DataTypes.ENUM("Home", "Office", "Personal", "Other"), allowNull: false },
  },
  { tableName: "contact_emails", timestamps: true, indexes: [{ fields: ["contactId"] }, { fields: ["email_address"] }] }
);

const ContactAddress = sequelize.define(
  "ContactAddress",
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:     { type: DataTypes.UUID, allowNull: false },
    address_line1: { type: DataTypes.STRING, allowNull: false },
    address_line2: { type: DataTypes.STRING, allowNull: true },
    city:          { type: DataTypes.STRING, allowNull: false },
    state:         { type: DataTypes.STRING, allowNull: false },
    country:       { type: DataTypes.STRING, allowNull: false },
    postal_code:   { type: DataTypes.STRING, allowNull: false },
    address_type:  { type: DataTypes.ENUM("Home", "Office", "Mailing", "Other"), allowNull: false },
  },
  { tableName: "contact_addresses", timestamps: true, indexes: [{ fields: ["contactId"] }] }
);

const ContactSocial = sequelize.define(
  "ContactSocial",
  {
    social_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId: { type: DataTypes.UUID, allowNull: false },
    platform:  { type: DataTypes.ENUM("Facebook", "Twitter", "Instagram", "LinkedIn", "Other"), allowNull: false },
    url:       { type: DataTypes.STRING, allowNull: false, comment: "Strictly validated platform URL" },
  },
  { tableName: "contact_socials", timestamps: true, indexes: [{ fields: ["contactId"] }] }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. NEW 1:Many tables (replacing the old JSON blobs)
// ─────────────────────────────────────────────────────────────────────────────
const ContactEmergency = sequelize.define(
  "ContactEmergency",
  {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:    { type: DataTypes.UUID, allowNull: false },
    name:         { type: DataTypes.STRING, allowNull: false },
    relation:     { type: DataTypes.ENUM("Father", "Mother", "Spouse", "Sibling", "Son", "Daughter", "Friend", "Guardian", "Other"), allowNull: false },
    phone_number: { type: DataTypes.STRING, allowNull: false, comment: "E.164 phone" },
    email:        { type: DataTypes.STRING, allowNull: true, comment: "RFC 5322 email, optional" },
    address:      { type: DataTypes.STRING, allowNull: true },
    is_primary:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "contact_emergencies", timestamps: true, indexes: [{ fields: ["contactId"] }, { fields: ["phone_number"] }] }
);

const ContactEducation = sequelize.define(
  "ContactEducation",
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:      { type: DataTypes.UUID, allowNull: false },
    degree:         { type: DataTypes.STRING, allowNull: false },
    field_of_study: { type: DataTypes.STRING, allowNull: true },
    institute:      { type: DataTypes.STRING, allowNull: false },
    grade:          { type: DataTypes.STRING, allowNull: true },
    start_year:     { type: DataTypes.INTEGER, allowNull: true },
    end_year:       { type: DataTypes.INTEGER, allowNull: true },
    is_current:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "contact_educations", timestamps: true, indexes: [{ fields: ["contactId"] }] }
);

const ContactExperience = sequelize.define(
  "ContactExperience",
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:        { type: DataTypes.UUID, allowNull: false },
    organization:     { type: DataTypes.STRING, allowNull: false },
    post:             { type: DataTypes.STRING, allowNull: false },
    experience_type:  { type: DataTypes.ENUM("Teaching", "Professional", "Internship", "Volunteer", "Other"), allowNull: false, defaultValue: "Professional" },
    start_date:       { type: DataTypes.DATEONLY, allowNull: true },
    end_date:         { type: DataTypes.DATEONLY, allowNull: true },
    is_current:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    responsibilities: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "contact_experiences", timestamps: true, indexes: [{ fields: ["contactId"] }] }
);

const ContactOffice = sequelize.define(
  "ContactOffice",
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:       { type: DataTypes.UUID, allowNull: false },
    employee_id:     { type: DataTypes.STRING, allowNull: false, unique: true, comment: "Org-wide unique employee identifier" },
    joining_date:    { type: DataTypes.DATEONLY, allowNull: true },
    leaving_date:    { type: DataTypes.DATEONLY, allowNull: true },
    post:            { type: DataTypes.STRING, allowNull: true },
    department:      { type: DataTypes.STRING, allowNull: true },
    employment_type: { type: DataTypes.ENUM("Full-time", "Part-time", "Contract", "Intern"), allowNull: false, defaultValue: "Full-time" },
    status:          { type: DataTypes.ENUM("Active", "Inactive", "Terminated", "Resigned"), allowNull: false, defaultValue: "Active" },
    reporting_to:    { type: DataTypes.UUID, allowNull: true, comment: "Self-FK → contacts.id (manager)" },
  },
  { tableName: "contact_offices", timestamps: true, indexes: [{ fields: ["contactId"] }, { unique: true, fields: ["employee_id"] }] }
);

const ContactHealth = sequelize.define(
  "ContactHealth",
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    contactId:     { type: DataTypes.UUID, allowNull: false },
    disease:       { type: DataTypes.STRING, allowNull: false },
    severity:      { type: DataTypes.ENUM("Mild", "Moderate", "Severe", "Critical"), allowNull: false, defaultValue: "Mild" },
    diagnosed_on:  { type: DataTypes.DATEONLY, allowNull: true },
    medication:    { type: DataTypes.STRING, allowNull: true },
    notes:         { type: DataTypes.TEXT, allowNull: true },
    is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "contact_healths", timestamps: true, indexes: [{ fields: ["contactId"] }] }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Audit trail
// ─────────────────────────────────────────────────────────────────────────────
const MergeLog = sequelize.define(
  "MergeLog",
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    merged_by:        { type: DataTypes.STRING, allowNull: true },
    merged_at:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    master_record_id: { type: DataTypes.UUID, allowNull: false },
    source_record_id: { type: DataTypes.UUID, allowNull: false },
    master_snapshot:  { type: DataTypes.JSON, allowNull: false, comment: "Pre-merge backup of master + all child relations" },
    source_snapshot:  { type: DataTypes.JSON, allowNull: false, comment: "Pre-merge backup of source + all child relations" },
    status:           { type: DataTypes.ENUM("Merged", "Undone"), allowNull: false, defaultValue: "Merged" },
  },
  { tableName: "merge_logs", timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Associations (all child tables cascade delete)
// ─────────────────────────────────────────────────────────────────────────────
Contact.hasMany(ContactPhoneNumber, { foreignKey: "contactId", as: "phoneNumbers", onDelete: "CASCADE" });
ContactPhoneNumber.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactEmail, { foreignKey: "contactId", as: "emails", onDelete: "CASCADE" });
ContactEmail.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactAddress, { foreignKey: "contactId", as: "addresses", onDelete: "CASCADE" });
ContactAddress.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactSocial, { foreignKey: "contactId", as: "socials", onDelete: "CASCADE" });
ContactSocial.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactEmergency, { foreignKey: "contactId", as: "emergencies", onDelete: "CASCADE" });
ContactEmergency.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactEducation, { foreignKey: "contactId", as: "educations", onDelete: "CASCADE" });
ContactEducation.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactExperience, { foreignKey: "contactId", as: "experiences", onDelete: "CASCADE" });
ContactExperience.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactOffice, { foreignKey: "contactId", as: "offices", onDelete: "CASCADE" });
ContactOffice.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

// Self-ref: an office row reports to another contact (the manager).
ContactOffice.belongsTo(Contact, { foreignKey: "reporting_to", as: "manager" });

Contact.hasMany(ContactHealth, { foreignKey: "contactId", as: "healths", onDelete: "CASCADE" });
ContactHealth.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

export {
  Contact,
  ContactPhoneNumber,
  ContactEmail,
  ContactAddress,
  ContactSocial,
  ContactEmergency,
  ContactEducation,
  ContactExperience,
  ContactOffice,
  ContactHealth,
  MergeLog,
};
