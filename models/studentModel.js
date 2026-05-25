import { DataTypes } from "sequelize"
import { sequelize } from "../DB/DBconnection.js"

const Student = sequelize.define(
  "Student",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_student_id" },
      comment: "Unique student ID",
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_student_email" },
    },
    cnic: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_student_cnic" },
    },
    contact_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM("Male", "Female", "Other"),
      allowNull: false,
      defaultValue: "Male",
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    joining_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    courses: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of courses the student is studying",
      defaultValue: [],
    },
    institute: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Institute/university the student is from",
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Degree being pursued",
    },
    course_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Start date of the course",
    },
    course_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "End date of the course",
    },
    status: {
      type: DataTypes.ENUM("Active", "Completed", "Dropped"),
      allowNull: false,
      defaultValue: "Active",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "students",
  }
)

export default Student
