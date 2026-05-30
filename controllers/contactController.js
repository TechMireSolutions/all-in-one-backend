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
  MergeLog,
} from "../models/contactModel.js";
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

  // Accept either format: XXXXX-XXXXXXX-X (dashes) or 13 plain digits.
  const cleaned = String(cnic).replace(/\D/g, "");
  if (cleaned.length !== 13) {
    return { valid: false, message: "CNIC must be 13 digits (with or without dashes)." };
  }

  // Gender parity convention: last digit is odd for Male, even for Female.
  const lastDigit = parseInt(cleaned[12], 10);
  if (gender === "Male" && lastDigit % 2 === 0) {
    return { valid: false, message: "Last digit of CNIC for 'Male' must be odd." };
  }
  if (gender === "Female" && lastDigit % 2 !== 0) {
    return { valid: false, message: "Last digit of CNIC for 'Female' must be even." };
  }

  // Note: NADRA CNICs do NOT use a Luhn checksum. The earlier Luhn check
  // wrongly rejected valid real-world CNICs — we only enforce format and
  // gender parity now.
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
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
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
    const contact = await Contact.findByPk(req.params.id, {
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
    });

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
      family,
      education,
      experience,
      office,
      health,
      emergency,
    } = req.body;

    const parseJson = (v) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v) || null;
    family     = parseJson(family);
    education  = parseJson(education);
    experience = parseJson(experience);
    office     = parseJson(office);
    health     = parseJson(health);
    emergency  = parseJson(emergency);

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

    // Check unique CNIC in database
    const existingCnic = await Contact.findOne({ where: { cnic } });
    if (existingCnic) {
      await transaction.rollback();
      return res.status(400).json({ message: `A contact with CNIC ${cnic} already exists.` });
    }

    // Parse sub-arrays
    const parsedPhones = typeof phoneNumbers === "string" ? JSON.parse(phoneNumbers) : (phoneNumbers || []);
    const parsedEmails = typeof emails === "string" ? JSON.parse(emails) : (emails || []);
    const parsedAddresses = typeof addresses === "string" ? JSON.parse(addresses) : (addresses || []);
    const parsedSocials = typeof socials === "string" ? JSON.parse(socials) : (socials || []);

    // Validate Sub-Models
    for (const phone of parsedPhones) {
      if (!validateE164(phone.phone_number)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Phone number ${phone.phone_number} must match E.164 international format.` });
      }
    }

    for (const email of parsedEmails) {
      // Basic RFC 5322 regex validation
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
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

    // 6. Save Contact Core Record
    const newContact = await Contact.create(
      {
        first_name: cleanFirstName,
        last_name: cleanLastName,
        cnic,
        gender,
        dob: new Date(dob),
        profile_picture,
        is_syed,
        family,
        education,
        experience,
        office,
        health,
        emergency,
      },
      { transaction }
    );

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

    await transaction.commit();

    // Fetch full saved contact
    const fullContact = await Contact.findByPk(newContact.id, {
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
    });

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
      family,
      education,
      experience,
      office,
      health,
      emergency,
    } = req.body;

    const parseJson = (v) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);

    is_syed = is_syed !== undefined ? (is_syed === true || is_syed === "true") : contact.is_syed;
    const finalGender = gender || contact.gender;

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

    // Update Core Model
    await contact.update(
      {
        first_name: cleanFirstName,
        last_name: cleanLastName,
        cnic: cnic || contact.cnic,
        gender: finalGender,
        dob: dob ? new Date(dob) : contact.dob,
        profile_picture,
        is_syed,
        family:     family     !== undefined ? parseJson(family)     : contact.family,
        education:  education  !== undefined ? parseJson(education)  : contact.education,
        experience: experience !== undefined ? parseJson(experience) : contact.experience,
        office:     office     !== undefined ? parseJson(office)     : contact.office,
        health:     health     !== undefined ? parseJson(health)     : contact.health,
        emergency:  emergency  !== undefined ? parseJson(emergency)  : contact.emergency,
      },
      { transaction }
    );

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

    await transaction.commit();

    const fullContact = await Contact.findByPk(contact.id, {
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
    });

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

    const allContacts = await Contact.findAll({
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
    });

    if (id) {
      const candidate = await Contact.findByPk(id, {
        include: [
          { model: ContactPhoneNumber, as: "phoneNumbers" },
          { model: ContactEmail, as: "emails" },
          { model: ContactAddress, as: "addresses" },
          { model: ContactSocial, as: "socials" },
        ],
      });

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

    const master = await Contact.findByPk(masterId, {
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
      transaction,
    });

    const source = await Contact.findByPk(sourceId, {
      include: [
        { model: ContactPhoneNumber, as: "phoneNumbers" },
        { model: ContactEmail, as: "emails" },
        { model: ContactAddress, as: "addresses" },
        { model: ContactSocial, as: "socials" },
      ],
      transaction,
    });

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

    // 6. Record merge log in database
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
