import { DataTypes } from "sequelize"
import { sequelize } from "../DB/DBconnection.js"

const ExEmployee = sequelize.define(
  "ExEmployee",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: "Unique identifier for each ex-employee record",
    },
    employee_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Employee ID (encrypted for security)",
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Employee full name (encrypted for privacy)",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Email address (encrypted for security)",
    },
    image: {
      type: DataTypes.BLOB,
      allowNull: true,
      comment: "Profile image stored as binary data",
    },
    post_applied_for: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Position applied for",
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Employee gender",
    },
    cnic: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "CNIC number (encrypted for security)",
    },
    dob: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date of birth",
    },
    permanent_address: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Permanent address (encrypted for privacy)",
    },
    contact_number: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Contact number (encrypted for security)",
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Educational degree",
    },
    institute: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Educational institute",
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
    registration_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date when employee registered",
    },
    joining_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date when employee joined",
    },
    exit_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date when employee left the organization",
    },
    teaching_subjects: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Teaching subjects (if applicable)",
    },
    teaching_institute: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Teaching institute (if applicable)",
    },
    teaching_contact: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Teaching contact (encrypted if provided)",
    },
    position: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Job position (if applicable)",
    },
    organization: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Organization (if applicable)",
    },
    skills: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of professional skills",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional description or notes",
    },
    in_time: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Daily start time",
    },
    out_time: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Daily end time",
    },
    Salary_Cap: {
      type: DataTypes.STRING, // Changed to STRING for encryption
      allowNull: false,
      comment: "Salary cap (encrypted for security)",
    },
    guardian_phone: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Guardian phone number (encrypted for security)",
    },
    reference_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Reference person name",
    },
    reference_contact: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Reference contact (encrypted if provided)",
    },
    has_disease: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Indicates if employee has any disease",
    },
    disease_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Disease description (if applicable)",
    },
  },
  {
    timestamps: false, // No createdAt/updatedAt fields needed
    tableName: "exemployees",
    comment: "Table storing ex-employee data with encrypted sensitive information",
  },
)

// Sync is handled by index.js/DBconnection.js centrally

export default ExEmployee
