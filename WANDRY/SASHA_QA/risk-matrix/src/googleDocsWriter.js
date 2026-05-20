import { google } from "googleapis";
import { getOAuthClient } from "./auth.js";

const HEADERS = [
  "Component",
  "Risk",
  "Cause",
  "Probability",
  "Impact",
  "Priority",
  "Test Cases",
];

async function createSpreadsheetInFolder(folderID, fileName) {
  const auth = await getOAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.create({
    requestBody: {
      name: `Risk Matrix — ${fileName}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderID],
    },
    fields: "id, name, webViewLink",
  });

  console.log(`📊 Created: "${res.data.name}"`);
  console.log(`🔗 ${res.data.webViewLink}`);

  return res.data.id;
}

function generatePriorityColorRules(sheetId, risks) {
  const colorMap = {
    High:   { red: 1,    green: 0.8,  blue: 0.8  },
    Medium: { red: 1,    green: 0.93, blue: 0.8  },
    Low:    { red: 0.85, green: 0.95, blue: 0.85 },
  };

  return risks.map((r, i) => ({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: i + 1,
        endRowIndex: i + 2,
        startColumnIndex: 0,
        endColumnIndex: HEADERS.length,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: colorMap[r.priority] ?? { red: 1, green: 1, blue: 1 },
        },
      },
      fields: "userEnteredFormat(backgroundColor)",
    },
  }));
}

export async function updateGoogleDoc(folderID, sourceFileName, data) {
  const risks = data?.risks || [];

  if (!Array.isArray(risks)) {
    console.warn("⚠️ risks is not array:", risks);
    return;
  }

  const spreadsheetId = await createSpreadsheetInFolder(folderID, sourceFileName);

  const auth = await getOAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheetInfo.data.sheets?.[0];
  const sheetId = sheet?.properties?.sheetId ?? 0;
  const sheetName = sheet?.properties?.title ?? "Sheet1";

  console.log(`📋 Sheet: "${sheetName}" (id: ${sheetId})`);

  const rows = [
    HEADERS,
    ...risks.map((r) => [
      r.component ?? "-",
      r.risk ?? "-",
      r.cause ?? "-",
      r.probability ?? "-",
      r.impact ?? "-",
      r.priority ?? "-",
      r.test_cases ?? "-",
    ]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: HEADERS.length,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
        ...generatePriorityColorRules(sheetId, risks),
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: HEADERS.length,
            },
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  console.log(`✅ Done: ${risks.length} risks written`);
}