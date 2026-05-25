import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const Policy = sequelize.define("Policy", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Revised Course Enrollment Annextures new 2026",
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: "policies"
});

export default Policy;
