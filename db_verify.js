// Verification script for dynamic registration tables
import { connectDB, sequelize } from "./DB/DBconnection.js";
import {
  RegistrationForm,
  RegistrationSection,
  RegistrationField,
  Registration,
  RegistrationAnswer,
  RegistrationStatusLog,
  RegistrationRole,
  RegistrationStudent,
  RegistrationOJT,
  RegistrationEmployee
} from "./models/registrationModel.js";

async function verify() {
  console.log("🔄 Initializing connection and model sync...");
  await connectDB();

  console.log("\n🚀 Synced models listing:");
  const models = [
    RegistrationForm,
    RegistrationSection,
    RegistrationField,
    Registration,
    RegistrationAnswer,
    RegistrationStatusLog,
    RegistrationRole,
    RegistrationStudent,
    RegistrationOJT,
    RegistrationEmployee
  ];

  for (const model of models) {
    const tableName = model.getTableName();
    try {
      const columns = await sequelize.getQueryInterface().describeTable(tableName);
      console.log(`✅ Table "${tableName}" is present. Columns: ${Object.keys(columns).join(", ")}`);
    } catch (e) {
      console.error(`❌ Table "${tableName}" failed to verify:`, e.message);
    }
  }

  await sequelize.close();
  console.log("\n👋 Verification complete. Connection closed.");
}

verify().catch((e) => {
  console.error("❌ Fatal error during verification:", e);
  process.exit(1);
});
