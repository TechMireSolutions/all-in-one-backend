import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'smart moosa', 'SMARTASSET-backend-main', 'SMARTASSET-backend-main', 'db.sqlite3');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
});

db.get("SELECT * FROM inventory_asset LIMIT 1", [], (err, row) => {
  if (err) {
    console.error('Error querying inventory_asset:', err);
  } else {
    console.log('Sample Asset:', row);
  }
});

db.get("SELECT * FROM auth_user LIMIT 1", [], (err, row) => {
  if (err) {
    console.error('Error querying auth_user:', err);
  } else {
    console.log('Sample Auth User:', row);
  }
});
