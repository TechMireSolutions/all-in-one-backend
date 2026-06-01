// backend/controllers/contactController.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sequelize } from "../DB/DBconnection.js";
import {
  Contact,
  ContactPhoneNumber,
  ContactEmail,
  ContactAddress,
  ContactSocial,
  ContactEmergency,
  ContactEducation,
  ContactExperience,
  ContactOffice,
  ContactHealth,
  MergeLog,
} from "../models/contactModel.js";

// Standard include block used by every read endpoint. Centralized here so we
// don't have to repeat the 9 child tables in every query.
const FULL_INCLUDES = [
  { model: ContactPhoneNumber, as: "phoneNumbers" },
  { model: ContactEmail,       as: "emails"       },
  { model: ContactAddress,     as: "addresses"    },
  { model: ContactSocial,      as: "socials"      },
  { model: ContactEmergency,   as: "emergencies"  },
  { model: ContactEducation,   as: "educations"   },
  { model: ContactExperience,  as: "experiences"  },
  { model: ContactOffice,      as: "offices"      },
  { model: ContactHealth,      as: "healths"      },
];
import { findDuplicates, calculateJaroWinkler } from "../services/duplicateService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Convert string to Title Case
const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper: Suggest name standardizations (e.g. spelling variations)
const getNameSuggestions = (firstName, lastName) => {
  const suggestions = [];
  const full = `${firstName || ""} ${lastName || ""}`.trim().toLowerCase();

  // Flag variations of Muhammad
  const mMatches = ["mohammad", "mohamad", "muhamad", "mohamed", "mouhamad", "m. ", "m "];
  let containsM = false;
  for (const prefix of mMatches) {
    if (full.startsWith(prefix)) {
      containsM = true;
      break;
    }
  }

  if (containsM && !full.startsWith("muhammad")) {
    suggestions.push({
      field: "first_name",
      original: firstName,
      suggested: firstName.replace(/^(Mohammad|Mohamad|Muhamad|Mohamed|Mouhamad|M\.\s*|M\s+)/i, "Muhammad"),
      reason: "Standardize common variant to 'Muhammad'",
    });
  }

  return suggestions;
};

// Helper: Multi-step CNIC validation
const validateCnicDetailed = (cnic, gender) => {
  if (!cnic) return { valid: false, message: "CNIC is required." };

  // 1. Regex validation for XXXXX-XXXXXXX-X
  const regex = /^\d{5}-\d{7}-\d{1}$/;
  if (!regex.test(cnic)) {
    return { valid: false, message: "CNIC format must be XXXXX-XXXXXXX-X" };
  }

  const digits = cnic.replace(/\D/g, "");

  // 2. Gender parity check: last digit is even for female, odd for male
  const lastDigit = parseInt(digits[12], 10);
  if (gender === "Male" && lastDigit % 2 === 0) {
    return { valid: false, message: "Last digit of CNIC for 'Male' must be odd." };
  }
  if (gender === "Female" && lastDigit % 2 !== 1 && lastDigit % 2 !== 0 && lastDigit !== 0) {
    // Note: historically females get even numbers (0, 2, 4, 6, 8)
    if (lastDigit % 2 !== 0) {
      return { valid: false, message: "Last digit of CNIC for 'Female' must be even." };
    }
  }

  // 3. Luhn-based mod-10 check on the 13 digits
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let val = parseInt(digits[i], 10);
    if (shouldDouble) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
    shouldDouble = !shouldDouble;
  }
  
  if (sum % 10 !== 0) {
    return { valid: false, message: "CNIC failed Luhn checksum algorithm validation." };
  }

  return { valid: true };
};

// Helper: E.164 phone verification
const validateE164 = (phone) => {
  const regex = /^\+?[1-9]\d{1,14}$/;
  return regex.test(phone);
};

// Helper: URL matching check for platforms
const validateSocialUrl = (platform, url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    
    if (platform === "Facebook" && !host.includes("facebook.com") && !host.includes("fb.com")) return false;
    if (platform === "Twitter" && !host.includes("twitter.com") && !host.includes("x.com")) return false;
    if (platform === "Instagram" && !host.includes("instagram.com")) return false;
    if (platform === "LinkedIn" && !host.includes("linkedin.com")) return false;
    
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * GET all contacts with relations
 */
export const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.findAll({
      include: FULL_INCLUDES,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Failed to fetch contacts", error: error.message });
  }
};

/**
 * GET contact by ID
 */
export const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findByPk(req.params.id, { include: FULL_INCLUDES });

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json(contact);
  } catch (error) {
    console.error("Error fetching contact by ID:", error);
    res.status(500).json({ message: "Failed to fetch contact", error: error.message });
  }
};

/**
 * CREATE a new contact
 */
export const createContact = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    let {
      first_name,
      last_name,
      cnic,
      gender,
      dob,
      is_syed,
      phoneNumbers,
      emails,
      addresses,
      socials,
      emergencies,
      educations,
      experiences,
      offices,
      healths,
    } = req.body;

    is_syed = is_syed === true || is_syed === "true";

    // 1. Inputs validation
    if (!first_name || !last_name || !gender || !dob) {
      await transaction.rollback();
      return res.status(400).json({ message: "Missing core fields (First Name, Last Name, Gender, DOB)" });
    }

    // 2. Name Standardization: Trim & Title Case
    let cleanFirstName = toTitleCase(first_name.trim());
    let cleanLastName = toTitleCase(last_name.trim());

    // 3. Syed Title Prefix Generator
    if (is_syed) {
      if (gender === "Male" && !cleanFirstName.startsWith("Syed ")) {
        cleanFirstName = `Syed ${cleanFirstName}`;
      } else if (gender === "Female" && !cleanFirstName.startsWith("Syeda ")) {
        cleanFirstName = `Syeda ${cleanFirstName}`;
      }
    }

    // Name spelling variation check & suggestions
    const nameSuggestions = getNameSuggestions(cleanFirstName, cleanLastName);

    // 4. CNIC Validation
    const cnicCheck = validateCnicDetailed(cnic, gender);
    if (!cnicCheck.valid) {
      await transaction.rollback();
      return res.status(400).json({ message: cnicCheck.message });
    }

    // Check unique CNIC — match by digits only so formats with/without dashes
    // are treated as the same record.
    const cnicDigits = String(cnic).replace(/\D/g, "");
    const allContacts = await Contact.findAll({ attributes: ["id", "cnic"] });
    const existingCnic = allContacts.find((c) => String(c.cnic || "").replace(/\D/g, "") === cnicDigits);
    if (existingCnic) {
      await transaction.rollback();
      return res.status(400).json({ message: `A contact with CNIC ${cnic} already exists (id=${existingCnic.id}).` });
    }

    // Parse all sub-arrays (multipart often sends them as JSON strings).
    const parseArr = (v) => {
      if (typeof v === "string") {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
      }
      return Array.isArray(v) ? v : [];
    };
    const parsedPhones       = parseArr(phoneNumbers);
    const parsedEmails       = parseArr(emails);
    const parsedAddresses    = parseArr(addresses);
    const parsedSocials      = parseArr(socials);
    const parsedEmergencies  = parseArr(emergencies);
    const parsedEducations   = parseArr(educations);
    const parsedExperiences  = parseArr(experiences);
    const parsedOffices      = parseArr(offices);
    const parsedHealths      = parseArr(healths);

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    // Validate Sub-Models
    for (const phone of parsedPhones) {
      if (!validateE164(phone.phone_number)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Phone number ${phone.phone_number} must match E.164 international format.` });
      }
    }

    for (const email of parsedEmails) {
      if (!emailRegex.test(email.email_address)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Email address ${email.email_address} is invalid.` });
      }
    }

    for (const social of parsedSocials) {
      if (!validateSocialUrl(social.platform, social.url)) {
        await transaction.rollback();
        return res.status(400).json({ message: `URL for platform ${social.platform} is malformed or does not match.` });
      }
    }

    // Emergency: name + relation + phone (E.164) required; email optional but if present must be valid.
    for (const em of parsedEmergencies) {
      if (!em.name || !em.relation || !em.phone_number) {
        await transaction.rollback();
        return res.status(400).json({ message: "Each emergency contact needs a name, relation and phone." });
      }
      if (!validateE164(em.phone_number)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Emergency phone ${em.phone_number} must be E.164.` });
      }
      if (em.email && !emailRegex.test(em.email)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Emergency email ${em.email} is invalid.` });
      }
    }

    // Education: degree + institute required; end_year ≥ start_year.
    for (const ed of parsedEducations) {
      if (!ed.degree || !ed.institute) {
        await transaction.rollback();
        return res.status(400).json({ message: "Each education entry needs a degree and institute." });
      }
      if (ed.start_year && ed.end_year && Number(ed.end_year) < Number(ed.start_year)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Education end_year (${ed.end_year}) cannot be before start_year (${ed.start_year}).` });
      }
    }

    // Experience: organization + post required; end_date ≥ start_date.
    for (const xp of parsedExperiences) {
      if (!xp.organization || !xp.post) {
        await transaction.rollback();
        return res.status(400).json({ message: "Each experience entry needs an organization and post." });
      }
      if (xp.start_date && xp.end_date && new Date(xp.end_date) < new Date(xp.start_date)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Experience end_date cannot be before start_date.` });
      }
    }

    // Office: employee_id required and globally unique.
    for (const off of parsedOffices) {
      if (!off.employee_id) {
        await transaction.rollback();
        return res.status(400).json({ message: "Each office record needs an employee_id." });
      }
      const dup = await ContactOffice.findOne({ where: { employee_id: off.employee_id } });
      if (dup) {
        await transaction.rollback();
        return res.status(400).json({ message: `Employee ID "${off.employee_id}" is already in use.` });
      }
    }

    // Health: disease required.
    for (const h of parsedHealths) {
      if (!h.disease) {
        await transaction.rollback();
        return res.status(400).json({ message: "Each health entry needs a disease name." });
      }
    }

    // 5. Profile picture path
    let profile_picture = null;
    if (req.file) {
      // Save path
      const uploadDir = path.join(__dirname, "..", "uploads", "contacts");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      profile_picture = `/uploads/contacts/${filename}`;
    }

    // 6. Save Contact Core Record (all relational data lives in child tables now)
    const newContact = await Contact.create({
      first_name: cleanFirstName,
      last_name:  cleanLastName,
      cnic,
      gender,
      dob: new Date(dob),
      profile_picture,
      is_syed,
    }, { transaction });

    // Save sub-records
    if (parsedPhones.length > 0) {
      await ContactPhoneNumber.bulkCreate(
        parsedPhones.map((p) => ({ ...p, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedEmails.length > 0) {
      await ContactEmail.bulkCreate(
        parsedEmails.map((e) => ({ ...e, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedAddresses.length > 0) {
      await ContactAddress.bulkCreate(
        parsedAddresses.map((addr) => ({ ...addr, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedSocials.length > 0) {
      await ContactSocial.bulkCreate(
        parsedSocials.map((s) => ({ ...s, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedEmergencies.length > 0) {
      await ContactEmergency.bulkCreate(
        parsedEmergencies.map((em) => ({ ...em, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedEducations.length > 0) {
      await ContactEducation.bulkCreate(
        parsedEducations.map((ed) => ({ ...ed, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedExperiences.length > 0) {
      await ContactExperience.bulkCreate(
        parsedExperiences.map((xp) => ({ ...xp, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedOffices.length > 0) {
      await ContactOffice.bulkCreate(
        parsedOffices.map((off) => ({ ...off, contactId: newContact.id })),
        { transaction }
      );
    }

    if (parsedHealths.length > 0) {
      await ContactHealth.bulkCreate(
        parsedHealths.map((h) => ({ ...h, contactId: newContact.id })),
        { transaction }
      );
    }

    await transaction.commit();

    // Fetch full saved contact with every child relation populated
    const fullContact = await Contact.findByPk(newContact.id, { include: FULL_INCLUDES });

    res.status(201).json({
      message: "Contact created successfully",
      contact: fullContact,
      suggestions: nameSuggestions,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating contact:", error);
    res.status(500).json({ message: "Failed to create contact", error: error.message });
  }
};

/**
 * UPDATE contact by ID
 */
export const updateContact = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const contact = await Contact.findByPk(req.params.id, { transaction });
    if (!contact) {
      await transaction.rollback();
      return res.status(404).json({ message: "Contact not found" });
    }

    let {
      first_name,
      last_name,
      cnic,
      gender,
      dob,
      is_syed,
      phoneNumbers,
      emails,
      addresses,
      socials,
      emergencies,
      educations,
      experiences,
      offices,
      healths,
    } = req.body;

    is_syed = is_syed !== undefined ? (is_syed === true || is_syed === "true") : contact.is_syed;
    const finalGender = gender || contact.gender;
    const emailRegexUpd = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const parseArrUpd = (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === "string") {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
      }
      return Array.isArray(v) ? v : [];
    };

    // Normalize and Title Case Names
    let cleanFirstName = first_name ? toTitleCase(first_name.trim()) : contact.first_name;
    let cleanLastName = last_name ? toTitleCase(last_name.trim()) : contact.last_name;

    // Prefix Syndications
    if (is_syed) {
      if (finalGender === "Male" && !cleanFirstName.startsWith("Syed ")) {
        cleanFirstName = `Syed ${cleanFirstName}`;
      } else if (finalGender === "Female" && !cleanFirstName.startsWith("Syeda ")) {
        cleanFirstName = `Syeda ${cleanFirstName}`;
      }
    }

    const nameSuggestions = getNameSuggestions(cleanFirstName, cleanLastName);

    // Validate CNIC changes
    if (cnic && cnic !== contact.cnic) {
      const cnicCheck = validateCnicDetailed(cnic, finalGender);
      if (!cnicCheck.valid) {
        await transaction.rollback();
        return res.status(400).json({ message: cnicCheck.message });
      }

      const existingCnic = await Contact.findOne({ where: { cnic } });
      if (existingCnic && existingCnic.id !== contact.id) {
        await transaction.rollback();
        return res.status(400).json({ message: `A contact with CNIC ${cnic} already exists.` });
      }
    }

    // Profile picture upload
    let profile_picture = contact.profile_picture;
    if (req.file) {
      const uploadDir = path.join(__dirname, "..", "uploads", "contacts");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      profile_picture = `/uploads/contacts/${filename}`;
    }

    // Update core (relational data lives in child tables now)
    await contact.update({
      first_name: cleanFirstName,
      last_name:  cleanLastName,
      cnic:       cnic || contact.cnic,
      gender:     finalGender,
      dob:        dob ? new Date(dob) : contact.dob,
      profile_picture,
      is_syed,
    }, { transaction });

    // Replace relational lists
    if (phoneNumbers) {
      const parsedPhones = typeof phoneNumbers === "string" ? JSON.parse(phoneNumbers) : phoneNumbers;
      for (const phone of parsedPhones) {
        if (!validateE164(phone.phone_number)) {
          await transaction.rollback();
          return res.status(400).json({ message: `Phone number ${phone.phone_number} must match E.164 international format.` });
        }
      }
      await ContactPhoneNumber.destroy({ where: { contactId: contact.id }, transaction });
      await ContactPhoneNumber.bulkCreate(
        parsedPhones.map((p) => ({ ...p, contactId: contact.id })),
        { transaction }
      );
    }

    if (emails) {
      const parsedEmails = typeof emails === "string" ? JSON.parse(emails) : emails;
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      for (const email of parsedEmails) {
        if (!emailRegex.test(email.email_address)) {
          await transaction.rollback();
          return res.status(400).json({ message: `Email address ${email.email_address} is invalid.` });
        }
      }
      await ContactEmail.destroy({ where: { contactId: contact.id }, transaction });
      await ContactEmail.bulkCreate(
        parsedEmails.map((e) => ({ ...e, contactId: contact.id })),
        { transaction }
      );
    }

    if (addresses) {
      const parsedAddresses = typeof addresses === "string" ? JSON.parse(addresses) : addresses;
      await ContactAddress.destroy({ where: { contactId: contact.id }, transaction });
      await ContactAddress.bulkCreate(
        parsedAddresses.map((addr) => ({ ...addr, contactId: contact.id })),
        { transaction }
      );
    }

    if (socials) {
      const parsedSocials = typeof socials === "string" ? JSON.parse(socials) : socials;
      for (const social of parsedSocials) {
        if (!validateSocialUrl(social.platform, social.url)) {
          await transaction.rollback();
          return res.status(400).json({ message: `URL for platform ${social.platform} is malformed or does not match.` });
        }
      }
      await ContactSocial.destroy({ where: { contactId: contact.id }, transaction });
      await ContactSocial.bulkCreate(
        parsedSocials.map((s) => ({ ...s, contactId: contact.id })),
        { transaction }
      );
    }

    // ── Emergency contacts (full destroy + bulkCreate, like phones/emails) ──
    const upEmergencies = parseArrUpd(emergencies);
    if (upEmergencies !== undefined) {
      for (const em of upEmergencies) {
        if (!em.name || !em.relation || !em.phone_number) {
          await transaction.rollback();
          return res.status(400).json({ message: "Each emergency contact needs a name, relation and phone." });
        }
        if (!validateE164(em.phone_number)) {
          await transaction.rollback();
          return res.status(400).json({ message: `Emergency phone ${em.phone_number} must be E.164.` });
        }
        if (em.email && !emailRegexUpd.test(em.email)) {
          await transaction.rollback();
          return res.status(400).json({ message: `Emergency email ${em.email} is invalid.` });
        }
      }
      await ContactEmergency.destroy({ where: { contactId: contact.id }, transaction });
      if (upEmergencies.length) {
        await ContactEmergency.bulkCreate(upEmergencies.map((em) => ({ ...em, contactId: contact.id })), { transaction });
      }
    }

    // ── Education ──
    const upEducations = parseArrUpd(educations);
    if (upEducations !== undefined) {
      for (const ed of upEducations) {
        if (!ed.degree || !ed.institute) {
          await transaction.rollback();
          return res.status(400).json({ message: "Each education entry needs a degree and institute." });
        }
        if (ed.start_year && ed.end_year && Number(ed.end_year) < Number(ed.start_year)) {
          await transaction.rollback();
          return res.status(400).json({ message: `Education end_year cannot be before start_year.` });
        }
      }
      await ContactEducation.destroy({ where: { contactId: contact.id }, transaction });
      if (upEducations.length) {
        await ContactEducation.bulkCreate(upEducations.map((ed) => ({ ...ed, contactId: contact.id })), { transaction });
      }
    }

    // ── Experience ──
    const upExperiences = parseArrUpd(experiences);
    if (upExperiences !== undefined) {
      for (const xp of upExperiences) {
        if (!xp.organization || !xp.post) {
          await transaction.rollback();
          return res.status(400).json({ message: "Each experience entry needs an organization and post." });
        }
        if (xp.start_date && xp.end_date && new Date(xp.end_date) < new Date(xp.start_date)) {
          await transaction.rollback();
          return res.status(400).json({ message: `Experience end_date cannot be before start_date.` });
        }
      }
      await ContactExperience.destroy({ where: { contactId: contact.id }, transaction });
      if (upExperiences.length) {
        await ContactExperience.bulkCreate(upExperiences.map((xp) => ({ ...xp, contactId: contact.id })), { transaction });
      }
    }

    // ── Office ──
    const upOffices = parseArrUpd(offices);
    if (upOffices !== undefined) {
      for (const off of upOffices) {
        if (!off.employee_id) {
          await transaction.rollback();
          return res.status(400).json({ message: "Each office record needs an employee_id." });
        }
        // employee_id must be unique across all contacts (excluding this contact's own previous office rows)
        const dup = await ContactOffice.findOne({ where: { employee_id: off.employee_id } });
        if (dup && dup.contactId !== contact.id) {
          await transaction.rollback();
          return res.status(400).json({ message: `Employee ID "${off.employee_id}" is already used by another contact.` });
        }
      }
      await ContactOffice.destroy({ where: { contactId: contact.id }, transaction });
      if (upOffices.length) {
        await ContactOffice.bulkCreate(upOffices.map((off) => ({ ...off, contactId: contact.id })), { transaction });
      }
    }

    // ── Health ──
    const upHealths = parseArrUpd(healths);
    if (upHealths !== undefined) {
      for (const h of upHealths) {
        if (!h.disease) {
          await transaction.rollback();
          return res.status(400).json({ message: "Each health entry needs a disease name." });
        }
      }
      await ContactHealth.destroy({ where: { contactId: contact.id }, transaction });
      if (upHealths.length) {
        await ContactHealth.bulkCreate(upHealths.map((h) => ({ ...h, contactId: contact.id })), { transaction });
      }
    }

    await transaction.commit();

    const fullContact = await Contact.findByPk(contact.id, { include: FULL_INCLUDES });

    res.status(200).json({
      message: "Contact updated successfully",
      contact: fullContact,
      suggestions: nameSuggestions,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating contact:", error);
    res.status(500).json({ message: "Failed to update contact", error: error.message });
  }
};

/**
 * DELETE contact by ID
 */
export const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByPk(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await contact.destroy();
    res.status(200).json({ message: "Contact deleted successfully" });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ message: "Failed to delete contact", error: error.message });
  }
};

/**
 * Run Background Suspected Duplicates Check
 */
export const checkDuplicates = async (req, res) => {
  try {
    const { id } = req.query;

    const allContacts = await Contact.findAll({ include: FULL_INCLUDES });

    if (id) {
      const candidate = await Contact.findByPk(id, { include: FULL_INCLUDES });

      if (!candidate) {
        return res.status(404).json({ message: "Candidate contact not found." });
      }

      const dupes = await findDuplicates(candidate, allContacts);
      return res.status(200).json(dupes);
    } else {
      // Calculate duplicates map for all contacts
      const duplicatesMap = [];
      const checkedIds = new Set();

      for (const contact of allContacts) {
        if (checkedIds.has(contact.id)) continue;
        const dupes = await findDuplicates(contact, allContacts);
        if (dupes.length > 0) {
          duplicatesMap.push({
            contact,
            possibleDuplicates: dupes,
          });
          dupes.forEach(d => checkedIds.add(d.contact.id));
        }
        checkedIds.add(contact.id);
      }

      return res.status(200).json(duplicatesMap);
    }
  } catch (error) {
    console.error("Error checking duplicates:", error);
    res.status(500).json({ message: "Failed to check duplicates", error: error.message });
  }
};

/**
 * MERGE Source Record into Master/Target Record
 */
export const mergeContacts = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { masterId, sourceId, conflictChoices } = req.body;

    if (!masterId || !sourceId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Master ID and Source ID are required." });
    }

    const master = await Contact.findByPk(masterId, { include: FULL_INCLUDES, transaction });
    const source = await Contact.findByPk(sourceId, { include: FULL_INCLUDES, transaction });

    if (!master || !source) {
      await transaction.rollback();
      return res.status(404).json({ message: "Master or Source contact record not found." });
    }

    // Capture Pre-merge states
    const masterSnapshot = master.toJSON();
    const sourceSnapshot = source.toJSON();

    // 1. Resolve Core fields and conflicts
    const coreFields = ["first_name", "last_name", "cnic", "gender", "dob", "profile_picture", "is_syed"];
    const updatedCore = {};

    for (const field of coreFields) {
      const choice = conflictChoices ? conflictChoices[field] : null;
      if (choice === "source") {
        updatedCore[field] = source[field];
      } else if (choice === "master") {
        updatedCore[field] = master[field];
      } else {
        // Default rules: If master field is blank/null, preserve by using source value
        if (master[field] === undefined || master[field] === null || master[field] === "") {
          updatedCore[field] = source[field];
        } else {
          updatedCore[field] = master[field];
        }
      }
    }

    await master.update(updatedCore, { transaction });

    // 2. Aggregate & deduplicate multi-valued Phone numbers
    const existingPhoneNumbers = master.phoneNumbers.map(p => p.phone_number);
    for (const phone of source.phoneNumbers) {
      if (!existingPhoneNumbers.includes(phone.phone_number)) {
        await ContactPhoneNumber.create(
          {
            contactId: master.id,
            phone_number: phone.phone_number,
            phone_type: phone.phone_type,
          },
          { transaction }
        );
      }
    }

    // 3. Aggregate & deduplicate emails
    const existingEmails = master.emails.map(e => e.email_address.toLowerCase());
    for (const email of source.emails) {
      if (!existingEmails.includes(email.email_address.toLowerCase())) {
        await ContactEmail.create(
          {
            contactId: master.id,
            email_address: email.email_address,
            email_type: email.email_type,
          },
          { transaction }
        );
      }
    }

    // 4. Aggregate & deduplicate addresses
    const getAddrKey = (a) => `${a.address_line1}|${a.city}|${a.state}`.toLowerCase().replace(/\s+/g, "");
    const existingAddrKeys = master.addresses.map(getAddrKey);
    for (const addr of source.addresses) {
      if (!existingAddrKeys.includes(getAddrKey(addr))) {
        await ContactAddress.create(
          {
            contactId: master.id,
            address_line1: addr.address_line1,
            address_line2: addr.address_line2,
            city: addr.city,
            state: addr.state,
            country: addr.country,
            postal_code: addr.postal_code,
            address_type: addr.address_type,
          },
          { transaction }
        );
      }
    }

    // 5. Aggregate & deduplicate socials
    const existingSocialKeys = master.socials.map(s => `${s.platform}|${s.url}`.toLowerCase());
    for (const social of source.socials) {
      if (!existingSocialKeys.includes(`${social.platform}|${social.url}`.toLowerCase())) {
        await ContactSocial.create(
          {
            contactId: master.id,
            platform: social.platform,
            url: social.url,
          },
          { transaction }
        );
      }
    }

    // 6. Emergency contacts — dedupe by phone_number
    {
      const masterKeys = (master.emergencies || []).map((e) => String(e.phone_number || "").replace(/\D/g, ""));
      for (const em of (source.emergencies || [])) {
        const k = String(em.phone_number || "").replace(/\D/g, "");
        if (!masterKeys.includes(k)) {
          await ContactEmergency.create({
            contactId: master.id,
            name: em.name, relation: em.relation,
            phone_number: em.phone_number, email: em.email,
            address: em.address, is_primary: !!em.is_primary,
          }, { transaction });
        }
      }
    }

    // 7. Education — dedupe by degree + institute + end_year
    {
      const keyOf = (e) => `${e.degree}|${e.institute}|${e.end_year || ""}`.toLowerCase();
      const masterKeys = (master.educations || []).map(keyOf);
      for (const ed of (source.educations || [])) {
        if (!masterKeys.includes(keyOf(ed))) {
          await ContactEducation.create({
            contactId: master.id,
            degree: ed.degree, field_of_study: ed.field_of_study,
            institute: ed.institute, grade: ed.grade,
            start_year: ed.start_year, end_year: ed.end_year,
            is_current: !!ed.is_current,
          }, { transaction });
        }
      }
    }

    // 8. Experience — dedupe by organization + post + start_date
    {
      const keyOf = (x) => `${x.organization}|${x.post}|${x.start_date || ""}`.toLowerCase();
      const masterKeys = (master.experiences || []).map(keyOf);
      for (const xp of (source.experiences || [])) {
        if (!masterKeys.includes(keyOf(xp))) {
          await ContactExperience.create({
            contactId: master.id,
            organization: xp.organization, post: xp.post,
            experience_type: xp.experience_type,
            start_date: xp.start_date, end_date: xp.end_date,
            is_current: !!xp.is_current, responsibilities: xp.responsibilities,
          }, { transaction });
        }
      }
    }

    // 9. Office — dedupe by employee_id (globally unique).
    {
      const masterKeys = (master.offices || []).map((o) => o.employee_id);
      for (const off of (source.offices || [])) {
        if (!masterKeys.includes(off.employee_id)) {
          // Re-assign by updating the source row to point to master so we
          // don't violate the unique constraint on employee_id.
          await ContactOffice.update(
            { contactId: master.id },
            { where: { id: off.id }, transaction }
          );
        }
      }
    }

    // 10. Health — dedupe by disease (case-insensitive)
    {
      const masterKeys = (master.healths || []).map((h) => String(h.disease || "").toLowerCase());
      for (const h of (source.healths || [])) {
        if (!masterKeys.includes(String(h.disease || "").toLowerCase())) {
          await ContactHealth.create({
            contactId: master.id,
            disease: h.disease, severity: h.severity,
            diagnosed_on: h.diagnosed_on, medication: h.medication,
            notes: h.notes, is_active: h.is_active !== false,
          }, { transaction });
        }
      }
    }

    // 11. Record merge log in database
    const mergeLog = await MergeLog.create(
      {
        merged_by: req.user ? req.user.username : "System Admin",
        master_record_id: master.id,
        source_record_id: source.id,
        master_snapshot,
        source_snapshot,
        status: "Merged",
      },
      { transaction }
    );

    // 7. Delete Source contact (will cascade delete its sub-records)
    await source.destroy({ transaction });

    await transaction.commit();

    const finalMaster = await Contact.findByPk(master.id, {
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
    });

    res.status(200).json({
      message: "Contacts merged successfully.",
      master: finalMaster,
      mergeLog,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error merging contacts:", error);
    res.status(500).json({ message: "Failed to merge contacts", error: error.message });
  }
};

/**
 * UNDO / RESTORE Merged Record
 */
export const undoMerge = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { logId } = req.body;

    if (!logId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Log ID is required." });
    }

    const mergeLog = await MergeLog.findByPk(logId, { transaction });
    if (!mergeLog) {
      await transaction.rollback();
      return res.status(404).json({ message: "Merge log entry not found." });
    }

    if (mergeLog.status === "Undone") {
      await transaction.rollback();
      return res.status(400).json({ message: "This merge has already been undone." });
    }

    const masterSnapshot = mergeLog.master_snapshot;
    const sourceSnapshot = mergeLog.source_snapshot;

    // 1. Re-create the deleted source record with original UUID
    const restoredSource = await Contact.create(
      {
        id: sourceSnapshot.id,
        first_name: sourceSnapshot.first_name,
        last_name: sourceSnapshot.last_name,
        cnic: sourceSnapshot.cnic,
        gender: sourceSnapshot.gender,
        dob: new Date(sourceSnapshot.dob),
        profile_picture: sourceSnapshot.profile_picture,
        is_syed: sourceSnapshot.is_syed,
        createdAt: new Date(sourceSnapshot.createdAt),
        updatedAt: new Date(sourceSnapshot.updatedAt),
      },
      { transaction }
    );

    // Re-link source relational tables
    if (sourceSnapshot.phoneNumbers && sourceSnapshot.phoneNumbers.length > 0) {
      await ContactPhoneNumber.bulkCreate(
        sourceSnapshot.phoneNumbers.map(p => ({
          id: p.id,
          contactId: restoredSource.id,
          phone_number: p.phone_number,
          phone_type: p.phone_type,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        })),
        { transaction }
      );
    }

    if (sourceSnapshot.emails && sourceSnapshot.emails.length > 0) {
      await ContactEmail.bulkCreate(
        sourceSnapshot.emails.map(e => ({
          id: e.id,
          contactId: restoredSource.id,
          email_address: e.email_address,
          email_type: e.email_type,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        })),
        { transaction }
      );
    }

    if (sourceSnapshot.addresses && sourceSnapshot.addresses.length > 0) {
      await ContactAddress.bulkCreate(
        sourceSnapshot.addresses.map(a => ({
          id: a.id,
          contactId: restoredSource.id,
          address_line1: a.address_line1,
          address_line2: a.address_line2,
          city: a.city,
          state: a.state,
          country: a.country,
          postal_code: a.postal_code,
          address_type: a.address_type,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        })),
        { transaction }
      );
    }

    if (sourceSnapshot.socials && sourceSnapshot.socials.length > 0) {
      await ContactSocial.bulkCreate(
        sourceSnapshot.socials.map(s => ({
          social_id: s.social_id,
          contactId: restoredSource.id,
          platform: s.platform,
          url: s.url,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
        { transaction }
      );
    }

    // Restore source's new relations (emergencies/educations/experiences/offices/healths)
    const restoreChild = async (Model, list, fkValue) => {
      if (!Array.isArray(list) || !list.length) return;
      await Model.bulkCreate(
        list.map((row) => ({
          ...row,
          contactId: fkValue,
          createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
        })),
        { transaction }
      );
    };
    await restoreChild(ContactEmergency,  sourceSnapshot.emergencies,  restoredSource.id);
    await restoreChild(ContactEducation,  sourceSnapshot.educations,   restoredSource.id);
    await restoreChild(ContactExperience, sourceSnapshot.experiences,  restoredSource.id);
    // Office needs special handling because employee_id is globally unique:
    // if a row already lives under master with the same employee_id, leave it.
    if (Array.isArray(sourceSnapshot.offices)) {
      for (const off of sourceSnapshot.offices) {
        const existing = await ContactOffice.findOne({ where: { employee_id: off.employee_id }, transaction });
        if (!existing) {
          await ContactOffice.create({
            ...off, contactId: restoredSource.id,
            createdAt: off.createdAt ? new Date(off.createdAt) : undefined,
            updatedAt: off.updatedAt ? new Date(off.updatedAt) : undefined,
          }, { transaction });
        } else if (existing.contactId === restoredSource.id) {
          // Already moved; no-op
        } else {
          // existing belongs to someone else — move it back to source if it was source's originally.
          await ContactOffice.update({ contactId: restoredSource.id }, { where: { id: existing.id }, transaction });
        }
      }
    }
    await restoreChild(ContactHealth, sourceSnapshot.healths, restoredSource.id);

    // 2. Restore Master record core state to snapshot
    const master = await Contact.findByPk(masterSnapshot.id, { transaction });
    if (master) {
      await master.update(
        {
          first_name: masterSnapshot.first_name,
          last_name: masterSnapshot.last_name,
          cnic: masterSnapshot.cnic,
          gender: masterSnapshot.gender,
          dob: new Date(masterSnapshot.dob),
          profile_picture: masterSnapshot.profile_picture,
          is_syed: masterSnapshot.is_syed,
        },
        { transaction }
      );

      // Restore master relational structures by replacing them fully
      await ContactPhoneNumber.destroy({ where: { contactId: master.id }, transaction });
      if (masterSnapshot.phoneNumbers && masterSnapshot.phoneNumbers.length > 0) {
        await ContactPhoneNumber.bulkCreate(
          masterSnapshot.phoneNumbers.map(p => ({
            id: p.id,
            contactId: master.id,
            phone_number: p.phone_number,
            phone_type: p.phone_type,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          })),
          { transaction }
        );
      }

      await ContactEmail.destroy({ where: { contactId: master.id }, transaction });
      if (masterSnapshot.emails && masterSnapshot.emails.length > 0) {
        await ContactEmail.bulkCreate(
          masterSnapshot.emails.map(e => ({
            id: e.id,
            contactId: master.id,
            email_address: e.email_address,
            email_type: e.email_type,
            createdAt: new Date(e.createdAt),
            updatedAt: new Date(e.updatedAt),
          })),
          { transaction }
        );
      }

      await ContactAddress.destroy({ where: { contactId: master.id }, transaction });
      if (masterSnapshot.addresses && masterSnapshot.addresses.length > 0) {
        await ContactAddress.bulkCreate(
          masterSnapshot.addresses.map(a => ({
            id: a.id,
            contactId: master.id,
            address_line1: a.address_line1,
            address_line2: a.address_line2,
            city: a.city,
            state: a.state,
            country: a.country,
            postal_code: a.postal_code,
            address_type: a.address_type,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          })),
          { transaction }
        );
      }

      await ContactSocial.destroy({ where: { contactId: master.id }, transaction });
      if (masterSnapshot.socials && masterSnapshot.socials.length > 0) {
        await ContactSocial.bulkCreate(
          masterSnapshot.socials.map(s => ({
            social_id: s.social_id,
            contactId: master.id,
            platform: s.platform,
            url: s.url,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          })),
          { transaction }
        );
      }

      // Master's new relations — wipe and restore from snapshot
      const wipeRestore = async (Model, list) => {
        await Model.destroy({ where: { contactId: master.id }, transaction });
        if (Array.isArray(list) && list.length) {
          await Model.bulkCreate(
            list.map((row) => ({
              ...row,
              contactId: master.id,
              createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
              updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
            })),
            { transaction }
          );
        }
      };
      await wipeRestore(ContactEmergency,  masterSnapshot.emergencies);
      await wipeRestore(ContactEducation,  masterSnapshot.educations);
      await wipeRestore(ContactExperience, masterSnapshot.experiences);
      // Office uses globally-unique employee_id, so we destroy then create.
      await ContactOffice.destroy({ where: { contactId: master.id }, transaction });
      if (Array.isArray(masterSnapshot.offices)) {
        for (const off of masterSnapshot.offices) {
          // Avoid colliding with rows that may already exist under another contact.
          const dup = await ContactOffice.findOne({ where: { employee_id: off.employee_id }, transaction });
          if (!dup) {
            await ContactOffice.create({
              ...off, contactId: master.id,
              createdAt: off.createdAt ? new Date(off.createdAt) : undefined,
              updatedAt: off.updatedAt ? new Date(off.updatedAt) : undefined,
            }, { transaction });
          }
        }
      }
      await wipeRestore(ContactHealth, masterSnapshot.healths);
    }

    // 3. Mark Merge Log as undone
    await mergeLog.update({ status: "Undone" }, { transaction });

    await transaction.commit();

    res.status(200).json({
      message: "Merge operation reversed successfully. Both contact records restored.",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error reversing merge:", error);
    res.status(500).json({ message: "Failed to reverse merge", error: error.message });
  }
};

/**
 * GET Immutable Merge logs audit trail
 */
export const getMergeLogs = async (req, res) => {
  try {
    const logs = await MergeLog.findAll({
      order: [["merged_at", "DESC"]],
    });
    res.status(200).json(logs);
  } catch (error) {
    console.error("Error fetching merge logs:", error);
    res.status(500).json({ message: "Failed to fetch audit trails", error: error.message });
  }
};
