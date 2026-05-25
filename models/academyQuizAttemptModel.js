import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const AcademyQuizAttempt = sequelize.define(
  "AcademyQuizAttempt",
  {
    id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    content_id:      { type: DataTypes.INTEGER, allowNull: false },
    student_email:   { type: DataTypes.STRING,  allowNull: false },
    started_at:      { type: DataTypes.DATE,    allowNull: false, defaultValue: DataTypes.NOW },
    finished_at:     { type: DataTypes.DATE,    allowNull: true },
    answers:         { type: DataTypes.JSON,    allowNull: true, comment: "{ [question_id]: chosen_index }" },
    score:           { type: DataTypes.FLOAT,   allowNull: true },
    total:           { type: DataTypes.INTEGER, allowNull: true },
    status:          { type: DataTypes.STRING,  allowNull: false, defaultValue: "in_progress" }, // in_progress | finished
  },
  { tableName: "academy_quiz_attempts", timestamps: true }
);

export default AcademyQuizAttempt;
