import { DataTypes } from "sequelize"
import { sequelize } from "../DB/DBconnection.js"
import crypto from "crypto"

// 🔐 Password hashing functions
const hashPassword = (password) => {
  if (!password) return null
  return crypto.createHash("sha256").update(password.toString()).digest("hex")
}

const HrUser = sequelize.define(
  "HrUser",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "Unique identifier for each HR user, auto-incremented",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
      comment: "HR user email address for login",
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Hashed password for HR user authentication",
    },
    allowed_pages: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Per-user page-access whitelist (array of route paths). null = use default role access.",
    },
  },
  {
    tableName: "hr_users",
    timestamps: true,
    comment: "Table storing HR user credentials with hashed passwords",
    hooks: {
      // Hash password before creating new HR user
      beforeCreate: async (hrUser) => {
        if (hrUser.password) {
          hrUser.password = hashPassword(hrUser.password)
        }
      },
      // Hash password before updating HR user
      beforeUpdate: async (hrUser) => {
        if (hrUser.changed("password")) {
          hrUser.password = hashPassword(hrUser.password)
        }
      },
    },
  },
)

// Instance method to verify password
HrUser.prototype.verifyPassword = function (password) {
  const hashedInput = hashPassword(password)
  return hashedInput === this.password
}

// Static method to hash password (for manual hashing if needed)
HrUser.hashPassword = hashPassword

export default HrUser

// Sync the model with the database (run this once during setup)
// HrUser.sync({ force: true }); // Uncomment and run once to create the table, then comment out again
