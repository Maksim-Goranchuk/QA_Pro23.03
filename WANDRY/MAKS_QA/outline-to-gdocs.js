import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import {google} from 'googleapis';
import 'dotenv/config';

const ROOT = process.cwd();
const CREDENTIALS_PATH = path.join(ROOT, 'credentials.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');

const OUTLINE_TOKEN = process.env.OUTLINE_TOKEN;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const OUTLINE_PARENT_ID = process.env.OUTLINE_PARENT_ID;
const OUTLINE_IDS = (process.env.OUTLINE_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
const DRIVE_SUPPORTS_ALL_DRIVES = process.env.DRIVE_SUPPORTS_ALL_DRIVES !== 'false';

const API_URL = process.env.OUTLINE_API_URL;
const SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'];
const DEFAULT_OUTLINE_IDS = ['Q3mwqFKlvX', 'LXZC08T1DC', 'lAvK728mKN', 'iStqy4AfCT', 'Rv7oKt5PlC', 'keQo8BfPNq', 'jORP2gMSgk', 'WUrR4O4Xm4'];

function safeTitle(value) {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim();
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAuthClient() {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const credentials = JSON.parse(content);

  if (credentials.type === 'service_account') {
    const auth = new google.auth.GoogleAuth({ keyFile: CREDENTIALS_PATH, scopes: SCOPES });
    return auth.getClient();
  }

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web || {};
  if (!client_secret || !client_id) {
    throw new Error('Invalid credentials.json format. Use OAuth client credentials from Google Cloud Console.');
  }

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  try {
    const tokenRaw = await fs.readFile(TOKEN_PATH, 'utf8');
    oAuth2Client.setCredentials(JSON.parse(tokenRaw));
    return oAuth2Client;
  } catch {
    return getNewToken(oAuth2Client);
  }
}

async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('Authorize this app by visiting this URL:');
  console.log(authUrl);
  const code = await prompt('Enter the authorization code here: ');
  const tokenResponse = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokenResponse.tokens);
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokenResponse.tokens, null, 2), 'utf8');
  console.log('Saved token to', TOKEN_PATH);
  return oAuth2Client;
}

async function fetchOutlineList(parentId) {
  const response = await fetch(API_URL + 'documents.list', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + OUTLINE_TOKEN.trim(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ parentDocumentId: parentId })
  });

  if (!response.ok) {
    throw new Error(`Outline list request failed (${response.status}): ${await response.text()}`);
  }

  const json = await response.json();
  return json.data || [];
}

async function fetchOutlineInfo(id) {
  const response = await fetch(API_URL + 'documents.info', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + OUTLINE_TOKEN.trim(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id })
  });

  if (!response.ok) {
    console.error(`Failed to fetch outline info for ${id}:`, await response.text());

    throw new Error(`Outline fetch failed for ${id} (${response.status}): ${await response.text()}`);
  }

  const json = await response.json();
  return json.data;
}

function escapeQueryValue(value) {
  return value.replace(/'/g, "\\'");
}

function driveRequestOptions() {
  return DRIVE_SUPPORTS_ALL_DRIVES ? {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  } : {};
}

async function findExistingDoc(drive, title) {
  const query = `name = '${escapeQueryValue(title)}' and mimeType = 'application/vnd.google-apps.document' and trashed = false and '${DRIVE_FOLDER_ID}' in parents`;
  const res = await drive.files.list({ q: query, fields: 'files(id,name)', spaces: 'drive', ...driveRequestOptions() });
  return res.data.files || [];
}

async function createGoogleDoc(drive, title) {
  console.log('Checking folder access for ID:', DRIVE_FOLDER_ID);
  try {
    const folderCheck = await drive.files.get({ fileId: DRIVE_FOLDER_ID, fields: 'id,name', ...driveRequestOptions() });
    console.log('Folder found:', folderCheck.data.name);
  } catch (error) {
    console.error('Folder access error:', error.message);
    throw error;
  }

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [DRIVE_FOLDER_ID]
    },
    fields: 'id,name',
    ...driveRequestOptions()
  });
  return res.data;
}

async function updateGoogleDoc(docs, documentId, text) {
  const document = await docs.documents.get({ documentId });
  const body = document.data.body;
  const lastElement = body.content?.[body.content.length - 1];
  const endIndex = lastElement?.endIndex || 1;

  const requests = [];
  if (endIndex > 1) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
  }

  requests.push({ insertText: { location: { index: 1 }, text } });

  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
}

async function ensureGoogleDoc(auth, title, text) {
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  const existing = await findExistingDoc(drive, title);
  if (existing.length > 0) {
    console.log('Updating document:', existing[0].name, existing[0].id);
    await updateGoogleDoc(docs, existing[0].id, text);
    return existing[0];
  }

  const created = await createGoogleDoc(drive, title);
  console.log('Created document:', created.name, created.id);
  await updateGoogleDoc(docs, created.id, text);
  return created;
}

async function main() {
  if (!OUTLINE_TOKEN) {
    throw new Error('Missing OUTLINE_TOKEN. Set it as an environment variable.');
  }
  if (!DRIVE_FOLDER_ID) {
    throw new Error('Missing DRIVE_FOLDER_ID. Set it as an environment variable.');
  }
  if (!API_URL) {
    throw new Error('Missing OUTLINE_API_URL. Set it as an environment variable.');
  }

  const ids = OUTLINE_PARENT_ID ? (await fetchOutlineList(OUTLINE_PARENT_ID)).map(item => item.id) : (OUTLINE_IDS.length ? OUTLINE_IDS : DEFAULT_OUTLINE_IDS);

  if (ids.length === 0) {
    throw new Error('No Outline document IDs provided. Set OUTLINE_IDS or OUTLINE_PARENT_ID.');
  }

  const auth = await getAuthClient();

  for (const id of ids) {
    try {
      console.log('Processing Outline ID:', id);
      const outline = await fetchOutlineInfo(id);
      const title = safeTitle(outline.title || `outline-${id}`);
      const text = outline.text || '';
      await ensureGoogleDoc(auth, title, text);
      await sleep(2500);
    } catch (error) {
      console.error(`Failed for ${id}:`, error.message || error);
      console.log(  'Continuing with next document...');    
    }
  }

  console.log('Done. All documents processed.');
}

main().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
