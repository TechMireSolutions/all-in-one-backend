import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "database.sqlite");

console.log("Starting SQLite database migration at:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Failed to open database:", err.message);
    process.exit(1);
  }
  console.log("Connected to the SQLite database.");
});

db.serialize(() => {
  // 1. Add current_study to users table
  db.run("ALTER TABLE users ADD COLUMN current_study TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ current_study column already exists in 'users' table.");
      } else {
        console.error("❌ Failed to add column to 'users' table:", err.message);
      }
    } else {
      console.log("✅ Added current_study column to 'users' table.");
    }
  });

  // 2. Add current_study to exemployees table
  db.run("ALTER TABLE exemployees ADD COLUMN current_study TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ current_study column already exists in 'exemployees' table.");
      } else {
        console.error("❌ Failed to add column to 'exemployees' table:", err.message);
      }
    } else {
      console.log("✅ Added current_study column to 'exemployees' table.");
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
