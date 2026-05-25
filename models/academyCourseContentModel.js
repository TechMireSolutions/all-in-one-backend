import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const AcademyCourseContent = sequelize.define(
  "AcademyCourseContent",
  {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    course:      { type: DataTypes.STRING,  allowNull: false, comment: "Course title (matches catalog)" },
    section:     { type: DataTypes.STRING,  allowNull: true,  defaultValue: "General" },
    type:        { type: DataTypes.STRING,  allowNull: false, comment: "assignment | quiz | page | file | url | forum | book | choice | feedback | attendance | text" },
    title:       { type: DataTypes.STRING,  allowNull: false },
    description: { type: DataTypes.TEXT,    allowNull: true },
    body:        { type: DataTypes.TEXT,    allowNull: true,  comment: "Long-form content / instructions" },
    url:         { type: DataTypes.STRING,  allowNull: true },
    file_name:   { type: DataTypes.STRING,  allowNull: true },
    file_url:    { type: DataTypes.STRING,  allowNull: true, comment: "Public URL (under /uploads/academy) to the uploaded file" },
    sort_order:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Quiz config (only meaningful when type === "quiz")
    time_limit_minutes: { type: DataTypes.INTEGER, allowNull: true,  defaultValue: 0 },
    attempts_allowed:   { type: DataTypes.INTEGER, allowNull: true,  defaultValue: 0, comment: "0 = unlimited" },
    grading_method:     { type: DataTypes.STRING,  allowNull: true,  defaultValue: "Highest grade" },
    time_per_question_seconds: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, comment: "0 = no per-question limit" },
    negative_marks:     { type: DataTypes.FLOAT,   allowNull: true,  defaultValue: 0, comment: "marks deducted per wrong MCQ" },
  },
  { tableName: "academy_course_contents", timestamps: true }
);

export default AcademyCourseContent;
