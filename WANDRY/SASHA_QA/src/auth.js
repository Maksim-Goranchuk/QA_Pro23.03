import { google } from "googleapis";
import fs from "fs";
import path from "path";
import open from "open";
import readline from "readline";

const CREDENTIALS_PATH = "./oauth-credentials.json";
const TOKEN_PATH = "./oauth-token.json";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

export async function getOAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // If token already exists — use it
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);

    // Auto-refresh if expired
    oAuth2Client.on("tokens", (tokens) => {
      const current = JSON.parse(fs.readFileSync(TOKEN_PATH));
      const updated = { ...current, ...tokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated));
      console.log("🔄 Token refreshed");
    });

    return oAuth2Client;
  }

  // First run — open browser for authorization
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("\n🔐 Opening browser for Google authorization...");
  await open(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question("👉 Paste the authorization code here: ", async (code) => {
      rl.close();
      try {
        const { tokens } = await oAuth2Client.getToken(code.trim());
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log("✅ Authorization successful! Token saved.\n");
        resolve(oAuth2Client);
      } catch (err) {
        reject(new Error(`❌ Failed to get token: ${err.message}`));
      }
    });
  });
}