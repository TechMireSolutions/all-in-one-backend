import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const AcademyEnrollment = sequelize.define(
  "AcademyEnrollment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    email:     { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password:  { type: DataTypes.STRING, allowNull: false, comment: "Plain for demo — replace with hash before production" },
    courses:   { type: DataTypes.JSON,   allowNull: false, defaultValue: [] },
    status:    { type: DataTypes.ENUM("active", "suspended"), allowNull: false, defaultValue: "active" },
  },
  { tableName: "academy_enrollments", timestamps: true }
);

export default AcademyEnrollment;
