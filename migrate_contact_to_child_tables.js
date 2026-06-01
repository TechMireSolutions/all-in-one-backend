// One-shot migration: drop the legacy JSON-blob columns from the contacts
// table and let Sequelize sync() create the new child tables.
//
//   Old (gone):    family, education, experience, office, health, emergency
//   New (synced):  contact_emergencies, contact_educations, contact_experiences,
//                  contact_offices, contact_healths
//
// Safe to run on a fresh DB (the column drops are best-effort and ignored
// when the columns don't exist).
//
// Run with: node migrate_contact_to_child_tables.js

import { connectDB, sequelize } from "./DB/DBconnection.js";
// Import so the new tables get registered with Sequelize before sync().
import {
  Contact,
  ContactPhoneNumber,
  ContactEmail,
  ContactAddress,
  ContactSocial,
  ContactEmergency,
  ContactEducation,
  ContactExperience,
  ContactOffice,
  ContactHealth,
  MergeLog,
} from "./models/contactModel.js";

const LEGACY_COLUMNS = ["family", "education", "experience", "office", "health", "emergency"];

const run = async () => {
  try {
    await connectDB();

    // 1. Drop the legacy JSON columns if they still exist.
    const qi = sequelize.getQueryInterface();
    let dropped = 0;
    let table;
    try { table = await qi.describeTable("contacts"); } catch { table = {}; }
    for (const col of LEGACY_COLUMNS) {
      if (table[col]) {
        try {
          await qi.removeColumn("contacts", col);
          console.log(`✅ Dropped contacts.${col}`);
          dropped += 1;
        } catch (e) {
          console.warn(`⚠️  Could not drop contacts.${col}:`, e.message);
        }
      }
    }
    if (!dropped) console.log("(no legacy columns to drop — DB is already clean)");

    // 2. Create the new child tables.
    await ContactEmergency.sync();
    await ContactEducation.sync();
    await ContactExperience.sync();
    await ContactOffice.sync();
    await ContactHealth.sync();
    console.log("✅ Synced: contact_emergencies, contact_educations, contact_experiences, contact_offices, contact_healths");

    // 3. Re-sync existing child tables in case associations changed.
    await Contact.sync();
    await ContactPhoneNumber.sync();
    await ContactEmail.sync();
    await ContactAddress.sync();
    await ContactSocial.sync();
    await MergeLog.sync();

    console.log("\nMigration complete. The contacts table now uses 1:Many child tables for every profile block.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

run();
