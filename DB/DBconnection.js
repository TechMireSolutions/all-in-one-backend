import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import mysql2 from "mysql2";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sequelize;

const dbDialect = (process.env.DB_DIALECT || "sqlite").toLowerCase();

if (dbDialect === "sqlite" || !process.env.DB_HOST) {
  console.log("📦 Configuring Database: Dialect = SQLite");
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.join(__dirname, "..", "database.sqlite"),
    logging: false,
  });
} else {
  console.log(`📦 Configuring Database: Dialect = ${dbDialect}, Host = ${process.env.DB_HOST}`);
  
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || (dbDialect === "mysql" ? 3306 : 5432),
    dialect: dbDialect,
    logging: false,
  };

  if (dbDialect === "postgres") {
    config.dialectModule = pg;
    if (process.env.DB_SSL === "true") {
      config.dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };
    }
  } else if (dbDialect === "mysql") {
    config.dialectModule = mysql2;
  }

  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    config
  );
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ ${dbDialect.toUpperCase()} Connected Successfully`);

    // Use alter: true to automatically update tables with new/missing columns
    await sequelize.sync();
    console.log("✅ Database models synced");
  } catch (error) {
    console.error(`❌ ${dbDialect.toUpperCase()} Connection Failed:`, error.message);
    if (error.original) {
      console.error("❌ Original Database Error details:", error.original);
    }
  }
};

export { sequelize, connectDB };
