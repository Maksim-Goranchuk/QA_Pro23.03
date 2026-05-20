import dotenv from "dotenv";
dotenv.config();

import { pickFileInteractively, fetchGoogleDocContent } from "./googleDocsReader.js";
import { updateGoogleDoc } from "./googleDocsWriter.js";
import { analyzeRisks } from "./llm.js";
import { formatRiskMatrix } from "./formatter.js";

const FOLDER_ID = process.env.DRIVE_FOLDER_ID;

async function run() {
  try {
    if (!FOLDER_ID) throw new Error("DRIVE_FOLDER_ID is not set in .env");

    // Pick file interactively from folder listing
    const file = await pickFileInteractively(FOLDER_ID);

    console.log("📖 Reading document content...");
    const text = await fetchGoogleDocContent(file.id);

    console.log("🤖 Analyzing risks...");
    const result = await analyzeRisks(text);

    console.log("📦 RESULT:", JSON.stringify(result, null, 2));

    console.log("📊 Formatting matrix (console preview)...");
    const table = formatRiskMatrix(result);
    console.log(table);

    console.log("📤 Creating Risk Matrix spreadsheet in Drive folder...");
    await updateGoogleDoc(FOLDER_ID, file.name, result);

    console.log("✅ DONE");
  } catch (err) {
    console.error("❌ PIPELINE FAILED:", err);
  }
}

run();