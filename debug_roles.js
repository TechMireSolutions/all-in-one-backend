// Quick diagnostic: prints all custom roles, all HR accounts, and which HR
// accounts (if any) are linked to a custom role.
// Run with: node debug_roles.js
import { connectDB, sequelize } from "./DB/DBconnection.js";
import { QueryTypes } from "sequelize";

const run = async () => {
  await connectDB();
  console.log("\n=========================");
  console.log("  CUSTOM_ROLES TABLE");
  console.log("=========================");
  try {
    const roles = await sequelize.query("SELECT id, name, description, allowed_pages FROM custom_roles", { type: QueryTypes.SELECT });
    if (roles.length === 0) {
      console.log("(empty — no custom roles created yet)");
    } else {
      roles.forEach((r) => {
        const pages = typeof r.allowed_pages === "string" ? r.allowed_pages : JSON.stringify(r.allowed_pages);
        console.log(`  #${r.id}  ${r.name}  pages=${pages}`);
      });
    }
  } catch (e) {
    console.log("  ❌ Could not read custom_roles:", e.message);
  }

  console.log("\n=========================");
  console.log("  HR_USERS TABLE");
  console.log("=========================");
  try {
    // Try to read with custom_role_id; fall back to without if column missing.
    let rows = [];
    try {
      rows = await sequelize.query("SELECT id, email, custom_role_id FROM hr_users", { type: QueryTypes.SELECT });
    } catch {
      rows = await sequelize.query("SELECT id, email FROM hr_users", { type: QueryTypes.SELECT });
      console.log("  ⚠️  custom_role_id column does NOT exist on hr_users — that's the bug!");
    }
    if (rows.length === 0) {
      console.log("(empty — no HR accounts)");
    } else {
      rows.forEach((h) => {
        const linked = h.custom_role_id !== undefined
          ? (h.custom_role_id ? `→ role #${h.custom_role_id}` : "(plain HR, no role)")
          : "(custom_role_id column missing)";
        console.log(`  #${h.id}  ${h.email}  ${linked}`);
      });
    }
  } catch (e) {
    console.log("  ❌ Could not read hr_users:", e.message);
  }

  console.log("\nDone.");
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
