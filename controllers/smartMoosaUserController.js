import SmartMoosaUser from "../models/smartMoosaUserModel.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "smart_moosa_secret_key_12345";

export const smartMoosaUserController = {
  // ✅ Register new user
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }

      if (!email.toLowerCase().includes("tms")) {
        return res.status(403).json({ error: "Registration restricted to 'tms' authorized emails only." });
      }

      const existingUsername = await SmartMoosaUser.findOne({ where: { username } });
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const existingEmail = await SmartMoosaUser.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }

      await SmartMoosaUser.create({ username, email, password });
      return res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      console.error("❌ Register error:", error.stack);
      return res.status(500).json({ error: "Initialization failed. Server connection unstable." });
    }
  },

  // ✅ Obtain tokens (mirrors SimpleJWT endpoint)
  token: async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await SmartMoosaUser.findOne({ where: { username } });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials. Please verify your identity and retry." });
      }

      const isPasswordValid = user.verifyPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials. Please verify your identity and retry." });
      }

      // Generate JWT Access and Refresh tokens
      const access = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: "1d" } // 1 day access
      );

      const refresh = jwt.sign(
        { id: user.id },
        JWT_SECRET,
        { expiresIn: "7d" } // 7 days refresh
      );

      return res.status(200).json({ access, refresh });
    } catch (error) {
      console.error("❌ Token generation error:", error.stack);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
};
