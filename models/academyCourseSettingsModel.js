import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

const AcademyCourseSettings = sequelize.define(
  "AcademyCourseSettings",
  {
    id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    course:             { type: DataTypes.STRING,  allowNull: false, unique: true, comment: "Course title key (matches catalog)" },

    // General
    full_name:          { type: DataTypes.STRING,  allowNull: true },
    short_name:         { type: DataTypes.STRING,  allowNull: true },
    category:           { type: DataTypes.STRING,  allowNull: true },
    visibility:         { type: DataTypes.STRING,  allowNull: true, defaultValue: "Show" },   // Show | Hide
    start_date:         { type: DataTypes.DATEONLY, allowNull: true },
    end_date:           { type: DataTypes.DATEONLY, allowNull: true },
    end_date_enabled:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    course_id_number:   { type: DataTypes.STRING,  allowNull: true },

    // Description
    summary:            { type: DataTypes.TEXT,    allowNull: true },
    image_url:          { type: DataTypes.STRING,  allowNull: true },

    // Course format
    format:             { type: DataTypes.STRING,  allowNull: true, defaultValue: "Custom sections" },
    hidden_sections:    { type: DataTypes.STRING,  allowNull: true, defaultValue: "Hide completely" },
    course_layout:      { type: DataTypes.STRING,  allowNull: true, defaultValue: "Show all sections on one page" },

    // Appearance
    force_language:     { type: DataTypes.STRING,  allowNull: true, defaultValue: "Do not force" },
    num_announcements:  { type: DataTypes.INTEGER, allowNull: true, defaultValue: 5 },
    show_gradebook:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    show_activity_reports: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    show_activity_dates:{ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    // Files and uploads
    max_upload_size:    { type: DataTypes.STRING,  allowNull: true, defaultValue: "Site upload limit (1 GB)" },

    // Completion tracking
    completion_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    show_completion_conditions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    // Groups
    group_mode:         { type: DataTypes.STRING,  allowNull: true, defaultValue: "No groups" },
    force_group_mode:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    default_grouping:   { type: DataTypes.STRING,  allowNull: true, defaultValue: "None" },

    // Tags
    tags:               { type: DataTypes.JSON,    allowNull: true },

    // Other
    course_duration:    { type: DataTypes.STRING,  allowNull: true },
  },
  { tableName: "academy_course_settings", timestamps: true }
);

export default AcademyCourseSettings;
