import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const Asset = sequelize.define(
  "Asset",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    asset_model: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serial_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    ram: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "16GB",
    },
    os: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Windows 11 Pro",
    },
    cpu: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Intel Core i7",
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "New",
    },
    external_storage: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "None",
    },
    external_storage_size: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "N/A",
    },
    additional_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Available",
    },
    qr_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "assets",
    timestamps: true,
  }
);

export default Asset;
