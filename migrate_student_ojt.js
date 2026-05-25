import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "database.sqlite");

console.log("Starting SQLite database migration for Student/OJT at:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Failed to open database:", err.message);
    process.exit(1);
  }
  console.log("Connected to the SQLite database.");
});

db.serialize(() => {
  // 1. Add course_start_date and course_end_date to students table
  db.run("ALTER TABLE students ADD COLUMN course_start_date TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ course_start_date column already exists in 'students' table.");
      } else {
        console.error("❌ Failed to add course_start_date to 'students' table:", err.message);
      }
    } else {
      console.log("✅ Added course_start_date column to 'students' table.");
    }
  });

  db.run("ALTER TABLE students ADD COLUMN course_end_date TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ course_end_date column already exists in 'students' table.");
      } else {
        console.error("❌ Failed to add course_end_date to 'students' table:", err.message);
      }
    } else {
      console.log("✅ Added course_end_date column to 'students' table.");
    }
  });

  // 2. Add project_start_date and project_end_date to ojt_trainees table
  db.run("ALTER TABLE ojt_trainees ADD COLUMN project_start_date TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ project_start_date column already exists in 'ojt_trainees' table.");
      } else {
        console.error("❌ Failed to add project_start_date to 'ojt_trainees' table:", err.message);
      }
    } else {
      console.log("✅ Added project_start_date column to 'ojt_trainees' table.");
    }
  });

  db.run("ALTER TABLE ojt_trainees ADD COLUMN project_end_date TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ project_end_date column already exists in 'ojt_trainees' table.");
      } else {
        console.error("❌ Failed to add project_end_date to 'ojt_trainees' table:", err.message);
      }
    } else {
      console.log("✅ Added project_end_date column to 'ojt_trainees' table.");
    }
  });
});

db.close((err) => {
  if (err) {
    console.error("Error closing database:", err.message);
  } else {
    console.log("Database connection closed. Migration finished.");
  }
});
