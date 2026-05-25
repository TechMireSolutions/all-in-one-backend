// One-shot seeder: inserts a handful of demo contacts so the Contacts page
// has data to render (Kanban columns, bulk WhatsApp, etc.).
// Run with: node seed_demo_contacts.js
import { connectDB } from "./DB/DBconnection.js";
import { Contact, ContactPhoneNumber, ContactEmail, ContactAddress } from "./models/contactModel.js";

const DEMO = [
  {
    first_name: "Ahmed", last_name: "Raza", cnic: "42101-1234567-1",
    gender: "Male",   dob: "1989-04-12", is_syed: false,
    phones: [{ phone_number: "+923001234567", phone_type: "Mobile" }],
    emails: [{ email_address: "ahmed.raza@example.com", email_type: "Personal" }],
    addresses: [{ address_line1: "House 12, Block A", city: "Karachi", state: "Sindh", country: "Pakistan", postal_code: "75500", address_type: "Home" }],
  },
  {
    first_name: "Hira", last_name: "Saleem", cnic: "42201-7654321-2",
    gender: "Female", dob: "1995-09-30", is_syed: false,
    phones: [{ phone_number: "+923109876543", phone_type: "Mobile" }],
    emails: [{ email_address: "hira.s@example.com", email_type: "Personal" }],
    addresses: [{ address_line1: "Flat 4-B, DHA Phase 5", city: "Lahore", state: "Punjab", country: "Pakistan", postal_code: "54000", address_type: "Home" }],
  },
  {
    first_name: "Bilal", last_name: "Khan", cnic: "61101-2222222-3",
    gender: "Male", dob: "1982-01-21", is_syed: true,
    phones: [{ phone_number: "+923211112222", phone_type: "Mobile" }],
    emails: [{ email_address: "bilal.k@example.com", email_type: "Office" }],
    addresses: [{ address_line1: "F-10 Markaz", city: "Islamabad", state: "ICT", country: "Pakistan", postal_code: "44000", address_type: "Office" }],
  },
  {
    first_name: "Sana", last_name: "Iqbal", cnic: "42101-3333333-4",
    gender: "Female", dob: "2001-06-05", is_syed: false,
    phones: [{ phone_number: "+923334445566", phone_type: "Mobile" }],
    emails: [{ email_address: "sana.iqbal@example.com", email_type: "Personal" }],
    addresses: [{ address_line1: "Clifton Block 5", city: "Karachi", state: "Sindh", country: "Pakistan", postal_code: "75600", address_type: "Home" }],
  },
  {
    first_name: "Yusuf", last_name: "Mehmood", cnic: "35202-4567890-5",
    gender: "Male", dob: "1993-11-18", is_syed: false,
    phones: [{ phone_number: "+923215556677", phone_type: "Mobile" }],
    emails: [{ email_address: "yusuf.m@example.com", email_type: "Personal" }],
    addresses: [{ address_line1: "Model Town", city: "Lahore", state: "Punjab", country: "Pakistan", postal_code: "54700", address_type: "Home" }],
  },
];

const run = async () => {
  try {
    await connectDB();
    await Contact.sync();
    await ContactPhoneNumber.sync();
    await ContactEmail.sync();
    await ContactAddress.sync();

    let created = 0, skipped = 0;
    for (const d of DEMO) {
      const existing = await Contact.findOne({ where: { cnic: d.cnic } });
      if (existing) { skipped += 1; continue; }
      const c = await Contact.create({
        first_name: d.first_name, last_name: d.last_name, cnic: d.cnic,
        gender: d.gender, dob: d.dob, is_syed: !!d.is_syed,
      });
      for (const p of d.phones)    await ContactPhoneNumber.create({ contactId: c.id, ...p });
      for (const e of d.emails)    await ContactEmail.create({ contactId: c.id, ...e });
      for (const a of d.addresses) await ContactAddress.create({ contactId: c.id, ...a });
      created += 1;
    }
    console.log(`Done. Created ${created} contact(s), skipped ${skipped} existing.`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

run();
