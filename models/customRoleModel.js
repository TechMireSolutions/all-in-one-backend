import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const CustomRole = sequelize.define(
  "CustomRole",
  {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name:        { type: DataTypes.STRING,  allowNull: false, unique: true },
    description:   { type: DataTypes.STRING, allowNull: true },
    allowed_pages: { type: DataTypes.JSON,   allowNull: true, defaultValue: [] },
  },
  { tableName: "custom_roles", timestamps: true }
);

export default CustomRole;
