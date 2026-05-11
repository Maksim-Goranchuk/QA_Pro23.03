import { google } from "googleapis";
import { getOAuthClient } from "./auth.js";
import readline from "readline";

export async function listFilesInFolder(folderID) {
  const auth = await getOAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: `'${folderID}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
    fields: "files(id, name)",
    orderBy: "name",
  });

  const files = res.data.files;
  if (!files || files.length === 0) {
    throw new Error(`❌ No Google Docs found in folder ${folderID}`);
  }

  return files;
}

export async function pickFileInteractively(folderID) {
  const files = await listFilesInFolder(folderID);

  console.log("\n📂 Files found in folder:\n");
  files.forEach((f, i) => console.log(`  [${i + 1}] ${f.name}`));
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question("👉 Enter file number to process: ", (answer) => {
      rl.close();
      const index = parseInt(answer.trim(), 10) - 1;

      if (isNaN(index) || index < 0 || index >= files.length) {
        reject(new Error(`❌ Invalid choice: "${answer}"`));
        return;
      }

      const chosen = files[index];
      console.log(`\n✅ Selected: "${chosen.name}"\n`);
      resolve(chosen);
    });
  });
}

export async function fetchGoogleDocContent(documentId) {
  const auth = await getOAuthClient();
  const docs = google.docs({ version: "v1", auth });
  const res = await docs.documents.get({ documentId });

  let text = "";
  const content = res.data.body?.content || [];

  for (const item of content) {
    const elements = item.paragraph?.elements || [];
    for (const el of elements) {
      if (el.textRun?.content) {
        text += el.textRun.content;
      }
    }
  }

  return text.trim();
}