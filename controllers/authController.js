import { sequelize } from "../DB/DBconnection.js"
import { QueryTypes } from "sequelize"
import HrUser from "../models/hrUsers.js"
import OJT from "../models/ojtModel.js"
import Student from "../models/studentModel.js"
import crypto from "crypto"
import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

// 🔐 Import encryption functions from userController
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = "aes-256-cbc"

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error("❌ ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
  process.exit(1)
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex")

// ✅ Decryption function for employee data
const decrypt = (text) => {
  if (!text || typeof text !== "string") return null
  try {
    // Check if the text is already in encrypted format (contains ":")
    if (!text.includes(":")) {
      return text // Return as-is if not encrypted
    }

    const textParts = text.split(":")
    if (textParts.length !== 2) return text

    const iv = Buffer.from(textParts[0], "hex")
    const encryptedText = textParts[1]

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv)
    let decrypted = decipher.update(encryptedText, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (error) {
    console.error("❌ Decryption error:", error.message)
    return text // Return original text if decryption fails
  }
}

// ✅ Find employee by email and CNIC (decrypt and compare)
const findEmployeeByCredentials = async (email, cnic) => {
  try {
    const users = await sequelize.query("SELECT * FROM users", { type: QueryTypes.SELECT })

    for (const user of users) {
      const decryptedEmail = decrypt(user.email)
      const decryptedCnic = decrypt(user.cnic)

      if (decryptedEmail === email && decryptedCnic === cnic) {
        return user
      }
    }
    return null
  } catch (error) {
    console.error("❌ Error finding employee:", error.message)
    return null
  }
}

export const authController = {
  // ✅ Enhanced login with proper encryption handling
  login: async (req, res) => {
    let { stakeholder, email, cnic, password } = req.body

    try {
      // ── Auto-Detection Logic for Single Login (Role-Free) ───────────────────
      if (!stakeholder) {
        console.log("🔍 Auto-detecting stakeholder for single login...");
        const inputEmail = email ? email.trim() : "";
        const inputPassword = password ? password.trim() : "";

        // 1. Check Super Admin
        const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "superadmin@techmiresolutions.com").toLowerCase();
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin";
        if (
          (inputEmail.toLowerCase() === superAdminEmail || inputEmail.toLowerCase() === "admin" || !inputEmail) &&
          inputPassword === superAdminPassword
        ) {
          console.log("✅ Auto-detected: Super Admin");
          return res.status(200).json({
            message: "Super Admin login successful",
            user: { role: "superadmin" },
          });
        }

        // 2. Check HR (has password matching email)
        if (inputEmail) {
          const hr = await HrUser.findOne({ where: { email: inputEmail } });
          if (hr) {
            const isPasswordValid = hr.verifyPassword(inputPassword);
            if (isPasswordValid) {
              console.log("✅ Auto-detected: HR");
              // If the HR account is linked to a custom role, treat this as
              // a separate "role" login (NOT HR). This prevents the user
              // from ever landing on HR-default pages.
              if (hr.custom_role_id) {
                try {
                  const { default: CustomRole } = await import("../models/customRoleModel.js");
                  const role = await CustomRole.findByPk(hr.custom_role_id);
                  if (role) {
                    let pages = role.allowed_pages;
                    if (typeof pages === "string") {
                      try { pages = JSON.parse(pages); } catch { pages = []; }
                    }
                    const allowedPages = Array.isArray(pages) ? pages : [];
                    console.log(`🔐 Role login: ${hr.email} → ${role.name} (${allowedPages.length} pages)`);
                    return res.status(200).json({
                      message: "Role login successful",
                      user: {
                        id: hr.id,
                        role: "role",                          // ← distinct role identity
                        email: hr.email,
                        allowedPages,
                        customRole: { id: role.id, name: role.name },
                      },
                    });
                  }
                } catch (e) { console.error("Custom role lookup failed:", e.message); }
              }
              // Plain HR — no custom role attached.
              return res.status(200).json({
                message: "HR login successful",
                user: {
                  id: hr.id,
                  role: "hr",
                  email: hr.email,
                  allowedPages: hr.allowed_pages || null,
                  customRole: null,
                },
              });
            }
          }
        }

        // 3. Check Employee (decrypts all and matches email and cnic)
        if (inputEmail && inputPassword) {
          const employeeObj = await findEmployeeByCredentials(inputEmail, inputPassword);
          if (employeeObj) {
            if (employeeObj.record_type !== "employee") {
              return res.status(403).json({ message: "Login access is not allowed for contacts." })
            }
            if (!employeeObj.login_access) {
              return res.status(403).json({ message: "Your login access is disabled. Please contact Super Admin/HR for access." })
            }
            console.log("✅ Auto-detected: Employee");
            let decryptedUser = {
              id: employeeObj.id,
              employee_id: employeeObj.employee_id,
              registration_date: employeeObj.registration_date,
              joining_date: employeeObj.joining_date,
              post_applied_for: employeeObj.post_applied_for,
              full_name: employeeObj.full_name,
              gender: employeeObj.gender,
              cnic: decrypt(employeeObj.cnic) || employeeObj.cnic,
              dob: employeeObj.dob,
              permanent_address: decrypt(employeeObj.permanent_address) || employeeObj.permanent_address,
              contact_number: decrypt(employeeObj.contact_number) || employeeObj.contact_number,
              email: decrypt(employeeObj.email) || employeeObj.email,
              degree: employeeObj.degree,
              institute: employeeObj.institute,
              grade: employeeObj.grade,
              year: employeeObj.year,
              current_study: employeeObj.current_study,
              teaching_subjects: employeeObj.teaching_subjects,
              teaching_institute: employeeObj.teaching_institute,
              teaching_contact: employeeObj.teaching_contact ? decrypt(employeeObj.teaching_contact) : null,
              position: employeeObj.position,
              organization: employeeObj.organization,
              skills: employeeObj.skills,
              description: employeeObj.description,
              in_time: employeeObj.in_time,
              out_time: employeeObj.out_time,
              Salary_Cap: employeeObj.Salary_Cap,
              role: "employee",
              guardian_phone: decrypt(employeeObj.guardian_phone) || employeeObj.guardian_phone,
              reference_name: employeeObj.reference_name,
              reference_contact: employeeObj.reference_contact ? decrypt(employeeObj.reference_contact) : null,
              has_disease: employeeObj.has_disease,
              disease_description: employeeObj.disease_description,
            };
            let imageBase64 = null;
            if (employeeObj.image) {
              imageBase64 = Buffer.from(employeeObj.image).toString("base64");
              decryptedUser.image = `data:image/jpeg;base64,${imageBase64}`;
            } else {
              decryptedUser.image = null;
            }
            if (decryptedUser.cnic && decryptedUser.cnic.length >= 4) {
              decryptedUser.cnic_display = `****-****-${decryptedUser.cnic.slice(-4)}`;
              decryptedUser.cnic = decryptedUser.cnic_display;
            }
            decryptedUser.allowedPages = employeeObj.allowed_pages || null;
            return res.status(200).json({
              message: "Employee login successful",
              user: decryptedUser,
            });
          }
        }

        // 4. Check OJT
        if (inputEmail && inputPassword) {
          const ojtObj = await OJT.findOne({ where: { email: inputEmail, cnic: inputPassword } });
          if (ojtObj) {
            console.log("✅ Auto-detected: OJT");
            let decryptedUser = {
              id: ojtObj.id,
              employee_id: ojtObj.ojt_id,
              ojt_id: ojtObj.ojt_id,
              registration_date: ojtObj.createdAt,
              joining_date: ojtObj.joining_date,
              post_applied_for: "OJT Trainee",
              full_name: ojtObj.full_name,
              gender: ojtObj.gender,
              cnic: ojtObj.cnic,
              dob: ojtObj.dob,
              permanent_address: "",
              contact_number: ojtObj.contact_number,
              email: ojtObj.email,
              degree: ojtObj.degree,
              institute: ojtObj.institute,
              grade: "",
              year: "",
              teaching_subjects: "",
              teaching_institute: "",
              teaching_contact: null,
              position: "",
              organization: "",
              skills: ojtObj.project_technologies || [],
              description: ojtObj.description,
              in_time: "",
              out_time: "",
              Salary_Cap: 0,
              role: "ojt",
              guardian_phone: "",
              reference_name: "",
              reference_contact: null,
              has_disease: "No",
              disease_description: "",
              level: ojtObj.level,
              department: ojtObj.department,
              project_name: ojtObj.project_name,
              project_description: ojtObj.project_description,
              project_technologies: ojtObj.project_technologies,
              supervisor: ojtObj.supervisor,
              status: ojtObj.status,
              image: null
            };
            if (decryptedUser.cnic && decryptedUser.cnic.length >= 4) {
              decryptedUser.cnic_display = `****-****-${decryptedUser.cnic.slice(-4)}`;
              decryptedUser.cnic = decryptedUser.cnic_display;
            }
            decryptedUser.allowedPages = ojtObj.allowed_pages || null;
            return res.status(200).json({
              message: "OJT login successful",
              user: decryptedUser,
            });
          }
        }

        // 5. Check Student
        if (inputEmail && inputPassword) {
          const studentObj = await Student.findOne({ where: { email: inputEmail, cnic: inputPassword } });
          if (studentObj) {
            console.log("✅ Auto-detected: Student");
            let decryptedUser = {
              id: studentObj.id,
              employee_id: studentObj.student_id,
              student_id: studentObj.student_id,
              registration_date: studentObj.createdAt,
              joining_date: studentObj.joining_date,
              post_applied_for: "Student",
              full_name: studentObj.full_name,
              gender: studentObj.gender,
              cnic: studentObj.cnic,
              dob: studentObj.dob,
              permanent_address: "",
              contact_number: studentObj.contact_number,
              email: studentObj.email,
              degree: studentObj.degree,
              institute: studentObj.institute,
              grade: "",
              year: "",
              teaching_subjects: "",
              teaching_institute: "",
              teaching_contact: null,
              position: "",
              organization: "",
              skills: studentObj.courses || [],
              description: studentObj.description,
              in_time: "",
              out_time: "",
              Salary_Cap: 0,
              role: "student",
              guardian_phone: "",
              reference_name: "",
              reference_contact: null,
              has_disease: "No",
              disease_description: "",
              courses: studentObj.courses,
              semester: studentObj.semester,
              status: studentObj.status,
              image: null
            };
            if (decryptedUser.cnic && decryptedUser.cnic.length >= 4) {
              decryptedUser.cnic_display = `****-****-${decryptedUser.cnic.slice(-4)}`;
              decryptedUser.cnic = decryptedUser.cnic_display;
            }
            decryptedUser.allowedPages = studentObj.allowed_pages || null;
            return res.status(200).json({
              message: "Student login successful",
              user: decryptedUser,
            });
          }
        }

        // If none of the checks succeeded:
        return res.status(401).json({ message: "Invalid email, password, or CNIC" });
      }

      if (stakeholder === "employee" || stakeholder === "ojt" || stakeholder === "student") {
        if (!email || !cnic) {
          return res.status(400).json({ message: "Email and CNIC are required for login" })
        }

        console.log(`🔍 Searching for ${stakeholder} credentials...`)

        let userObj = null
        if (stakeholder === "employee") {
          userObj = await findEmployeeByCredentials(email, cnic)
        } else if (stakeholder === "ojt") {
          userObj = await OJT.findOne({ where: { email, cnic } })
        } else if (stakeholder === "student") {
          userObj = await Student.findOne({ where: { email, cnic } })
        }

        if (!userObj) {
          return res.status(401).json({ message: "Invalid email or CNIC" })
        }

        if (stakeholder === "employee") {
          if (userObj.record_type !== "employee") {
            return res.status(403).json({ message: "Login access is not allowed for contacts." })
          }
          if (!userObj.login_access) {
            return res.status(403).json({ message: "Your login access is disabled. Please contact Super Admin/HR for access." })
          }
        }

        console.log(`✅ ${stakeholder} found, preparing data for response...`)

        let decryptedUser = {}
        if (stakeholder === "employee") {
          decryptedUser = {
            id: userObj.id,
            employee_id: userObj.employee_id,
            registration_date: userObj.registration_date,
            joining_date: userObj.joining_date,
            post_applied_for: userObj.post_applied_for,
            full_name: userObj.full_name,
            gender: userObj.gender,
            cnic: decrypt(userObj.cnic) || userObj.cnic,
            dob: userObj.dob,
            permanent_address: decrypt(userObj.permanent_address) || userObj.permanent_address,
            contact_number: decrypt(userObj.contact_number) || userObj.contact_number,
            email: decrypt(userObj.email) || userObj.email,
            degree: userObj.degree,
            institute: userObj.institute,
            grade: userObj.grade,
            year: userObj.year,
            current_study: userObj.current_study,
            teaching_subjects: userObj.teaching_subjects,
            teaching_institute: userObj.teaching_institute,
            teaching_contact: userObj.teaching_contact ? decrypt(userObj.teaching_contact) : null,
            position: userObj.position,
            organization: userObj.organization,
            skills: userObj.skills,
            description: userObj.description,
            in_time: userObj.in_time,
            out_time: userObj.out_time,
            Salary_Cap: userObj.Salary_Cap,
            role: stakeholder,
            guardian_phone: decrypt(userObj.guardian_phone) || userObj.guardian_phone,
            reference_name: userObj.reference_name,
            reference_contact: userObj.reference_contact ? decrypt(userObj.reference_contact) : null,
            has_disease: userObj.has_disease,
            disease_description: userObj.disease_description,
          }
          // Handle image conversion
          let imageBase64 = null
          if (userObj.image) {
            imageBase64 = Buffer.from(userObj.image).toString("base64")
            decryptedUser.image = `data:image/jpeg;base64,${imageBase64}`
          } else {
            decryptedUser.image = null
          }
        } else if (stakeholder === "ojt") {
          decryptedUser = {
            id: userObj.id,
            employee_id: userObj.ojt_id,
            ojt_id: userObj.ojt_id,
            registration_date: userObj.createdAt,
            joining_date: userObj.joining_date,
            post_applied_for: "OJT Trainee",
            full_name: userObj.full_name,
            gender: userObj.gender,
            cnic: userObj.cnic,
            dob: userObj.dob,
            permanent_address: "",
            contact_number: userObj.contact_number,
            email: userObj.email,
            degree: userObj.degree,
            institute: userObj.institute,
            grade: "",
            year: "",
            teaching_subjects: "",
            teaching_institute: "",
            teaching_contact: null,
            position: "",
            organization: "",
            skills: userObj.project_technologies || [],
            description: userObj.description,
            in_time: "",
            out_time: "",
            Salary_Cap: 0,
            role: stakeholder,
            guardian_phone: "",
            reference_name: "",
            reference_contact: null,
            has_disease: "No",
            disease_description: "",
            level: userObj.level,
            department: userObj.department,
            project_name: userObj.project_name,
            project_description: userObj.project_description,
            project_technologies: userObj.project_technologies,
            supervisor: userObj.supervisor,
            status: userObj.status,
            image: null
          }
        } else if (stakeholder === "student") {
          decryptedUser = {
            id: userObj.id,
            employee_id: userObj.student_id,
            student_id: userObj.student_id,
            registration_date: userObj.createdAt,
            joining_date: userObj.joining_date,
            post_applied_for: "Student",
            full_name: userObj.full_name,
            gender: userObj.gender,
            cnic: userObj.cnic,
            dob: userObj.dob,
            permanent_address: "",
            contact_number: userObj.contact_number,
            email: userObj.email,
            degree: userObj.degree,
            institute: userObj.institute,
            grade: "",
            year: "",
            teaching_subjects: "",
            teaching_institute: "",
            teaching_contact: null,
            position: "",
            organization: "",
            skills: userObj.courses || [],
            description: userObj.description,
            in_time: "",
            out_time: "",
            Salary_Cap: 0,
            role: stakeholder,
            guardian_phone: "",
            reference_name: "",
            reference_contact: null,
            has_disease: "No",
            disease_description: "",
            courses: userObj.courses,
            semester: userObj.semester,
            status: userObj.status,
            image: null
          }
        }

        // Mask CNIC for security in response
        if (decryptedUser.cnic && decryptedUser.cnic.length >= 4) {
          decryptedUser.cnic_display = `****-****-${decryptedUser.cnic.slice(-4)}`
          decryptedUser.cnic = decryptedUser.cnic_display // Replace full CNIC with masked version
        }

        decryptedUser.allowedPages = userObj.allowed_pages || null;
        return res.status(200).json({
          message: `${stakeholder.charAt(0).toUpperCase() + stakeholder.slice(1)} login successful`,
          user: decryptedUser,
        })
      } else if (stakeholder === "hr") {
        if (!email || !password) {
          return res.status(400).json({ message: "Email and password are required for HR login" })
        }

        console.log("🔍 Authenticating HR user...")

        // Find HR user by email
        const hr = await HrUser.findOne({ where: { email } })
        if (!hr) {
          return res.status(401).json({ message: "Invalid HR email or password" })
        }

        // Verify password using the instance method
        const isPasswordValid = hr.verifyPassword(password)
        if (!isPasswordValid) {
          return res.status(401).json({ message: "Invalid HR email or password" })
        }

        console.log("✅ HR authentication successful")

        return res.status(200).json({
          message: "HR login successful",
          user: {
            id: hr.id,
            role: "hr",
            email: hr.email,
            allowedPages: hr.allowed_pages || null,
          },
        })
      } else if (stakeholder === "superadmin") {
        if (!password) {
          return res.status(400).json({ message: "Password is required for Super Admin login" })
        }

        // Use environment variable for Super Admin password
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD
        if (password !== superAdminPassword) {
          return res.status(401).json({ message: "Invalid Super Admin password" })
        }

        console.log("✅ Super Admin authentication successful")

        return res.status(200).json({
          message: "Super Admin login successful",
          user: { role: "superadmin" },
        })
      } else {
        return res.status(400).json({ message: "Invalid stakeholder type" })
      }
    } catch (error) {
      console.error("❌ Login error:", error.stack)
      return res.status(500).json({ message: "Internal server error" })
    }
  },

  // ✅ Enhanced HR creation with password hashing
  createHr: async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" })
    }

    try {
      console.log("🔍 Checking for existing HR user...")

      // Idempotent: if the email already exists, reset its password and
      // return the existing row (so the role-creation flow can re-link).
      const existingHr = await HrUser.findOne({ where: { email } })
      if (existingHr) {
        existingHr.password = password   // beforeUpdate hook will hash it
        await existingHr.save()
        console.log(`🔄 HR account ${email} already existed — password reset.`)
        return res.status(200).json({
          message: "Existing HR account updated",
          hr: {
            id: existingHr.id,
            email: existingHr.email,
            createdAt: existingHr.createdAt,
          },
        })
      }

      console.log("🔐 Creating HR user with hashed password...")

      // Password will be automatically hashed by the beforeCreate hook
      const newHr = await HrUser.create({ email, password })

      console.log("✅ HR user created successfully")

      return res.status(201).json({
        message: "HR/Employer created successfully",
        hr: {
          id: newHr.id,
          email: newHr.email,
          createdAt: newHr.createdAt,
        },
      })
    } catch (error) {
      console.error("❌ Create HR error:", error.stack)
      return res.status(500).json({ message: "Failed to create HR/Employer" })
    }
  },

  // ✅ Enhanced HR deletion
  deleteHr: async (req, res) => {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    try {
      console.log(`🗑️ Deleting HR user: ${email}`)

      const hr = await HrUser.findOne({ where: { email } })
      if (!hr) {
        return res.status(404).json({ message: "HR/Employer not found" })
      }

      await hr.destroy()

      console.log("✅ HR user deleted successfully")

      return res.status(200).json({ message: "HR/Employer deleted successfully" })
    } catch (error) {
      console.error("❌ Delete HR error:", error.stack)
      return res.status(500).json({ message: "Failed to delete HR/Employer" })
    }
  },

  // ✅ Enhanced HR list retrieval — excludes HR rows linked to a custom role
  // because those represent "role logins" managed from the Roles page, not
  // real HR accounts.
  getHrList: async (req, res) => {
    try {
      console.log("📋 Fetching HR users list (excluding role logins)…")

      // Use a raw where that works on both MySQL/Postgres and SQLite.
      // (Sequelize Op.is / null comparison sometimes misbehaves on SQLite.)
      const { Op } = await import("sequelize");
      const hrList = await HrUser.findAll({
        attributes: ["id", "email", "createdAt", "custom_role_id"],
        where: {
          [Op.or]: [
            { custom_role_id: null },
            { custom_role_id: { [Op.eq]: null } },
          ],
        },
        order: [["createdAt", "DESC"]],
      })

      // Belt-and-braces filter in JS too, in case the DB returned 0/"" instead of null.
      const realHr = hrList.filter((hr) => !hr.custom_role_id);

      console.log(`✅ Found ${realHr.length} HR users (filtered out ${hrList.length - realHr.length} role login(s))`)

      return res.status(200).json({
        hrList: realHr.map((hr) => ({
          id: hr.id,
          email: hr.email,
          createdAt: hr.createdAt,
        })),
      })
    } catch (error) {
      console.error("❌ Get HR list error:", error.stack)
      return res.status(500).json({ message: "Failed to fetch HR list" })
    }
  },

  // ✅ Enhanced user profile with decryption
  getUserProfile: async (req, res) => {
    const { id } = req.params

    try {
      console.log(`🔍 Fetching user profile for ID: ${id}`)

      const users = await sequelize.query("SELECT * FROM users WHERE id = :id", {
        replacements: { id },
        type: QueryTypes.SELECT,
      })

      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" })
      }

      const user = users[0]

      console.log("🔓 Decrypting user data...")

      // Decrypt sensitive data for response
      const decryptedUser = {
        id: user.id,
        employee_id: user.employee_id,
        registration_date: user.registration_date,
        joining_date: user.joining_date,
        post_applied_for: user.post_applied_for,
        full_name: user.full_name,
        gender: user.gender,
        cnic: decrypt(user.cnic) || user.cnic,
        dob: user.dob,
        permanent_address: decrypt(user.permanent_address) || user.permanent_address,
        contact_number: decrypt(user.contact_number) || user.contact_number,
        email: decrypt(user.email) || user.email,
        degree: user.degree,
        institute: user.institute,
        grade: user.grade,
        year: user.year,
        current_study: user.current_study,
        teaching_subjects: user.teaching_subjects,
        teaching_institute: user.teaching_institute,
        teaching_contact: user.teaching_contact ? decrypt(user.teaching_contact) : null,
        position: user.position,
        organization: user.organization,
        skills: user.skills,
        description: user.description,
        in_time: user.in_time,
        out_time: user.out_time,
        Salary_Cap: user.Salary_Cap,
        role: "employee",
        guardian_phone: decrypt(user.guardian_phone) || user.guardian_phone,
        reference_name: user.reference_name,
        reference_contact: user.reference_contact ? decrypt(user.reference_contact) : null,
        has_disease: user.has_disease,
        disease_description: user.disease_description,
      }

      // Handle image conversion
      let imageBase64 = null
      if (user.image) {
        imageBase64 = Buffer.from(user.image).toString("base64")
        decryptedUser.image = `data:image/jpeg;base64,${imageBase64}`
      } else {
        decryptedUser.image = null
      }

      // Mask CNIC for security
      if (decryptedUser.cnic && decryptedUser.cnic.length >= 4) {
        decryptedUser.cnic_display = `****-****-${decryptedUser.cnic.slice(-4)}`
        decryptedUser.cnic = decryptedUser.cnic_display
      }

      console.log("✅ User profile retrieved and decrypted successfully")

      return res.status(200).json({
        user: decryptedUser,
      })
    } catch (error) {
      console.error("❌ Get profile error:", error.stack)
      return res.status(500).json({ message: "Internal server error" })
    }
  },

  // ✅ Password change for HR users
  changeHrPassword: async (req, res) => {
    const { email, currentPassword, newPassword } = req.body

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "Email, current password, and new password are required" })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters long" })
    }

    try {
      console.log(`🔄 Changing password for HR user: ${email}`)

      const hr = await HrUser.findOne({ where: { email } })
      if (!hr) {
        return res.status(404).json({ message: "HR user not found" })
      }

      // Verify current password
      const isCurrentPasswordValid = hr.verifyPassword(currentPassword)
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" })
      }

      // Update password (will be automatically hashed by beforeUpdate hook)
      await hr.update({ password: newPassword })

      console.log("✅ HR password changed successfully")

      return res.status(200).json({ message: "Password changed successfully" })
    } catch (error) {
      console.error("❌ Change password error:", error.stack)
      return res.status(500).json({ message: "Failed to change password" })
    }
  },
}
