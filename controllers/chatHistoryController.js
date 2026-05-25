import ChatHistory from "../models/chatHistoryModel.js";
import Asset from "../models/assetModel.js";

export const chatHistoryController = {
  // ✅ Get all support chat histories
  getAll: async (req, res) => {
    try {
      const histories = await ChatHistory.findAll({
        include: [{ model: Asset, as: "asset" }],
        order: [["createdAt", "DESC"]],
      });
      return res.status(200).json(histories);
    } catch (error) {
      console.error("❌ Get chat histories error:", error.stack);
      return res.status(500).json({ error: "Failed to fetch chat histories" });
    }
  },
};
