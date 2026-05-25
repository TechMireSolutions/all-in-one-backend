import Asset from "../models/assetModel.js";
import Assignment from "../models/assignmentModel.js";
import ChatHistory from "../models/chatHistoryModel.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const assetController = {
  // ✅ Get all assets (include assignments)
  getAll: async (req, res) => {
    try {
      const assets = await Asset.findAll({
        include: [{ model: Assignment, as: "assignments" }],
        order: [["createdAt", "DESC"]],
      });
      return res.status(200).json(assets);
    } catch (error) {
      console.error("❌ Get all assets error:", error.stack);
      return res.status(500).json({ error: "Failed to fetch assets" });
    }
  },

  // ✅ Get single asset by ID (include assignments)
  getById: async (req, res) => {
    try {
      const asset = await Asset.findByPk(req.params.id, {
        include: [{ model: Assignment, as: "assignments" }],
      });
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      return res.status(200).json(asset);
    } catch (error) {
      console.error("❌ Get asset error:", error.stack);
      return res.status(500).json({ error: "Failed to fetch asset" });
    }
  },

  // ✅ Create new asset
  create: async (req, res) => {
    try {
      const {
        name, asset_model, serial_number, ram, os, cpu,
        purchase_date, condition, external_storage,
        external_storage_size, additional_notes, status
      } = req.body;

      if (!name || !asset_model || !serial_number) {
        return res.status(400).json({ error: "name, asset_model, and serial_number are required" });
      }

      const existing = await Asset.findOne({ where: { serial_number } });
      if (existing) {
        return res.status(400).json({ error: "Asset with this serial number already exists" });
      }

      const asset = await Asset.create({
        name, asset_model, serial_number,
        ram: ram || "16GB",
        os: os || "Windows 11 Pro",
        cpu: cpu || "Intel Core i7",
        purchase_date: purchase_date || null,
        condition: condition || "New",
        external_storage: external_storage || "None",
        external_storage_size: external_storage_size || "N/A",
        additional_notes: additional_notes || "",
        status: status || "Available"
      });

      return res.status(201).json(asset);
    } catch (error) {
      console.error("❌ Create asset error:", error.stack);
      return res.status(500).json({ error: "Failed to create asset" });
    }
  },

  // ✅ Update asset
  update: async (req, res) => {
    try {
      const asset = await Asset.findByPk(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      await asset.update(req.body);
      return res.status(200).json(asset);
    } catch (error) {
      console.error("❌ Update asset error:", error.stack);
      return res.status(500).json({ error: "Failed to update asset" });
    }
  },

  // ✅ Delete asset
  delete: async (req, res) => {
    try {
      const asset = await Asset.findByPk(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      await asset.destroy();
      return res.status(204).send();
    } catch (error) {
      console.error("❌ Delete asset error:", error.stack);
      return res.status(500).json({ error: "Failed to delete asset" });
    }
  },

  // ✅ Support Chat with Gemini Flash
  support: async (req, res) => {
    try {
      const asset = await Asset.findByPk(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      // Prompt Engineering exactly mirroring Django logic
      const prompt = `
        You are a technical support assistant for office hardware.
        Device Details:
        - Model: ${asset.asset_model}
        - RAM: ${asset.ram}
        - OS: ${asset.os}
        - CPU: ${asset.cpu}
        
        User Problem: ${query}
        
        Please provide concise, step-by-step repair steps or troubleshooting advice specifically tailored for this hardware configuration.
      `;

      // Call Gemini Flash model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();

      // Store in ChatHistory
      await ChatHistory.create({
        assetId: asset.id,
        user_query: query,
        ai_response: aiResponse,
      });

      return res.status(200).json({ response: aiResponse });
    } catch (error) {
      console.error("❌ Gemini Support Chat error:", error.stack);
      return res.status(500).json({ error: error.message || "Failed to contact Gemini support assistant" });
    }
  },
};
