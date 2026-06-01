import { connectDB, sequelize } from "./DB/DBconnection.js";
import {
  RegistrationForm,
  RegistrationSection,
  RegistrationField
} from "./models/registrationModel.js";

async function diag() {
  await connectDB();
  
  const form = await RegistrationForm.findOne({
    where: { slug: "ojt-application" },
    include: [
      { model: RegistrationSection, as: "sections" },
      { model: RegistrationField, as: "fields" }
    ]
  });

  if (!form) {
    console.log("❌ Form 'ojt-application' not found in database.");
    await sequelize.close();
    return;
  }

  console.log(`\n📋 Form: "${form.title}" (ID: ${form.id})`);
  console.log(`📂 Sections Count: ${form.sections.length}`);
  form.sections.forEach(s => {
    console.log(`   - Section: "${s.title}" (ID: ${s.id}, Type of ID: ${typeof s.id})`);
  });

  console.log(`📝 Fields Count: ${form.fields.length}`);
  form.fields.forEach(f => {
    console.log(`   - Field: "${f.label}" (Key: ${f.field_key}, ID: ${f.id}, sectionId: ${f.sectionId}, Type of sectionId: ${typeof f.sectionId})`);
    if (f.sectionId) {
      const match = form.sections.find(s => s.id === f.sectionId);
      console.log(`     -> Match section === sectionId: ${!!match}`);
    }
  });

  await sequelize.close();
}

diag().catch(console.error);
