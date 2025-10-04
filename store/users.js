'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_DB_PATH = path.join(DATA_DIR, 'users.json');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

async function ensureDataDir() {
  try { await fsp.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

async function readUsersDb() {
  await ensureDataDir();
  try {
    const raw = await fsp.readFile(USERS_DB_PATH, 'utf8');
    const json = JSON.parse(raw);
    if (!json || typeof json !== 'object' || typeof json.users !== 'object') return { users: {} };
    return json;
  } catch (e) {
    if (e && e.code === 'ENOENT') return { users: {} };
    return { users: {} };
  }
}

async function writeUsersDb(db) {
  await ensureDataDir();
  try {
    await fsp.writeFile(USERS_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch { return false; }
}

async function upsertUserProfile(profile) {
  const db = await readUsersDb();
  const id = String(profile.telegramId);
  db.users[id] = { ...(db.users[id] || {}), ...profile, updatedAt: Date.now() };
  await writeUsersDb(db);
  return db.users[id];
}

async function initAvatarDir() {
  try { await fsp.mkdir(AVATARS_DIR, { recursive: true }); } catch {}
}

function downloadHttpsToFile(url, destPath) {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const file = fs.createWriteStream(destPath);
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          try { file.close(); fsp.unlink(destPath).catch(() => {}); } catch {}
          return resolve(null);
        }
        response.pipe(file);
        file.on('finish', () => { file.close(() => resolve(destPath)); });
      }).on('error', () => {
        try { file.close(); fsp.unlink(destPath).catch(() => {}); } catch {}
        resolve(null);
      });
    } catch { resolve(null); }
  });
}

const avatarQueue = [];
let avatarWorkerRunning = false;

function enqueueAvatarJob(telegramId, photoUrl) {
  if (!telegramId || !photoUrl) return;
  avatarQueue.push({ telegramId: String(telegramId), photoUrl: String(photoUrl) });
  runAvatarWorker();
}

async function runAvatarWorker() {
  if (avatarWorkerRunning) return;
  avatarWorkerRunning = true;
  try {
    while (avatarQueue.length > 0) {
      const job = avatarQueue.shift();
      if (!job) break;
      try {
        await initAvatarDir();
        const safeId = job.telegramId.replace(/[^0-9]/g, '');
        const dest = path.join(AVATARS_DIR, `${safeId}.jpg`);
        await downloadHttpsToFile(job.photoUrl, dest);
      } catch {}
    }
  } finally {
    avatarWorkerRunning = false;
  }
}

async function tryGetCachedAvatarPath(telegramId) {
  if (!telegramId) return null;
  try {
    const safeId = String(telegramId).replace(/[^0-9]/g, '');
    const dest = path.join(AVATARS_DIR, `${safeId}.jpg`);
    await fsp.stat(dest);
    return `/avatars/${safeId}.jpg`;
  } catch { return null; }
}

module.exports = {
  readUsersDb,
  writeUsersDb,
  upsertUserProfile,
  initAvatarDir,
  enqueueAvatarJob,
  tryGetCachedAvatarPath,
  AVATARS_DIR,
};



