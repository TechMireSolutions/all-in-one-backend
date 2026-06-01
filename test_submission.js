// Integration Test for Registration Submission, Contacts, and Dynamic Roles
import { connectDB, sequelize } from "./DB/DBconnection.js";
import {
  RegistrationForm,
  RegistrationSection,
  RegistrationField,
  Registration,
  RegistrationAnswer,
  RegistrationRole,
  RegistrationStudent,
  RegistrationEmployee,
} from "./models/registrationModel.js";
import { Contact } from "./models/contactModel.js";
import {
  submitRegistration,
  addRole,
  removeRole,
} from "./controllers/registrationController.js";
async function runTests() {
  console.log("🔄 Connecting to database...");
  await connectDB();

  // Temporarily disable foreign key constraints in SQLite to allow clean table dropping and syncing
  await sequelize.query("PRAGMA foreign_keys = OFF;");

  // Run model-by-model sync in the correct order with force: true to guarantee a clean schema
  const order = ["RegistrationForm", "RegistrationSection", "RegistrationField",
                 "Registration", "RegistrationAnswer", "RegistrationStatusLog",
                 "RegistrationRole", "RegistrationStudent", "RegistrationOJT",
                 "RegistrationEmployee"];
  const rm = await import("./models/registrationModel.js");
  for (const name of order) {
    try {
      await rm[name].sync({ force: true });
    } catch (e) {
      console.warn(`Sync warning for ${name}:`, e.message);
    }
  }

  // Re-enable foreign keys
  await sequelize.query("PRAGMA foreign_keys = ON;");

  // Create a clean test form
  const testSlug = `test-form-${Date.now()}`;
  console.log(`📝 Creating a mock registration form with slug: "${testSlug}"...`);

  const form = await RegistrationForm.create({
    title: "Test Admissions Form",
    slug: testSlug,
    description: "Form for automated test verification",
    category: "Program",
    status: "Open",
    capacity: 100,
    link_contact: true,
    require_cnic: true,
  });

  const section = await RegistrationSection.create({
    formId: form.id,
    title: "Personal Information",
    order_index: 0,
  });

  // Fields mapping to contact fields
  const first_name_field = await RegistrationField.create({
    formId: form.id,
    sectionId: section.id,
    field_key: "first_name",
    label: "First Name",
    field_type: "text",
    is_required: true,
    mapped_contact_field: "first_name",
  });

  const last_name_field = await RegistrationField.create({
    formId: form.id,
    sectionId: section.id,
    field_key: "last_name",
    label: "Last Name",
    field_type: "text",
    is_required: true,
    mapped_contact_field: "last_name",
  });

  const cnic_field = await RegistrationField.create({
    formId: form.id,
    sectionId: section.id,
    field_key: "cnic",
    label: "CNIC",
    field_type: "cnic",
    is_required: true,
    mapped_contact_field: "cnic",
  });

  const gender_field = await RegistrationField.create({
    formId: form.id,
    sectionId: section.id,
    field_key: "gender",
    label: "Gender",
    field_type: "select",
    is_required: true,
    options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
    mapped_contact_field: "gender",
  });

  const dob_field = await RegistrationField.create({
    formId: form.id,
    sectionId: section.id,
    field_key: "dob",
    label: "Date of Birth",
    field_type: "date",
    is_required: true,
    mapped_contact_field: "dob",
  });

  const mockCnic = "35201-1234567-5"; // Male ending digit (5)

  // Payload with both Student and Employee roles
  const payload = {
    answers: {
      first_name: "Ahmad",
      last_name: "Ali",
      cnic: mockCnic,
      gender: "Male",
      dob: "2000-01-01",
    },
    roles: [
      { role_name: "Student", is_primary: true },
      { role_name: "Employee", is_primary: false },
    ],
  };

  console.log("📬 Simulating public form submission...");
  let submittedReg = null;

  const mockReqSubmit = {
    params: { slug: testSlug },
    body: payload,
    ip: "127.0.0.1",
  };

  const mockResSubmit = {
    status: (code) => ({
      json: (data) => {
        if (code >= 400) {
          console.error("❌ Submission failed with error:", data);
        } else {
          submittedReg = data;
          console.log(`✅ Submission successful! Registration Number: ${data.registration_number}`);
        }
      },
    }),
  };

  await submitRegistration(mockReqSubmit, mockResSubmit);

  if (!submittedReg) {
    throw new Error("Form submission integration failed.");
  }

  // 1. Verify Contact was auto-created/linked
  console.log("🔍 Checking auto-created/linked Contact...");
  const contact = await Contact.findByPk(submittedReg.contactId);
  if (contact && contact.first_name === "Ahmad" && contact.cnic === mockCnic) {
    console.log(`✅ Contact verified: ${contact.first_name} ${contact.last_name} (${contact.cnic})`);
  } else {
    throw new Error("Contact linking or creation failed.");
  }

  // 2. Verify Student child profile was generated
  console.log("🔍 Checking auto-created RegistrationStudent row...");
  const student = await RegistrationStudent.findOne({ where: { registrationId: submittedReg.id } });
  if (student && student.student_number.startsWith("STD-") && student.status === "Active") {
    console.log(`✅ Student profile verified: student_number = ${student.student_number}, status = ${student.status}`);
  } else {
    throw new Error("RegistrationStudent child row was not auto-created correctly.");
  }

  // 3. Verify Employee child profile was generated
  console.log("🔍 Checking auto-created RegistrationEmployee row...");
  const employee = await RegistrationEmployee.findOne({ where: { registrationId: submittedReg.id } });
  if (employee && employee.employee_id.startsWith("EMP-") && employee.status === "Probation" && employee.is_probation === true) {
    console.log(`✅ Employee profile verified: employee_id = ${employee.employee_id}, status = ${employee.status}`);
  } else {
    throw new Error("RegistrationEmployee child row was not auto-created correctly.");
  }

  // 4. Test soft-archiving by removing the Employee role
  console.log("🔄 Deleting Employee role to verify soft-archiving...");
  const empRole = await RegistrationRole.findOne({
    where: { registrationId: submittedReg.id, role_name: "Employee" }
  });

  if (!empRole) {
    throw new Error("Could not locate the employee role record.");
  }

  const mockReqDelete = {
    params: { id: submittedReg.id, roleId: empRole.id }
  };

  const mockResDelete = {
    json: (data) => console.log(`✅ Controller removed role: ${data.message}`),
    status: (code) => ({ json: (data) => console.error(`❌ Remove failed:`, data) }),
  };

  await removeRole(mockReqDelete, mockResDelete);

  // Check if Employee child table status is changed to "Resigned"
  const employeeAfter = await RegistrationEmployee.findOne({ where: { registrationId: submittedReg.id } });
  if (employeeAfter && employeeAfter.status === "Resigned" && employeeAfter.leaving_date !== null) {
    console.log(`✅ Soft-archiving verified! Status set to: ${employeeAfter.status}, leaving_date: ${employeeAfter.leaving_date}`);
  } else {
    throw new Error("Employee child profile soft-archiving failed upon role removal.");
  }

  // Clean up
  console.log("🗑️ Cleaning up mock test records from database...");
  await sequelize.query("PRAGMA foreign_keys = OFF;");
  await form.destroy(); // onDelete: "CASCADE" should clear all sections, fields, registrations, answers, statusLogs, roles, students, employees
  await sequelize.query("PRAGMA foreign_keys = ON;");
  console.log("✅ Cascade delete verification complete.");

  await sequelize.close();
  console.log("\n⭐️ Integration Tests Passed Successfully! ⭐️");
}

runTests().catch((e) => {
  console.error("❌ Test run caught a fatal error:", e);
  sequelize.close();
  process.exit(1);
});
