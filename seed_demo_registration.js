// Seeding script for dynamic Registration Module
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
import { Contact } from "./models/contactModel.js";

async function seed() {
  console.log("🔄 Connecting to database and preparing clean schema...");
  await connectDB();

  // Disable foreign key constraints during seeding to safely purge and sync
  await sequelize.query("PRAGMA foreign_keys = OFF;");

  const order = [
    "RegistrationForm", "RegistrationSection", "RegistrationField",
    "Registration", "RegistrationAnswer", "RegistrationStatusLog",
    "RegistrationRole", "RegistrationStudent", "RegistrationOJT",
    "RegistrationEmployee"
  ];
  const rm = await import("./models/registrationModel.js");
  for (const name of order) {
    await rm[name].sync({ force: true });
  }

  await sequelize.query("PRAGMA foreign_keys = ON;");
  console.log("✅ Clean tables initialized.");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SEED STUDENT FORM (slug: student-admissions)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📝 Seeding Student Admissions Form...");
  const formStudent = await RegistrationForm.create({
    title: "Tahseen-ul-Quran & Academic Admissions",
    slug: "student-admissions",
    description: "Enrollment form for both Islamic Hifz/Nazra and modern academic curriculums.",
    category: "Program",
    status: "Open",
    capacity: 250,
    link_contact: true,
    require_cnic: true,
    require_payment: true,
    fee_amount: 1500.00,
  });

  const secPersonal = await RegistrationSection.create({
    formId: formStudent.id,
    title: "Student Personal Information",
    description: "Provide birth documentation matching the government CNIC or B-Form.",
    order_index: 0,
  });

  const secAcademic = await RegistrationSection.create({
    formId: formStudent.id,
    title: "Program and Logistical Preferences",
    description: "Select which program and logistics you require.",
    order_index: 1,
  });

  // Fields
  const f1_fname = await RegistrationField.create({
    formId: formStudent.id, sectionId: secPersonal.id, field_key: "first_name",
    label: "First Name", field_type: "text", is_required: true, order_index: 0,
    mapped_contact_field: "first_name"
  });

  const f1_lname = await RegistrationField.create({
    formId: formStudent.id, sectionId: secPersonal.id, field_key: "last_name",
    label: "Last Name", field_type: "text", is_required: true, order_index: 1,
    mapped_contact_field: "last_name"
  });

  const f1_cnic = await RegistrationField.create({
    formId: formStudent.id, sectionId: secPersonal.id, field_key: "cnic",
    label: "CNIC / B-Form Number", field_type: "cnic", is_required: true, is_unique: true, order_index: 2,
    mapped_contact_field: "cnic"
  });

  const f1_gender = await RegistrationField.create({
    formId: formStudent.id, sectionId: secPersonal.id, field_key: "gender",
    label: "Gender", field_type: "select", is_required: true, order_index: 3,
    options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
    mapped_contact_field: "gender"
  });

  const f1_dob = await RegistrationField.create({
    formId: formStudent.id, sectionId: secPersonal.id, field_key: "dob",
    label: "Date of Birth", field_type: "date", is_required: true, order_index: 4,
    mapped_contact_field: "dob"
  });

  const f1_prog = await RegistrationField.create({
    formId: formStudent.id, sectionId: secAcademic.id, field_key: "program",
    label: "Target Academic Program", field_type: "select", is_required: true, order_index: 5,
    options: [
      { value: "Hifz", label: "Hifz-ul-Quran" },
      { value: "Nazra", label: "Nazra & Tajweed" },
      { value: "Aalim", label: "Aalim Course" },
      { value: "Academic", label: "Secondary Science Curriculum" }
    ],
  });

  const f1_hostel = await RegistrationField.create({
    formId: formStudent.id, sectionId: secAcademic.id, field_key: "hostel_required",
    label: "Hostel/Residency Accommodation Required", field_type: "boolean", is_required: false, order_index: 6,
    default_value: "false",
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SEED OJT FORM (slug: ojt-application)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📝 Seeding OJT Internship Program Form...");
  const formOjt = await RegistrationForm.create({
    title: "OJT Trainee Program & Professional Placement",
    slug: "ojt-application",
    description: "Apply for corporate training and structured industrial software engineering placements.",
    category: "Job",
    status: "Open",
    capacity: 50,
    link_contact: true,
    require_cnic: true,
  });

  const secOjtPersonal = await RegistrationSection.create({
    formId: formOjt.id, title: "Candidate Details", order_index: 0,
  });

  const secOjtPost = await RegistrationSection.create({
    formId: formOjt.id, title: "Internship Preference", order_index: 1,
  });

  const f2_fname = await RegistrationField.create({
    formId: formOjt.id, sectionId: secOjtPersonal.id, field_key: "first_name",
    label: "First Name", field_type: "text", is_required: true, order_index: 0,
    mapped_contact_field: "first_name"
  });

  const f2_lname = await RegistrationField.create({
    formId: formOjt.id, sectionId: secOjtPersonal.id, field_key: "last_name",
    label: "Last Name", field_type: "text", is_required: true, order_index: 1,
    mapped_contact_field: "last_name"
  });

  const f2_cnic = await RegistrationField.create({
    formId: formOjt.id, sectionId: secOjtPersonal.id, field_key: "cnic",
    label: "CNIC", field_type: "cnic", is_required: true, is_unique: true, order_index: 2,
    mapped_contact_field: "cnic"
  });

  const f2_gender = await RegistrationField.create({
    formId: formOjt.id, sectionId: secOjtPersonal.id, field_key: "gender",
    label: "Gender", field_type: "select", is_required: true, order_index: 3,
    options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
    mapped_contact_field: "gender"
  });

  const f2_dob = await RegistrationField.create({
    formId: formOjt.id, sectionId: secOjtPersonal.id, field_key: "dob",
    label: "Date of Birth", field_type: "date", is_required: true, order_index: 4,
    mapped_contact_field: "dob"
  });

  const f2_dept = await RegistrationField.create({
    formId: formOjt.id, sectionId: secOjtPost.id, field_key: "department",
    label: "Target Placement Department", field_type: "select", is_required: true, order_index: 5,
    options: [
      { value: "Engineering", label: "Software Engineering Division" },
      { value: "Quality Assurance", label: "SQA & Automated Testing" },
      { value: "Finance", label: "Accounts & Financial Control" },
      { value: "Human Resources", label: "HR Operations" }
    ],
  });

  const f2_duration = await RegistrationField.create({
    formId: formOjt.id, sectionId: secOjtPost.id, field_key: "duration_months",
    label: "Desired Placement Period (Months)", field_type: "number", is_required: true, order_index: 6,
    default_value: "6",
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SEED EMPLOYEE FORM (slug: staff-onboarding)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📝 Seeding Employee Staff Onboarding Form...");
  const formEmp = await RegistrationForm.create({
    title: "Employee Hiring & Staff Onboarding Portal",
    slug: "staff-onboarding",
    description: "Submit personal credentials to generate payroll cards, employment bands, and designations.",
    category: "Job",
    status: "Open",
    capacity: 100,
    link_contact: true,
    require_cnic: true,
  });

  const secEmpPersonal = await RegistrationSection.create({
    formId: formEmp.id, title: "Personal Mappings", order_index: 0,
  });

  const secEmpContracts = await RegistrationSection.create({
    formId: formEmp.id, title: "Professional Assignment Details", order_index: 1,
  });

  const f3_fname = await RegistrationField.create({
    formId: formEmp.id, sectionId: secEmpPersonal.id, field_key: "first_name",
    label: "First Name", field_type: "text", is_required: true, order_index: 0,
    mapped_contact_field: "first_name"
  });

  const f3_lname = await RegistrationField.create({
    formId: formEmp.id, sectionId: secEmpPersonal.id, field_key: "last_name",
    label: "Last Name", field_type: "text", is_required: true, order_index: 1,
    mapped_contact_field: "last_name"
  });

  const f3_cnic = await RegistrationField.create({
    formId: formEmp.id, sectionId: secEmpPersonal.id, field_key: "cnic",
    label: "CNIC", field_type: "cnic", is_required: true, is_unique: true, order_index: 2,
    mapped_contact_field: "cnic"
  });

  const f3_gender = await RegistrationField.create({
    formId: formEmp.id, sectionId: secEmpPersonal.id, field_key: "gender",
    label: "Gender", field_type: "select", is_required: true, order_index: 3,
    options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
    mapped_contact_field: "gender"
  });

  const f3_dob = await RegistrationField.create({
    formId: formEmp.id, sectionId: secEmpPersonal.id, field_key: "dob",
    label: "Date of Birth", field_type: "date", is_required: true, order_index: 4,
    mapped_contact_field: "dob"
  });

  const f3_desig = await RegistrationField.create({
    formId: formEmp.id, sectionId: secEmpContracts.id, field_key: "designation",
    label: "Designation", field_type: "text", is_required: true, order_index: 5,
    default_value: "Associate Engineer",
  });

  const f3_dept = await RegistrationField.create({
    formId: formEmp.id, sectionId: secEmpContracts.id, field_key: "department",
    label: "Department", field_type: "select", is_required: true, order_index: 6,
    options: [
      { value: "IT", label: "IT & Infrastructure" },
      { value: "Academic", label: "Academic Instruction" },
      { value: "Finance", label: "Finance & Accounting" },
      { value: "Admin", label: "General Administration" }
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SEED SAMPLE SUBMISSIONS WITH LINKED CONTACTS & CHILD ROWS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("💾 Seeding dynamic submissions and generating child rows...");

  // Purge any existing test contacts to prevent unique CNIC violations
  const studentCnic = "35201-9988776-3"; // Odd ending -> Male
  const ojtCnic = "35201-1122334-4"; // Even ending -> Female
  const empCnic = "35201-7766554-1"; // Odd ending -> Male
  await Contact.destroy({ where: { cnic: [studentCnic, ojtCnic, empCnic] } });

  // Sample Student Submission
  const c1 = await Contact.create({
    first_name: "Muhammad", last_name: "Rizwan",
    cnic: studentCnic, gender: "Male", dob: new Date("2010-08-15"),
    is_syed: false,
  });

  const rStudent = await Registration.create({
    formId: formStudent.id,
    contactId: c1.id,
    registration_number: "REG-2026-000101",
    status: "Approved",
    payment_status: "Paid",
    payment_ref: "TXN-STUDENT-990",
    source: "Web",
  });

  await RegistrationAnswer.create({ registrationId: rStudent.id, fieldId: f1_fname.id, field_key: "first_name", value_text: "Muhammad" });
  await RegistrationAnswer.create({ registrationId: rStudent.id, fieldId: f1_lname.id, field_key: "last_name", value_text: "Rizwan" });
  await RegistrationAnswer.create({ registrationId: rStudent.id, fieldId: f1_cnic.id, field_key: "cnic", value_text: studentCnic });
  await RegistrationAnswer.create({ registrationId: rStudent.id, fieldId: f1_gender.id, field_key: "gender", value_text: "Male" });
  await RegistrationAnswer.create({ registrationId: rStudent.id, fieldId: f1_dob.id, field_key: "dob", value_date: new Date("2010-08-15") });
  await RegistrationAnswer.create({ registrationId: rStudent.id, fieldId: f1_prog.id, field_key: "program", value_text: "Hifz" });
  await RegistrationAnswer.create({ registrationId: rStudent.id, fieldId: f1_hostel.id, field_key: "hostel_required", value_boolean: true });

  await RegistrationStatusLog.create({ registrationId: rStudent.id, from_status: null, to_status: "Submitted", note: "Online admission form submitted" });
  await RegistrationStatusLog.create({ registrationId: rStudent.id, from_status: "Submitted", to_status: "Approved", note: "B-form verified and admission approved" });

  await RegistrationRole.create({ registrationId: rStudent.id, role_name: "Student", is_primary: true });
  await RegistrationStudent.create({
    registrationId: rStudent.id,
    contactId: c1.id,
    student_number: "STD-2026-000101",
    enrollment_date: new Date("2026-06-01"),
    class_level: "Grade 6",
    program: "Hifz",
    batch: "Summer-2026",
    roll_number: "HIFZ-044",
    guardian_name: "Tariq Mahmood",
    guardian_phone: "+923001234567",
    guardian_relation: "Father",
    hostel_required: true,
    transport_required: false,
    fee_status: "Paid",
    status: "Active",
  });

  // Sample OJT Submission
  const c2 = await Contact.create({
    first_name: "Ayesha", last_name: "Khan",
    cnic: ojtCnic, gender: "Female", dob: new Date("2002-04-12"),
    is_syed: true,
  });

  const rOjt = await Registration.create({
    formId: formOjt.id,
    contactId: c2.id,
    registration_number: "REG-2026-000202",
    status: "Under Review",
    payment_status: "N/A",
    source: "Admin",
  });

  await RegistrationAnswer.create({ registrationId: rOjt.id, fieldId: f2_fname.id, field_key: "first_name", value_text: "Ayesha" });
  await RegistrationAnswer.create({ registrationId: rOjt.id, fieldId: f2_lname.id, field_key: "last_name", value_text: "Khan" });
  await RegistrationAnswer.create({ registrationId: rOjt.id, fieldId: f2_cnic.id, field_key: "cnic", value_text: ojtCnic });
  await RegistrationAnswer.create({ registrationId: rOjt.id, fieldId: f2_gender.id, field_key: "gender", value_text: "Female" });
  await RegistrationAnswer.create({ registrationId: rOjt.id, fieldId: f2_dob.id, field_key: "dob", value_date: new Date("2002-04-12") });
  await RegistrationAnswer.create({ registrationId: rOjt.id, fieldId: f2_dept.id, field_key: "department", value_text: "Engineering" });
  await RegistrationAnswer.create({ registrationId: rOjt.id, fieldId: f2_duration.id, field_key: "duration_months", value_number: 6.0 });

  await RegistrationStatusLog.create({ registrationId: rOjt.id, from_status: null, to_status: "Submitted", note: "OJT application registered by admin" });
  await RegistrationStatusLog.create({ registrationId: rOjt.id, from_status: "Submitted", to_status: "Under Review", note: "Documents assigned to Engineering Supervisor for review" });

  await RegistrationRole.create({ registrationId: rOjt.id, role_name: "OJT", is_primary: true });
  await RegistrationOJT.create({
    registrationId: rOjt.id,
    contactId: c2.id,
    ojt_number: "OJT-2026-000202",
    start_date: new Date("2026-07-01"),
    end_date: new Date("2026-12-31"),
    duration_months: 6,
    department: "Engineering",
    assigned_post: "Associate QA Trainee",
    training_type: "Stipend",
    stipend_amount: 15000.00,
    working_hours_per_week: 40,
    institution: "NUST University Islamabad",
    status: "Pending",
  });

  // Sample Employee Submission
  const c3 = await Contact.create({
    first_name: "Syed", last_name: "Mustafa",
    cnic: empCnic, gender: "Male", dob: new Date("1994-11-30"),
    is_syed: true,
  });

  const rEmp = await Registration.create({
    formId: formEmp.id,
    contactId: c3.id,
    registration_number: "REG-2026-000303",
    status: "Approved",
    payment_status: "N/A",
    source: "Import",
  });

  await RegistrationAnswer.create({ registrationId: rEmp.id, fieldId: f3_fname.id, field_key: "first_name", value_text: "Syed" });
  await RegistrationAnswer.create({ registrationId: rEmp.id, fieldId: f3_lname.id, field_key: "last_name", value_text: "Mustafa" });
  await RegistrationAnswer.create({ registrationId: rEmp.id, fieldId: f3_cnic.id, field_key: "cnic", value_text: empCnic });
  await RegistrationAnswer.create({ registrationId: rEmp.id, fieldId: f3_gender.id, field_key: "gender", value_text: "Male" });
  await RegistrationAnswer.create({ registrationId: rEmp.id, fieldId: f3_dob.id, field_key: "dob", value_date: new Date("1994-11-30") });
  await RegistrationAnswer.create({ registrationId: rEmp.id, fieldId: f3_desig.id, field_key: "designation", value_text: "Senior Quran Instructor" });
  await RegistrationAnswer.create({ registrationId: rEmp.id, fieldId: f3_dept.id, field_key: "department", value_text: "Academic" });

  await RegistrationStatusLog.create({ registrationId: rEmp.id, from_status: null, to_status: "Submitted", note: "Employee profile imported into system" });
  await RegistrationStatusLog.create({ registrationId: rEmp.id, from_status: "Submitted", to_status: "Approved", note: "Background verify approved and contract issued" });

  await RegistrationRole.create({ registrationId: rEmp.id, role_name: "Employee", is_primary: true });
  await RegistrationEmployee.create({
    registrationId: rEmp.id,
    contactId: c3.id,
    employee_id: "EMP-2026-000303",
    joining_date: new Date("2026-06-01"),
    designation: "Senior Quran Instructor",
    department: "Academic",
    grade: "Grade-17",
    employment_type: "Full-time",
    work_location: "Main Branch Campus",
    shift: "Morning",
    working_hours_per_week: 36,
    salary_basic: 45000.00,
    salary_allowance: 10000.00,
    salary_currency: "PKR",
    payment_method: "Bank",
    bank_name: "Meezan Bank Limited",
    bank_account: "010203040506070809",
    tax_number: "NTN-8877990-2",
    eobi_number: "EOBI-77889911",
    probation_months: 3,
    is_probation: true,
    status: "Probation",
  });

  await sequelize.close();
  console.log("\n⭐️ Dynamic Registration Module Seeded Successfully! ⭐️");
}

seed().catch((e) => {
  console.error("❌ Seeding failed:", e);
  process.exit(1);
});
