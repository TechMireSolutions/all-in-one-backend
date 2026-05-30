import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sequelize, connectDB } from "./DB/DBconnection.js";

// Load environment variables from .env file
dotenv.config();

// Import models to register them with Sequelize
import "./models/userModel.js";
import "./models/fileModel.js";
import "./models/exEmployeeModel.js";
import "./models/payrollModel.js";
import "./models/hrUsers.js";
import "./models/studentModel.js";
import "./models/ojtModel.js";
import "./models/policyModel.js";
import "./models/assetModel.js";
import "./models/assignmentModel.js";
import "./models/chatHistoryModel.js";
import "./models/smartMoosaUserModel.js";
import "./models/contactModel.js";
import "./models/accountModel.js";
import "./models/academyEnrollmentModel.js";
import "./models/academyCourseContentModel.js";
import "./models/academyCourseSettingsModel.js";
import "./models/academyQuizQuestionModel.js";
import "./models/academyQuizAttemptModel.js";
import "./models/academyAssignmentSubmissionModel.js";


// Import API routes
import userRoutes from "./routes/userRoute.js";
import fileRoutes from "./routes/fileRoute.js";
import authRoutes from "./routes/authRoute.js";
import exEmployeeRoutes from "./routes/exEmployeeRoute.js";
import payrollRoutes from "./routes/payrollRoute.js";
import studentRoutes from "./routes/studentRoute.js";
import ojtRoutes from "./routes/ojtRoute.js";
import policyRoutes from "./routes/policyRoute.js";
import assetRoutes from "./routes/assetRoute.js";
import assignmentRoutes from "./routes/assignmentRoute.js";
import chatHistoryRoutes from "./routes/chatHistoryRoute.js";
import smartMoosaUserRoutes from "./routes/smartMoosaUserRoute.js";
import contactRoutes from "./routes/contactRoute.js";
import accountRoutes from "./routes/accountRoute.js";
import permissionsRoutes from "./routes/permissionsRoute.js";
import academyEnrollmentRoutes from "./routes/academyEnrollmentRoute.js";
import academyCourseContentRoutes from "./routes/academyCourseContentRoute.js";
import academyCourseSettingsRoutes from "./routes/academyCourseSettingsRoute.js";
import academyQuizRoutes from "./routes/academyQuizRoute.js";
import academyAssignmentRoutes from "./routes/academyAssignmentRoute.js";
import customRoleRoutes from "./routes/customRoleRoute.js";
import "./models/customRoleModel.js";
import "./models/projectTrackerModel.js";

import projectTrackerRoutes from "./routes/projectTrackerRoute.js";

// Initialize Express app
const app = express();

// Configure CORS (Cross-Origin Resource Sharing) options
const corsOptions = {
  // FIXME: Change this to the frontend URL once go live
  origin: "*", // Allow all frontend URL temporarily
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Handle preflight requests

// Serve uploaded policy files as static
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware to parse request bodies
app.use(express.json({ limit: "50mb" })); // Parse JSON bodies with a size limit
app.use(express.urlencoded({ limit: "50mb", extended: true })); // Parse URL-encoded bodies

// Register API routes
app.use("/api/users", userRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/exemployees", exEmployeeRoutes);
app.use("/api/payrolls", payrollRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/ojt", ojtRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/chat-history", chatHistoryRoutes);
app.use("/api", smartMoosaUserRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/academy/enrollments", academyEnrollmentRoutes);
app.use("/api/academy/course-contents", academyCourseContentRoutes);
app.use("/api/academy/course-settings", academyCourseSettingsRoutes);
app.use("/api/academy/quiz", academyQuizRoutes);
app.use("/api/academy/assignments", academyAssignmentRoutes);
app.use("/api/roles", customRoleRoutes);
app.use("/api/project-tracker", projectTrackerRoutes);


// Root endpoint (to check if the backend is running)
app.get("/", (req, res) => {
  res.send("MERN Backend with PostgreSQL is Running...");
});

// Start the server
const PORT = process.env.PORT || 5000;
// Idempotent column-add for the per-user page-access feature.
// Safe to run repeatedly: adds allowed_pages only if missing.
const ensureAllowedPagesColumns = async () => {
  const tables = ["hr_users", "users", "ojts", "students"];
  for (const table of tables) {
    try {
      const desc = await sequelize.getQueryInterface().describeTable(table);
      if (!desc.allowed_pages) {
        await sequelize.getQueryInterface().addColumn(table, "allowed_pages", {
          type: (await import("sequelize")).DataTypes.JSON,
          allowNull: true,
        });
        console.log(`✅ Added allowed_pages column to ${table}`);
      }
    } catch (e) {
      // Table may not exist on this deployment — skip silently.
    }
  }
};

app.listen(PORT, async () => {
  try {
    await connectDB(); // Connect to the PostgreSQL database
    await ensureAllowedPagesColumns();
    // Ensure custom_roles table + custom_role_id columns on user tables
    try {
      const { default: CustomRole } = await import("./models/customRoleModel.js");
      await CustomRole.sync();
      const { DataTypes: DT } = await import("sequelize");
      for (const t of ["contacts", "hr_users", "users", "ojts", "students"]) {
        try {
          const desc = await sequelize.getQueryInterface().describeTable(t);
          if (!desc.custom_role_id) {
            await sequelize.getQueryInterface().addColumn(t, "custom_role_id", { type: DT.INTEGER, allowNull: true });
            console.log(`✅ Added custom_role_id column to ${t}`);
          }
        } catch {}
      }
    } catch (e) { console.error("custom_roles bootstrap:", e); }
    // Ensure Contact-related tables exist (idempotent).
    try {
      const { Contact, ContactPhoneNumber, ContactEmail, ContactAddress, ContactSocial, MergeLog } = await import("./models/contactModel.js");
      await Contact.sync({ alter: true });
      await ContactPhoneNumber.sync({ alter: true });
      await ContactEmail.sync({ alter: true });
      await ContactAddress.sync({ alter: true });
      await ContactSocial.sync({ alter: true });
      await MergeLog.sync({ alter: true });
      console.log("✅ Contact tables synced successfully");
    } catch (e) { console.error("Contact tables sync error:", e.message); }

    // Ensure the academy_enrollments table exists (idempotent).
    const { default: AcademyEnrollment } = await import("./models/academyEnrollmentModel.js");
    await AcademyEnrollment.sync();
    const { default: AcademyCourseContent } = await import("./models/academyCourseContentModel.js");
    await AcademyCourseContent.sync();
    const { default: AcademyCourseSettings } = await import("./models/academyCourseSettingsModel.js");
    await AcademyCourseSettings.sync();
    const { default: AcademyQuizQuestion } = await import("./models/academyQuizQuestionModel.js");
    await AcademyQuizQuestion.sync();
    const { default: AcademyQuizAttempt } = await import("./models/academyQuizAttemptModel.js");
    await AcademyQuizAttempt.sync();
    const { default: AcademyAssignmentSubmission } = await import("./models/academyAssignmentSubmissionModel.js");
    await AcademyAssignmentSubmission.sync();
    // Add quiz config columns to academy_course_contents if missing.
    try {
      const desc = await sequelize.getQueryInterface().describeTable("academy_course_contents");
      const { DataTypes: DT } = await import("sequelize");
      if (!desc.time_limit_minutes) {
        await sequelize.getQueryInterface().addColumn("academy_course_contents", "time_limit_minutes", { type: DT.INTEGER, allowNull: true, defaultValue: 0 });
      }
      if (!desc.attempts_allowed) {
        await sequelize.getQueryInterface().addColumn("academy_course_contents", "attempts_allowed", { type: DT.INTEGER, allowNull: true, defaultValue: 0 });
      }
      if (!desc.grading_method) {
        await sequelize.getQueryInterface().addColumn("academy_course_contents", "grading_method", { type: DT.STRING, allowNull: true, defaultValue: "Highest grade" });
      }
    } catch {}
    // Add file_url column to academy_course_contents if it's missing (existing installs).
    try {
      const desc = await sequelize.getQueryInterface().describeTable("academy_course_contents");
      if (!desc.file_url) {
        await sequelize.getQueryInterface().addColumn("academy_course_contents", "file_url", {
          type: (await import("sequelize")).DataTypes.STRING,
          allowNull: true,
        });
        console.log("✅ Added file_url column to academy_course_contents");
      }
    } catch {}
    // Sync project_trackers table — convert status from ENUM to VARCHAR if needed
    try {
      // Convert ENUM → VARCHAR BEFORE sync (PostgreSQL needs USING clause).
      // Wrapped in try/catch — fine to fail on first run (table not created yet)
      // or on subsequent runs (already VARCHAR / SQLite).
      try {
        await sequelize.query(
          `ALTER TABLE project_trackers ALTER COLUMN status TYPE VARCHAR(50) USING status::text`
        );
        // Drop the old enum type if it still exists
        await sequelize.query(
          `DROP TYPE IF EXISTS "enum_project_trackers_status"`
        );
        console.log("✅ project_trackers status column converted to VARCHAR");
      } catch (e) {
        // Already VARCHAR, table doesn't exist yet, or SQLite — safe to ignore
      }
      const { default: ProjectTracker } = await import("./models/projectTrackerModel.js");
      await ProjectTracker.sync();
      console.log("✅ project_trackers table synced");
    } catch (e) { console.error("project_trackers sync error:", e.message); }

    console.log(`🚀 Server running on port ${PORT}`);
  } catch (error) {
    console.error("Failed to start server:", error);
  }
});
