import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

try {
  const parser = new PDFParse({ data: new Uint8Array(10) });
  console.log("Created parser successfully!");
} catch (e) {
  console.error("Error creating parser:", e);
}
