import { DataTypes } from "sequelize"
import { sequelize } from "../DB/DBconnection.js"

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "Unique identifier for each user, auto-incremented",
    },
    employee_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_employee_id" },
      comment: "Unique employee ID assigned to the user",
    },
    registration_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date when the user registered",
    },
    joining_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date when the user joined the organization",
    },
    post_applied_for: {
      type: DataTypes.ENUM("Employee", "Internship"),
      allowNull: false,
      comment: "Position applied for: Employee or Internship",
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Full name of the user",
    },
    gender: {
      type: DataTypes.ENUM("Male", "Female"),
      allowNull: false,
      comment: "Gender of the user",
    },
    cnic: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_cnic" },
      comment: "CNIC number (will be stored encrypted)",
    },
    dob: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date of birth of the user",
    },
    permanent_address: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Permanent address (will be stored encrypted)",
    },
    contact_number: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Contact number (will be stored encrypted)",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_email" },
      comment: "Email address (will be stored encrypted)",
    },
    image: {
      type: DataTypes.BLOB("long"),
      allowNull: true,
      comment: "Profile image stored as binary data (JPEG)",
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Educational degree earned by the user",
    },
    institute: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Institute where the degree was earned",
    },
    grade: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Grade or GPA achieved",
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Year of degree completion",
    },
    current_study: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Current ongoing study",
    },
    teaching_subjects: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Subjects taught by the user (if applicable)",
    },
    teaching_institute: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Institute where teaching occurred (if applicable)",
    },
    teaching_contact: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Teaching contact number (will be stored encrypted if provided)",
    },
    position: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Current or past job position (if applicable)",
    },
    organization: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Organization of past/current employment (if applicable)",
    },
    skills: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of up to 5 professional skills (optional)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional description or notes about the user (optional)",
    },
    in_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: "Daily start time of the user's work shift (e.g., '09:00:00')",
    },
    out_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: "Daily end time of the user's work shift (e.g., '17:00:00')",
    },
    Salary_Cap: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Salary capacity of the user in whole currency units (e.g., 50000)",
    },
    guardian_phone: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Guardian or alternate contact number (will be stored encrypted)",
    },
    reference_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Name of a reference person (optional)",
    },
    reference_contact: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Contact number of reference person (will be stored encrypted if provided)",
    },
    has_disease: {
      type: DataTypes.ENUM("Yes", "No"),
      allowNull: false,
      comment: "Indicates if the user has any disease (Yes/No)",
    },
    disease_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Description of disease if present (required if has_disease is 'Yes')",
    },
    record_type: {
      type: DataTypes.ENUM("contact", "employee"),
      allowNull: false,
      defaultValue: "contact",
      comment: "Whether this is a contact-only record or a fully registered employee",
    },
    login_access: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this employee is allowed to log in to the portal",
    },
    allowed_pages: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Per-user page-access whitelist (array of route paths). null = use default role access.",
    },
  },
  {
    timestamps: true,
    tableName: "users",
    comment: "Table storing user data with encrypted sensitive information and timestamps",
  },
)

export default User
