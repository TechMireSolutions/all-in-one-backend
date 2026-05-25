// One-shot seeder: creates a few demo roles in the custom_roles table.
// Run with: node seed_demo_roles.js
import { connectDB } from "./DB/DBconnection.js";
import CustomRole from "./models/customRoleModel.js";

const DEMO_ROLES = [
  { name: "Team Lead",       description: "Leads a small team and reports to management." },
  { name: "Trainer",         description: "Conducts training sessions and onboarding." },
  { name: "Auditor",         description: "Reviews records and ensures compliance." },
  { name: "Course Manager",  description: "Owns course content and curriculum updates." },
  { name: "Guest",           description: "Read-only access for external visitors." },
];

const run = async () => {
  try {
    await connectDB();
    await CustomRole.sync();

    let created = 0, skipped = 0;
    for (const r of DEMO_ROLES) {
      const existing = await CustomRole.findOne({ where: { name: r.name } });
      if (existing) {
        skipped += 1;
        continue;
      }
      await CustomRole.create(r);
      created += 1;
    }

    console.log(`Done. Created ${created} role(s), skipped ${skipped} existing.`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

run();
