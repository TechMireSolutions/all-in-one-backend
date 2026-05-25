import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";

// Helper function to calculate Solar Age
const getSolarAge = (dob) => {
  if (!dob) return null;
  const dobDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  if (
    today.getMonth() < dobDate.getMonth() ||
    (today.getMonth() === dobDate.getMonth() && today.getDate() < dobDate.getDate())
  ) {
    age--;
  }
  return age;
};

// Helper function to calculate Hijri Lunar Age
const getLunarAge = (dob) => {
  if (!dob) return null;
  const dobDate = new Date(dob);
  const parseHijri = (str) => {
    const clean = str.replace(/[^0-9/]/g, "");
    const parts = clean.split("/");
    return parts.length === 3
      ? { month: parseInt(parts[0], 10), day: parseInt(parts[1], 10), year: parseInt(parts[2], 10) }
      : null;
  };
  try {
    const fmt = new Intl.DateTimeFormat("en-US-u-ca-islamic", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const dobH = parseHijri(fmt.format(dobDate));
    const todayH = parseHijri(fmt.format(new Date()));
    if (!dobH || !todayH) {
      const diffMs = new Date() - dobDate;
      return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 354.367));
    }
    let age = todayH.year - dobH.year;
    if (
      todayH.month < dobH.month ||
      (todayH.month === dobH.month && todayH.day < dobH.day)
    ) {
      age--;
    }
    return age;
  } catch (e) {
    const diffMs = new Date() - dobDate;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 354.367));
  }
};

// 1. Contact (Core Entity)
const Contact = sequelize.define(
  "Contact",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: "Unique contact identifier using UUIDv4",
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cnic: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Strictly validated unique CNIC XXXXX-XXXXXXX-X",
    },
    gender: {
      type: DataTypes.ENUM("Male", "Female", "Other", "Prefer not to say"),
      allowNull: false,
    },
    dob: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date of Birth",
    },
    profile_picture: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "URL link to the optimized uploaded profile picture",
    },
    is_syed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    current_age_solar: {
      type: DataTypes.VIRTUAL,
      get() {
        return getSolarAge(this.getDataValue("dob"));
      },
    },
    current_age_lunar: {
      type: DataTypes.VIRTUAL,
      get() {
        return getLunarAge(this.getDataValue("dob"));
      },
    },
  },
  {
    tableName: "contacts",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["cnic"],
      },
    ],
  }
);

// 2. Contact Phone Number (1:Many)
const ContactPhoneNumber = sequelize.define(
  "ContactPhoneNumber",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "E.164 strictly validated phone number (e.g. +923001234567)",
    },
    phone_type: {
      type: DataTypes.ENUM("Home", "Office", "Mobile", "WhatsApp", "Other"),
      allowNull: false,
    },
  },
  {
    tableName: "contact_phones",
    timestamps: true,
    indexes: [
      {
        fields: ["contactId"],
      },
      {
        fields: ["phone_number"],
      },
    ],
  }
);

// 3. Contact Email (1:Many)
const ContactEmail = sequelize.define(
  "ContactEmail",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    email_address: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "RFC 5322 strictly validated email address",
    },
    email_type: {
      type: DataTypes.ENUM("Home", "Office", "Personal", "Other"),
      allowNull: false,
    },
  },
  {
    tableName: "contact_emails",
    timestamps: true,
    indexes: [
      {
        fields: ["contactId"],
      },
      {
        fields: ["email_address"],
      },
    ],
  }
);

// 4. Contact Address (1:Many)
const ContactAddress = sequelize.define(
  "ContactAddress",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    address_line1: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address_line2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    postal_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address_type: {
      type: DataTypes.ENUM("Home", "Office", "Mailing", "Other"),
      allowNull: false,
    },
  },
  {
    tableName: "contact_addresses",
    timestamps: true,
    indexes: [
      {
        fields: ["contactId"],
      },
    ],
  }
);

// 5. Contact Social Media (1:Many)
const ContactSocial = sequelize.define(
  "ContactSocial",
  {
    social_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    platform: {
      type: DataTypes.ENUM("Facebook", "Twitter", "Instagram", "LinkedIn", "Other"),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Strictly validated platform URL",
    },
  },
  {
    tableName: "contact_socials",
    timestamps: true,
    indexes: [
      {
        fields: ["contactId"],
      },
    ],
  }
);

// 6. Merge Log (Audit Trail)
const MergeLog = sequelize.define(
  "MergeLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    merged_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    merged_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    master_record_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    source_record_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    master_snapshot: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "Raw JSON backup of the master record and relations prior to merge",
    },
    source_snapshot: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "Raw JSON backup of the source record and relations prior to merge",
    },
    status: {
      type: DataTypes.ENUM("Merged", "Undone"),
      defaultValue: "Merged",
      allowNull: false,
    },
  },
  {
    tableName: "merge_logs",
    timestamps: true,
  }
);

// Establish Model Associations
Contact.hasMany(ContactPhoneNumber, { foreignKey: "contactId", as: "phoneNumbers", onDelete: "CASCADE" });
ContactPhoneNumber.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactEmail, { foreignKey: "contactId", as: "emails", onDelete: "CASCADE" });
ContactEmail.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactAddress, { foreignKey: "contactId", as: "addresses", onDelete: "CASCADE" });
ContactAddress.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

Contact.hasMany(ContactSocial, { foreignKey: "contactId", as: "socials", onDelete: "CASCADE" });
ContactSocial.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });

export {
  Contact,
  ContactPhoneNumber,
  ContactEmail,
  ContactAddress,
  ContactSocial,
  MergeLog,
};
