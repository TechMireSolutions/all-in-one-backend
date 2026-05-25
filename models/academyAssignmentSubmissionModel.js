import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const AcademyAssignmentSubmission = sequelize.define(
  "AcademyAssignmentSubmission",
  {
    id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    content_id:    { type: DataTypes.INTEGER, allowNull: false, comment: "FK to academy_course_contents.id (assignment row)" },
    student_email: { type: DataTypes.STRING,  allowNull: false },
    student_name:  { type: DataTypes.STRING,  allowNull: true },
    text:          { type: DataTypes.TEXT,    allowNull: true },
    file_name:     { type: DataTypes.STRING,  allowNull: true },
    file_url:      { type: DataTypes.STRING,  allowNull: true },
    submitted_at:  { type: DataTypes.DATE,    allowNull: false, defaultValue: DataTypes.NOW },
    grade:         { type: DataTypes.STRING,  allowNull: true },
    feedback:      { type: DataTypes.TEXT,    allowNull: true },
  },
  { tableName: "academy_assignment_submissions", timestamps: true }
);

export default AcademyAssignmentSubmission;
