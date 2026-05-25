import Account from "../models/accountModel.js";
import { Op } from "sequelize";

export const accountController = {
  // ✅ Create a new transaction
  create: async (req, res) => {
    try {
      const { title, type, amount, date, description } = req.body;

      if (!title || !type || amount === undefined || amount === null) {
        return res.status(400).json({ message: "Title, type, and amount are required." });
      }

      if (type !== "Income" && type !== "Expense") {
        return res.status(400).json({ message: "Type must be either 'Income' or 'Expense'." });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number greater than zero." });
      }

      const transaction = await Account.create({
        title: title.trim(),
        type,
        amount: numAmount,
        date: date || new Date().toISOString().split("T")[0],
        description: description || "",
      });

      return res.status(201).json({ message: "Transaction created successfully", transaction });
    } catch (error) {
      console.error("❌ Create transaction error:", error.stack);
      return res.status(500).json({ message: "Failed to create transaction" });
    }
  },

  // ✅ Get all transactions with search & filtering
  getAll: async (req, res) => {
    try {
      const { type, search } = req.query;
      const whereCondition = {};

      if (type && (type === "Income" || type === "Expense")) {
        whereCondition.type = type;
      }

      if (search && search.trim() !== "") {
        whereCondition.title = {
          [Op.like]: `%${search.trim()}%`
        };
      }

      const transactions = await Account.findAll({
        where: whereCondition,
        order: [["date", "DESC"], ["createdAt", "DESC"]],
      });

      return res.status(200).json({ transactions });
    } catch (error) {
      console.error("❌ Get transactions error:", error.stack);
      return res.status(500).json({ message: "Failed to fetch transactions" });
    }
  },

  // ✅ Get sum aggregate stats
  getStats: async (req, res) => {
    try {
      const totalIncomeVal = await Account.sum("amount", { where: { type: "Income" } }) || 0;
      const totalExpenseVal = await Account.sum("amount", { where: { type: "Expense" } }) || 0;

      // Handle float rounding issues in standard JS
      const totalIncome = parseFloat(parseFloat(totalIncomeVal).toFixed(2));
      const totalExpense = parseFloat(parseFloat(totalExpenseVal).toFixed(2));
      const remaining = parseFloat((totalIncome - totalExpense).toFixed(2));

      return res.status(200).json({
        totalIncome,
        totalExpense,
        remaining,
      });
    } catch (error) {
      console.error("❌ Get transaction stats error:", error.stack);
      return res.status(500).json({ message: "Failed to fetch stats" });
    }
  },

  // ✅ Update a transaction
  update: async (req, res) => {
    try {
      const { title, type, amount, date, description } = req.body;
      const transaction = await Account.findByPk(req.params.id);

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found." });
      }

      const updateData = {};

      if (title !== undefined) updateData.title = title.trim();
      
      if (type !== undefined) {
        if (type !== "Income" && type !== "Expense") {
          return res.status(400).json({ message: "Type must be either 'Income' or 'Expense'." });
        }
        updateData.type = type;
      }

      if (amount !== undefined) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          return res.status(400).json({ message: "Amount must be a positive number greater than zero." });
        }
        updateData.amount = numAmount;
      }

      if (date !== undefined) updateData.date = date;
      if (description !== undefined) updateData.description = description || "";

      await transaction.update(updateData);

      return res.status(200).json({ message: "Transaction updated successfully", transaction });
    } catch (error) {
      console.error("❌ Update transaction error:", error.stack);
      return res.status(500).json({ message: "Failed to update transaction" });
    }
  },

  // ✅ Delete a transaction
  delete: async (req, res) => {
    try {
      const transaction = await Account.findByPk(req.params.id);

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found." });
      }

      await transaction.destroy();
      return res.status(200).json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("❌ Delete transaction error:", error.stack);
      return res.status(500).json({ message: "Failed to delete transaction" });
    }
  },
};
