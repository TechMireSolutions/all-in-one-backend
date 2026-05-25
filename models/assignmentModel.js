import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";
import Asset from "./assetModel.js";

const Assignment = sequelize.define(
  "Assignment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employee_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shift: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Full-time",
    },
    assignment_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    return_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    assetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Asset,
        key: "id",
      },
    },
  },
  {
    tableName: "assignments",
    timestamps: true,
  }
);

// Define associations
Asset.hasMany(Assignment, { foreignKey: "assetId", as: "assignments" });
Assignment.belongsTo(Asset, { foreignKey: "assetId", as: "asset" });

export default Assignment;
