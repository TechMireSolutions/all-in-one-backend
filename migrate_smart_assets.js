import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { sequelize } from "./DB/DBconnection.js";
import Asset from "./models/assetModel.js";
import SmartMoosaUser from "./models/smartMoosaUserModel.js";
import Assignment from "./models/assignmentModel.js";
import ChatHistory from "./models/chatHistoryModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const djangoDbPath = path.resolve(__dirname, "..", "smart moosa", "SMARTASSET-backend-main", "SMARTASSET-backend-main", "db.sqlite3");

console.log("🚀 Starting Smart Assets Database Migration");
console.log("Source Database:", djangoDbPath);

const migrate = async () => {
  try {
    // 1. Sync Sequelize Models to make sure tables exist in database.sqlite
    console.log("🔄 Syncing Sequelize database...");
    await sequelize.sync();
    console.log("✅ Sequelize models synced.");

    // 2. Open Django Database connection
    const djangoDb = new sqlite3.Database(djangoDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error("❌ Error opening source Django database:", err.message);
        process.exit(1);
      }
    });

    // 3. Migrate Users
    console.log("👤 Migrating users...");
    djangoDb.all("SELECT * FROM auth_user", [], async (err, users) => {
      if (err) {
        console.error("❌ Error reading auth_user:", err.message);
        return;
      }

      console.log(`Found ${users.length} users in Django DB.`);
      for (const u of users) {
        const existing = await SmartMoosaUser.findOne({ where: { username: u.username } });
        if (!existing) {
          // Since Django PBKDF2 hashing is complex to verify in Express, we migrate with a default password 'tms12345'
          const defaultPassword = "tms12345";
          const hashedPassword = SmartMoosaUser.hashPassword(defaultPassword);
          await SmartMoosaUser.create({
            id: u.id,
            username: u.username,
            email: u.email,
            password: defaultPassword, // Model hook will hash this automatically!
          });
          console.log(`✅ Migrated user '${u.username}' (default password set to: ${defaultPassword})`);
        } else {
          console.log(`ℹ️ User '${u.username}' already exists. Skipping.`);
        }
      }

      // 4. Migrate Assets
      console.log("💻 Migrating assets...");
      djangoDb.all("SELECT * FROM inventory_asset", [], async (err, assets) => {
        if (err) {
          console.error("❌ Error reading inventory_asset:", err.message);
          return;
        }

        console.log(`Found ${assets.length} assets in Django DB.`);
        for (const a of assets) {
          const existing = await Asset.findOne({ where: { serial_number: a.serial_number } });
          if (!existing) {
            await Asset.create({
              id: a.id,
              name: a.name,
              asset_model: a.asset_model,
              serial_number: a.serial_number,
              ram: a.ram || "16GB",
              os: a.os || "Windows 11 Pro",
              cpu: a.cpu || "Intel Core i7",
              purchase_date: a.purchase_date || null,
              condition: a.condition || "New",
              external_storage: a.external_storage || "None",
              external_storage_size: a.external_storage_size || "N/A",
              additional_notes: a.additional_notes || "",
              status: a.status || "Available",
              qr_code: a.qr_code || null,
              createdAt: a.created_at ? new Date(a.created_at) : new Date(),
            });
            console.log(`✅ Migrated asset '${a.name}' (${a.serial_number})`);
          } else {
            console.log(`ℹ️ Asset '${a.name}' with serial ${a.serial_number} already exists. Skipping.`);
          }
        }

        // 5. Migrate Assignments
        console.log("📋 Migrating assignments...");
        djangoDb.all("SELECT * FROM inventory_assignment", [], async (err, assignments) => {
          if (err) {
            console.error("❌ Error reading inventory_assignment:", err.message);
            return;
          }

          console.log(`Found ${assignments.length} assignments in Django DB.`);
          for (const asg of assignments) {
            const existing = await Assignment.findByPk(asg.id);
            if (!existing) {
              await Assignment.create({
                id: asg.id,
                employee_name: asg.employee_name,
                shift: asg.shift || "Full-time",
                assignment_date: asg.assignment_date ? new Date(asg.assignment_date) : new Date(),
                return_date: asg.return_date ? new Date(asg.return_date) : null,
                assetId: asg.asset_id,
              });
              console.log(`✅ Migrated assignment ID ${asg.id} (asset ID: ${asg.asset_id})`);
            }
          }

          // 6. Migrate Support Chat History
          console.log("💬 Migrating chat histories...");
          djangoDb.all("SELECT * FROM inventory_chathistory", [], async (err, chats) => {
            if (err) {
              console.error("❌ Error reading inventory_chathistory:", err.message);
              return;
            }

            console.log(`Found ${chats.length} chat histories in Django DB.`);
            for (const c of chats) {
              const existing = await ChatHistory.findByPk(c.id);
              if (!existing) {
                await ChatHistory.create({
                  id: c.id,
                  user_query: c.user_query,
                  ai_response: c.ai_response,
                  assetId: c.asset_id,
                  createdAt: c.timestamp ? new Date(c.timestamp) : new Date(),
                });
                console.log(`✅ Migrated chat history ID ${c.id}`);
              }
            }

            console.log("🎉 Database Migration Completed Successfully!");
            djangoDb.close();
            // Close Sequelize connection to release CLI lock
            setTimeout(() => {
              sequelize.close();
              process.exit(0);
            }, 1000);
          });
        });
      });
    });
  } catch (error) {
    console.error("❌ Migration failed with error:", error.stack);
    process.exit(1);
  }
};

migrate();
