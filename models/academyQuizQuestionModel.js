import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const AcademyQuizQuestion = sequelize.define(
  "AcademyQuizQuestion",
  {
    id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    content_id:      { type: DataTypes.INTEGER, allowNull: false, comment: "FK to academy_course_contents.id (a quiz row)" },
    question_text:   { type: DataTypes.TEXT,    allowNull: false },
    options:         { type: DataTypes.JSON,    allowNull: false, defaultValue: [] },
    correct_index:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sort_order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: "academy_quiz_questions", timestamps: true }
);

export default AcademyQuizQuestion;
