import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";
import crypto from "crypto";

const hashPassword = (password) => {
  if (!password) return null;
  return crypto.createHash("sha256").update(password.toString()).digest("hex");
};

const SmartMoosaUser = sequelize.define(
  "SmartMoosaUser",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "smart_moosa_users",
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = hashPassword(user.password);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = hashPassword(user.password);
        }
      },
    },
  }
);

// Verify password
SmartMoosaUser.prototype.verifyPassword = function (password) {
  const hashedInput = hashPassword(password);
  return hashedInput === this.password;
};

SmartMoosaUser.hashPassword = hashPassword;

export default SmartMoosaUser;
