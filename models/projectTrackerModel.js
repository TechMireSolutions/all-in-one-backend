import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const ProjectTracker = sequelize.define(
  "ProjectTracker",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    project_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    website_link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ojt_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    framework: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lead_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    project_given_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Not Started",
    },
  },
  {
    timestamps: true,
    tableName: "project_trackers",
  }
);

export default ProjectTracker;
