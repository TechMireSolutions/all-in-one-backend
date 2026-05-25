import { DataTypes } from "sequelize";
import { sequelize } from "../DB/DBconnection.js";
import Asset from "./assetModel.js";

const ChatHistory = sequelize.define(
  "ChatHistory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_query: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ai_response: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    assetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Asset,
        key: "id",
      },
    },
  },
  {
    tableName: "chat_histories",
    timestamps: true,
  }
);

// Define associations
Asset.hasMany(ChatHistory, { foreignKey: "assetId", as: "chat_histories" });
ChatHistory.belongsTo(Asset, { foreignKey: "assetId", as: "asset" });

export default ChatHistory;
