// One-shot seeder: inserts ONE fully-populated demo contact filling every tab
// of the contact form (Identity / Family / Phones / Emails / Addresses /
// Education / Experience / Office / Health / Socials / Emergency).
// Run with: node seed_demo_contact_one.js
import { connectDB, sequelize } from "./DB/DBconnection.js";
import {
  Contact, ContactPhoneNumber, ContactEmail, ContactAddress, ContactSocial,
} from "./models/contactModel.js";

const DEMO = {
  // Identity
  first_name: "Demo",
  last_name:  "User",
  cnic:       "42101-9999999-1",
  gender:     "Male",
  dob:        "1995-01-01",
  is_syed:    false,

  // Family (JSON column)
  family: {
    father_name: "Abdul Karim",   father_phone: "+923001112222", father_email: "abdul.karim@example.com",
    mother_name: "Saira Karim",    mother_phone: "+923113334444", mother_email: "saira.karim@example.com",
  },

  // Education (JSON column)
  education: {
    degree: "BSCS", institute: "FAST NUCES Karachi", grade: "A", year: "2018", current_study: "",
  },

  // Experience (JSON column)
  experience: {
    teach_subjects:  "Computer Basics, Web Development",
    teach_institute: "Aptech Karachi",
    teach_contact:   "+922135551234",
    position:        "Software Engineer",
    organization:    "Techmire Solutions",
    skills:          "React, Node.js, PostgreSQL, Tailwind",
  },

  // Office (JSON column)
  office: {
    employee_id:      "TMS-DEMO-001",
    registration_date: "2024-01-15",
    joining_date:      "2024-02-01",
    post_applied_for:  "Teacher",
    check_in_time:     "09:00",
    check_out_time:    "18:00",
    salary_cap:        "85000",
    description:       "Demo employee record for testing the contact-driven workflow.",
  },

  // Health (JSON column)
  health: {
    any_disease: "No", disease_details: "",
  },

  // Emergency (JSON column)
  emergency: {
    name: "Abdul Karim", phone: "+923001112222", relation: "Parent",
  },

  // Phones (relational)
  phones: [
    { phone_number: "+923009999999", phone_type: "Mobile" },
    { phone_number: "+922135559999", phone_type: "Home"   },
  ],

  // Emails (relational)
  emails: [
    { email_address: "demo.user@techmiresolutions.com", email_type: "Office"   },
    { email_address: "demo.personal@gmail.com",         email_type: "Personal" },
  ],

  // Addresses (relational)
  addresses: [
    {
      address_line1: "House 123, Demo Street", address_line2: "Block 5",
      city: "Karachi", state: "Sindh", country: "Pakistan",
      postal_code: "75500", address_type: "Home",
    },
    {
      address_line1: "Techmire HQ, 4th Floor", address_line2: "Shahrah-e-Faisal",
      city: "Karachi", state: "Sindh", country: "Pakistan",
      postal_code: "75600", address_type: "Office",
    },
  ],

  // Socials (relational)
  socials: [
    { platform: "LinkedIn",  url: "https://www.linkedin.com/in/demouser" },
    { platform: "Instagram", url: "https://www.instagram.com/demouser"   },
  ],
};

const run = async () => {
  try {
    await connectDB();
    // Make sure the new JSON columns exist on the contacts table.
    await sequelize.sync({ alter: true });

    const existing = await Contact.findOne({ where: { cnic: DEMO.cnic } });
    if (existing) {
      console.log(`Demo contact already exists (id=${existing.id}). Updating extras…`);
      await existing.update({
        family:     DEMO.family,
        education:  DEMO.education,
        experience: DEMO.experience,
        office:     DEMO.office,
        health:     DEMO.health,
        emergency:  DEMO.emergency,
      });
      console.log("Extras updated. Open the contact in the form — every tab should be pre-filled.");
      process.exit(0);
    }

    const c = await Contact.create({
      first_name: DEMO.first_name,
      last_name:  DEMO.last_name,
      cnic:       DEMO.cnic,
      gender:     DEMO.gender,
      dob:        DEMO.dob,
      is_syed:    DEMO.is_syed,
      family:     DEMO.family,
      education:  DEMO.education,
      experience: DEMO.experience,
      office:     DEMO.office,
      health:     DEMO.health,
      emergency:  DEMO.emergency,
    });
    for (const p of DEMO.phones)    await ContactPhoneNumber.create({ contactId: c.id, ...p });
    for (const e of DEMO.emails)    await ContactEmail.create({ contactId: c.id, ...e });
    for (const a of DEMO.addresses) await ContactAddress.create({ contactId: c.id, ...a });
    for (const s of DEMO.socials)   await ContactSocial.create({ contactId: c.id, ...s });

    console.log(`Created fully-populated demo contact id=${c.id}: ${DEMO.first_name} ${DEMO.last_name}.`);
    console.log("Open it from the Contacts list → every tab should be pre-filled.");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

run();
