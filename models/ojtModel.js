import { DataTypes } from "sequelize"
import { sequelize } from "../DB/DBconnection.js"

const OJT = sequelize.define(
  "OJT",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ojt_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_ojt_id" },
      comment: "Unique OJT trainee ID",
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_ojt_email" },
    },
    cnic: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { name: "unique_ojt_cnic" },
    },
    contact_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM("Male", "Female", "Other"),
      allowNull: false,
      defaultValue: "Male",
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    joining_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    level: {
      type: DataTypes.ENUM("ojt level 1", "ojt level 2", "ojt level 3", "ojt level 4"),
      allowNull: false,
      defaultValue: "ojt level 1",
      comment: "Skill level of the OJT trainee",
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Department where the OJT is placed",
    },
    institute: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Institute the OJT trainee is from",
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    project_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Current project the OJT is working on",
    },
    project_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Description of the project",
    },
    project_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Start date of the project",
    },
    project_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "End date of the project",
    },
    project_technologies: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: "Technologies used in the project",
    },
    supervisor: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Name of the supervising employee",
    },
    status: {
      type: DataTypes.ENUM("Active", "Completed", "Terminated"),
      allowNull: false,
      defaultValue: "Active",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "ojt_trainees",
  }
)

export default OJT
