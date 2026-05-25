import Payroll from "../models/payrollModel.js"
import crypto from "crypto"

// 🔐 Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = "aes-256-cbc"

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error("❌ ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
  process.exit(1)
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex")

// ✅ Encryption/Decryption functions
const encrypt = (text) => {
  if (!text) return null
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv)
    let encrypted = cipher.update(text.toString(), "utf8", "hex")
    encrypted += cipher.final("hex")
    return iv.toString("hex") + ":" + encrypted
  } catch (error) {
    console.error("❌ Encryption error:", error.message)
    return null
  }
}

const decrypt = (text) => {
  if (!text || typeof text !== "string") return null
  try {
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
    return text
  }
}

// ✅ Get all payrolls with decrypted data
export const getPayrolls = async (req, res) => {
  try {
    console.log("🔍 Fetching all payrolls...")
    const payrolls = await Payroll.findAll()

    // Decrypt sensitive data for display
    const decryptedPayrolls = payrolls.map((payroll) => {
      const data = payroll.toJSON()
      return {
        ...data,
        employee_id: decrypt(data.employee_id) || data.employee_id,
        full_name: decrypt(data.full_name) || data.full_name,
        hourly_wage: Number.parseFloat(decrypt(data.hourly_wage)) || 0,
        daily_allowance_rate: Number.parseFloat(decrypt(data.daily_allowance_rate)) || 0,
        daily_allowance_total: Number.parseFloat(decrypt(data.daily_allowance_total)) || 0,
        hourly_salary: Number.parseFloat(decrypt(data.hourly_salary)) || 0,
        gross_salary: Number.parseFloat(decrypt(data.gross_salary)) || 0,
        Salary_Cap: Number.parseFloat(decrypt(data.Salary_Cap)) || 0,
      }
    })

    console.log(`✅ Successfully fetched ${decryptedPayrolls.length} payroll records`)
    res.status(200).json(decryptedPayrolls)
  } catch (error) {
    console.error("❌ Error fetching payrolls:", error.stack)
    res.status(500).json({ message: "Failed to fetch payrolls", error: error.message })
  }
}

// ✅ Create payrolls with encrypted sensitive data
export const createPayrolls = async (req, res) => {
  try {
    console.log("📝 Creating new payroll records...")
    const payrollsData = Array.isArray(req.body) ? req.body : [req.body]

    // Validate required fields
    for (const payroll of payrollsData) {
      if (!payroll.employee_id || !payroll.full_name || !payroll.month) {
        return res.status(400).json({
          message: "Employee ID, full name, and month are required for each payroll record",
        })
      }
    }

    // Encrypt sensitive data before storing
    const encryptedPayrollsData = payrollsData.map((payroll) => ({
      ...payroll,
      employee_id: encrypt(payroll.employee_id),
      full_name: encrypt(payroll.full_name),
      hourly_wage: encrypt(payroll.hourly_wage?.toString() || "0"),
      daily_allowance_rate: encrypt(payroll.daily_allowance_rate?.toString() || "0"),
      daily_allowance_total: encrypt(payroll.daily_allowance_total?.toString() || "0"),
      hourly_salary: encrypt(payroll.hourly_salary?.toString() || "0"),
      gross_salary: encrypt(payroll.gross_salary?.toString() || "0"),
      Salary_Cap: encrypt(payroll.Salary_Cap?.toString() || "0"),
    }))

    console.log("🔐 Encrypting sensitive payroll data...")
    const createdPayrolls = await Payroll.bulkCreate(encryptedPayrollsData, { validate: true })

    // Return decrypted data for response
    const responsePayrolls = createdPayrolls.map((payroll) => {
      const data = payroll.toJSON()
      return {
        ...data,
        employee_id: decrypt(data.employee_id) || data.employee_id,
        full_name: decrypt(data.full_name) || data.full_name,
        hourly_wage: Number.parseFloat(decrypt(data.hourly_wage)) || 0,
        daily_allowance_rate: Number.parseFloat(decrypt(data.daily_allowance_rate)) || 0,
        daily_allowance_total: Number.parseFloat(decrypt(data.daily_allowance_total)) || 0,
        hourly_salary: Number.parseFloat(decrypt(data.hourly_salary)) || 0,
        gross_salary: Number.parseFloat(decrypt(data.gross_salary)) || 0,
        Salary_Cap: Number.parseFloat(decrypt(data.Salary_Cap)) || 0,
      }
    })

    console.log(`✅ Successfully created ${responsePayrolls.length} payroll records with encryption`)
    res.status(201).json(responsePayrolls)
  } catch (error) {
    console.error("❌ Error creating payrolls:", error.stack)
    res.status(400).json({ message: "Failed to create payrolls", error: error.message })
  }
}

// ✅ Update payroll with encryption handling
export const updatePayroll = async (req, res) => {
  try {
    const { id } = req.params

    if (!id || id === "undefined") {
      return res.status(400).json({ message: "Invalid payroll ID" })
    }

    console.log(`🔄 Updating payroll with ID: ${id}`)

    const payroll = await Payroll.findByPk(id)
    if (!payroll) {
      return res.status(404).json({ message: "Payroll not found" })
    }

    // Encrypt sensitive data in the update
    const updateData = { ...req.body }
    if (updateData.employee_id) updateData.employee_id = encrypt(updateData.employee_id)
    if (updateData.full_name) updateData.full_name = encrypt(updateData.full_name)
    if (updateData.hourly_wage) updateData.hourly_wage = encrypt(updateData.hourly_wage.toString())
    if (updateData.daily_allowance_rate)
      updateData.daily_allowance_rate = encrypt(updateData.daily_allowance_rate.toString())
    if (updateData.daily_allowance_total)
      updateData.daily_allowance_total = encrypt(updateData.daily_allowance_total.toString())
    if (updateData.hourly_salary) updateData.hourly_salary = encrypt(updateData.hourly_salary.toString())
    if (updateData.gross_salary) updateData.gross_salary = encrypt(updateData.gross_salary.toString())
    if (updateData.Salary_Cap) updateData.Salary_Cap = encrypt(updateData.Salary_Cap.toString())

    console.log("🔐 Encrypting updated payroll data...")
    await payroll.update(updateData, { fields: Object.keys(updateData) })

    // Return decrypted data for response
    const updatedData = payroll.toJSON()
    const decryptedResponse = {
      ...updatedData,
      employee_id: decrypt(updatedData.employee_id) || updatedData.employee_id,
      full_name: decrypt(updatedData.full_name) || updatedData.full_name,
      hourly_wage: Number.parseFloat(decrypt(updatedData.hourly_wage)) || 0,
      daily_allowance_rate: Number.parseFloat(decrypt(updatedData.daily_allowance_rate)) || 0,
      daily_allowance_total: Number.parseFloat(decrypt(updatedData.daily_allowance_total)) || 0,
      hourly_salary: Number.parseFloat(decrypt(updatedData.hourly_salary)) || 0,
      gross_salary: Number.parseFloat(decrypt(updatedData.gross_salary)) || 0,
      Salary_Cap: Number.parseFloat(decrypt(updatedData.Salary_Cap)) || 0,
    }

    console.log("✅ Payroll updated successfully with encryption")
    res.status(200).json(decryptedResponse)
  } catch (error) {
    console.error("❌ Error updating payroll:", error.stack)
    res.status(400).json({ message: "Failed to update payroll", error: error.message })
  }
}

// ✅ Delete single payroll
export const deletePayroll = async (req, res) => {
  try {
    const { id } = req.params
    console.log(`🗑️ Deleting payroll with ID: ${id}`)

    const payroll = await Payroll.findByPk(id)

    if (!payroll) {
      return res.status(404).json({ message: "Payroll not found" })
    }

    await payroll.destroy()

    console.log("✅ Payroll deleted successfully")
    res.status(200).json({ message: "Payroll deleted successfully" })
  } catch (error) {
    console.error("❌ Error deleting payroll:", error.stack)
    res.status(500).json({ message: "Failed to delete payroll", error: error.message })
  }
}

// ✅ Delete all payrolls
export const deleteAllPayrolls = async (req, res) => {
  try {
    console.log("🗑️ Deleting all payroll records...")

    const deletedCount = await Payroll.destroy({ where: {}, truncate: true })

    console.log(`✅ Successfully deleted all payroll records`)
    res.status(200).json({
      message: "All payrolls deleted successfully",
      deletedCount: deletedCount,
    })
  } catch (error) {
    console.error("❌ Error deleting all payrolls:", error.stack)
    res.status(500).json({ message: "Failed to delete all payrolls", error: error.message })
  }
}
