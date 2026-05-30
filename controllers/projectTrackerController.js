import ProjectTracker from "../models/projectTrackerModel.js";
import { PDFParse } from "pdf-parse";

// pdf-parse v2 — try table extraction first, fall back to text with tab separators
const extractPdfRows = async (buffer) => {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  let tables = [];
  let text = "";
  try {
    // 1) Try vector-table extraction (works for PDFs with drawn tables)
    const tableResult = await parser.getTable();
    tables = (tableResult.mergedTables || []).concat(
      (tableResult.pages || []).flatMap((p) => p.tables || [])
    );
  } catch (e) { /* no tables — fall back */ }
  try {
    // 2) Always also grab text with TAB as cell separator
    const txt = await parser.getText({ cellSeparator: "\t", cellThreshold: 5 });
    text = txt.text || "";
  } catch (e) { /* ignore */ }
  await parser.destroy();
  return { tables, text };
};

// Convert empty / "Invalid date" / non-ISO strings to null
const cleanDate = (val) => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // try to parse "DD/MM/YYYY" or "MM/DD/YYYY" or generic
    const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [, a, b, y] = m;
      if (y.length === 2) y = "20" + y;
      // assume DD/MM/YYYY if first part > 12
      const dd = parseInt(a, 10) > 12 ? a : b;
      const mm = parseInt(a, 10) > 12 ? b : a;
      return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
};

const sanitizePayload = (body) => ({
  project_name: body.project_name?.toString().trim() || "",
  website_link: body.website_link?.toString().trim() || null,
  ojt_name: body.ojt_name?.toString().trim() || null,
  framework: body.framework?.toString().trim() || null,
  lead_name: body.lead_name?.toString().trim() || null,
  project_given_date: cleanDate(body.project_given_date),
  start_date: cleanDate(body.start_date),
  end_date: cleanDate(body.end_date),
  deadline: cleanDate(body.deadline),
  status: body.status?.toString().trim() || "Not Started",
});

export const projectTrackerController = {
  create: async (req, res) => {
    try {
      const data = sanitizePayload(req.body);
      if (!data.project_name) return res.status(400).json({ message: "project_name is required" });
      const project = await ProjectTracker.create(data);
      return res.status(201).json({ message: "Project created successfully", project });
    } catch (error) {
      console.error("❌ Create project error:", error.stack);
      return res.status(500).json({ message: "Failed to create project" });
    }
  },

  // Bulk import — accepts { projects: [...] } from Excel/PDF
  bulkImport: async (req, res) => {
    try {
      const incoming = Array.isArray(req.body?.projects) ? req.body.projects : [];
      if (!incoming.length) return res.status(400).json({ message: "No rows to import" });

      let created = 0, skipped = 0;
      const errors = [];
      for (const row of incoming) {
        const data = sanitizePayload(row);
        if (!data.project_name) { skipped++; continue; }
        try {
          await ProjectTracker.create(data);
          created++;
        } catch (e) {
          errors.push({ project_name: data.project_name, error: e.message });
          skipped++;
        }
      }
      return res.status(200).json({
        message: `Imported ${created} project(s), skipped ${skipped}`,
        created, skipped, errors,
      });
    } catch (error) {
      console.error("❌ Bulk import error:", error.stack);
      return res.status(500).json({ message: "Bulk import failed" });
    }
  },

  // Parse PDF → extract rows.
  parsePdf: async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No PDF uploaded" });
    try {
      const { tables, text } = await extractPdfRows(req.file.buffer);
      const FIELDS = [
        "project_name", "website_link", "ojt_name", "framework", "lead_name",
        "project_given_date", "start_date", "end_date", "deadline", "status",
      ];
      const HEADER_KEYWORDS = ["project", "website", "ojt", "framework", "lead", "given", "start", "end", "deadline", "status"];

      const isHeaderRow = (row) => {
        const joined = row.join(" ").toLowerCase();
        const hits = HEADER_KEYWORDS.filter((k) => joined.includes(k)).length;
        return hits >= 4;
      };
      const clean = (v) => {
        if (v == null) return "";
        const s = String(v).trim();
        if (s === "—" || s === "-" || s === "N/A" || s === "—") return "";
        return s;
      };
      const mapRow = (cells) => {
        const obj = {};
        FIELDS.forEach((f, i) => { obj[f] = clean(cells[i] || ""); });
        return obj;
      };

      const rows = [];

      // ── Strategy 1: vector-detected tables ──
      for (const table of tables) {
        if (!Array.isArray(table) || !table.length) continue;
        let dataRows = table;
        // Skip header row if present
        if (isHeaderRow(table[0])) dataRows = table.slice(1);
        for (const r of dataRows) {
          if (!r || !r.length) continue;
          const obj = mapRow(r);
          if (obj.project_name) rows.push(obj);
        }
      }

      // ── Strategy 2: text with tab separators (fallback) ──
      if (rows.length === 0 && text) {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        // Find header line index
        let headerIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          const tokens = lines[i].split(/\t+/);
          if (isHeaderRow(tokens)) { headerIdx = i; break; }
        }
        const dataLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines;
        for (const line of dataLines) {
          // Skip noise: page titles, "X projects total", etc
          if (/^project progress tracker$/i.test(line)) continue;
          if (/projects? total$/i.test(line)) continue;

          // Split by tab first, then by 2+ spaces if no tabs
          let cells = line.split(/\t+/);
          if (cells.length < 5) cells = line.split(/\s{2,}/);
          const obj = mapRow(cells);
          if (obj.project_name) rows.push(obj);
        }
      }

      return res.status(200).json({
        rows,
        debug: { tablesFound: tables.length, textChars: text.length, sampleText: text.slice(0, 500) },
      });
    } catch (error) {
      console.error("❌ PDF parse error:", error.stack);
      return res.status(500).json({ message: "Failed to parse PDF: " + error.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const projects = await ProjectTracker.findAll({ order: [["createdAt", "DESC"]] });
      return res.status(200).json({ projects });
    } catch (error) {
      console.error("❌ Get projects error:", error.stack);
      return res.status(500).json({ message: "Failed to fetch projects" });
    }
  },

  getById: async (req, res) => {
    try {
      const project = await ProjectTracker.findByPk(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      return res.status(200).json({ project });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch project" });
    }
  },

  update: async (req, res) => {
    try {
      const project = await ProjectTracker.findByPk(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      await project.update(sanitizePayload(req.body));
      return res.status(200).json({ message: "Project updated successfully", project });
    } catch (error) {
      console.error("❌ Update project error:", error.stack);
      return res.status(500).json({ message: "Failed to update project" });
    }
  },

  delete: async (req, res) => {
    try {
      const project = await ProjectTracker.findByPk(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      await project.destroy();
      return res.status(200).json({ message: "Project deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete project" });
    }
  },
};
