import fs from 'fs/promises';
import path from 'path';
import {google} from 'googleapis';
import 'dotenv/config';

const ROOT = process.cwd();
const CREDENTIALS_PATH = path.join(ROOT, 'credentials.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');

const OUTLINE_TOKEN = process.env.OUTLINE_TOKEN;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
let API_URL = process.env.OUTLINE_API_URL;
if (!API_URL.endsWith('/')) API_URL += '/';

const TARGET_OUTLINE_IDS = ['Q3mwqFKlvX', 'XuDIhMwxxj', 'LXZC08T1DC', 'iStqy4AfCT', 'Rv7oKt5PlC', 'keQo8BfPNq', 'jORP2gMSgk'];

async function getAuthClient() {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web || {};
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris : undefined);
  const tokenRaw = await fs.readFile(TOKEN_PATH, 'utf8');
  oAuth2Client.setCredentials(JSON.parse(tokenRaw));
  return oAuth2Client;
}

async function fetchWithAuth(endpoint, body) {
  try {
    const response = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OUTLINE_TOKEN.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (e) { return null; }
}

async function ensureDriveFolder(drive, name, parentId) {
  const cleanName = (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim();
  const query = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`;
  
  const res = await drive.files.list({ q: query, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
  
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id; // Берем ID первого найденного
  }

  const folder = await drive.files.create({
    requestBody: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true
  });
  return folder.data.id;
}

async function upsertMarkdownFile(drive, title, text, parentFolderId) {
  const fileName = `CONTENT_${(title || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim()}.md`;
  const query = `name = '${fileName.replace(/'/g, "\\'")}' and trashed = false and '${parentFolderId}' in parents`;
  
  const res = await drive.files.list({ q: query, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
  const media = { mimeType: 'text/markdown', body: text || " " };

  if (res.data.files && res.data.files.length > 0) {
    await drive.files.update({ fileId: res.data.files[0].id, media, supportsAllDrives: true });
  } else {
    await drive.files.create({
      requestBody: { name: fileName, parents: [parentFolderId] },
      media,
      supportsAllDrives: true
    });
  }
}

// Рекурсивный обход на основе структуры коллекции
async function syncNodeRecursive(drive, node, driveParentId) {
  // Получаем текст
  const infoRes = await fetchWithAuth('documents.info', { id: node.id });
  const doc = infoRes?.data;
  if (!doc) return;

  const text = doc.text || doc.content || "";
  const title = doc.title || node.title || "Untitled";

  console.log(`-> Синхронизация: ${title} (${text.length} симв.)`);

  // 1. Создаем папку
  const currentFolderId = await ensureDriveFolder(drive, title, driveParentId);
  
  // 2. Сохраняем файл
  await upsertMarkdownFile(drive, title, text, currentFolderId);

  // 3. Идем по детям из структуры
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      await syncNodeRecursive(drive, child, currentFolderId);
      await new Promise(r => setTimeout(r, 400));
    }
  }
}

async function main() {
  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    
    for (const rootId of TARGET_OUTLINE_IDS) {
      console.log(`\n=== АНАЛИЗ ВЕТКИ: ${rootId} ===`);
      
      const info = await fetchWithAuth('documents.info', { id: rootId });
      if (!info?.data) continue;

      // Получаем структуру всей коллекции
      const structRes = await fetchWithAuth('collections.structure', { id: info.data.collectionId });
      
      // Ищем нашу папку в общем дереве коллекции
      const findInTree = (nodes, id) => {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children) {
            const found = findInTree(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const rootNode = findInTree(structRes?.data || [], rootId);

      if (rootNode) {
        await syncNodeRecursive(drive, rootNode, DRIVE_FOLDER_ID);
      } else {
        // Если в дереве не нашли, качаем хотя бы корень
        await syncNodeRecursive(drive, { id: rootId, title: info.data.title }, DRIVE_FOLDER_ID);
      }
    }
    console.log('\n✅ Готово!');
  } catch (err) {
    console.error('Ошибка:', err.message);
  }
}

main();
