import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "database.sqlite");

console.log("Starting migration: adding fileUrl to policies table...");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error("❌ Failed to open database:", err.message); process.exit(1); }
  console.log("Connected to the SQLite database.");
});

db.serialize(() => {
  db.run("ALTER TABLE policies ADD COLUMN fileUrl TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ fileUrl column already exists in 'policies' table.");
      } else {
        console.error("❌ Failed to add fileUrl column:", err.message);
      }
    } else {
      console.log("✅ Added fileUrl column to 'policies' table.");
    }
  });
});

db.close((err) => {
  if (err) { console.error("Error closing database:", err.message); }
  else { console.log("Database connection closed. Migration finished."); }
});
