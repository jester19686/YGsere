'use strict';

const path = require('path');
const crypto = require('crypto');
const { enqueueAvatarJob, tryGetCachedAvatarPath, upsertUserProfile } = require('../store/users');

function getClientIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.length > 0) {
    return xfwd.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function auditAuth(event, payload) {
  try {
    const line = JSON.stringify({ t: new Date().toISOString(), evt: event, ...payload }) + '\n';
    require('fs').promises.appendFile(path.join(__dirname, '..', 'server.log'), line, 'utf8').catch(() => {});
  } catch {}
}

function createAuthRouter({ rateLimitAuth }) {
  const express = require('express');
  const router = express.Router();

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  function isValidTelegramAuthPayload(payload) {
    if (!TELEGRAM_BOT_TOKEN) return false;
    try {
      const hash = payload.hash;
      const data = { ...payload };
      delete data.hash;
      const dataCheckArr = Object.keys(data).sort().map((k) => `${k}=${data[k]}`);
      const dataCheckString = dataCheckArr.join('\n');
      const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      if (hmac !== hash) return false;
      const authDate = Number(payload.auth_date || payload.authDate || 0);
      const now = Math.floor(Date.now() / 1000);
      if (!authDate || now - authDate > 600) return false;
      return true;
    } catch { return false; }
  }

  router.post('/api/auth/telegram/verify', async (req, res) => {
    if (!rateLimitAuth(req, res)) return;
    try {
      const payload = req.body || {};
      if (!isValidTelegramAuthPayload(payload)) {
        auditAuth('tg_verify_fail', { ip: getClientIp(req), reason: 'invalid_signature' });
        return res.status(401).json({ ok: false, error: 'invalid_signature' });
      }

      const telegramId = String(payload.id);
      const username = payload.username || '';
      const firstName = payload.first_name || '';
      const lastName = payload.last_name || '';
      const photoUrl = payload.photo_url || '';
      const displayName = username || [firstName, lastName].filter(Boolean).join(' ') || `tg_${telegramId}`;

      enqueueAvatarJob(telegramId, photoUrl);
      const cachedAvatar = await tryGetCachedAvatarPath(telegramId);

      const saved = await upsertUserProfile({
        telegramId,
        username,
        name: displayName,
        avatarUrl: cachedAvatar || photoUrl || null,
      });

      auditAuth('tg_verify_ok', { ip: getClientIp(req), telegramId, username });
      return res.json({ ok: true, profile: { id: saved.telegramId, name: saved.name, avatarUrl: saved.avatarUrl || null } });
    } catch (e) {
      auditAuth('tg_verify_error', { ip: getClientIp(req), message: String(e?.message || e) });
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  const otpSessions = new Map();
  function generateOtpCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
  }

  router.post('/api/auth/tg/otp/create', (req, res) => {
    if (!rateLimitAuth(req, res)) return;
    try {
      const { mode } = req.query || {};
      const isAuthMode = String(mode || '') === 'auth';
      const code = isAuthMode ? `AUTH_${generateOtpCode()}` : generateOtpCode();
      const session = { code, status: 'pending', profile: null, createdAt: Date.now() };
      otpSessions.set(code, session);
      auditAuth('otp_create', { ip: getClientIp(req), code });
      res.json({ ok: true, code });
    } catch (e) { res.status(500).json({ ok: false, error: 'server_error' }); }
  });

  router.get('/api/auth/tg/otp/status', (req, res) => {
    if (!rateLimitAuth(req, res)) return;
    try {
      const code = String(req.query.code || '').trim();
      const s = otpSessions.get(code);
      if (!code || !s) return res.json({ ok: true, status: 'not_found' });
      if (Date.now() - s.createdAt > 10 * 60 * 1000) {
        otpSessions.delete(code);
        auditAuth('otp_expired', { ip: getClientIp(req), code });
        return res.json({ ok: true, status: 'expired' });
      }
      res.json({ ok: true, status: s.status, profile: s.profile || null });
    } catch (e) { res.status(500).json({ ok: false, error: 'server_error' }); }
  });

  router.post('/api/auth/tg/otp/confirm', async (req, res) => {
    if (!rateLimitAuth(req, res)) return;
    try {
      const { code, id, username, first_name, last_name, photo_url } = req.body || {};
      const raw = String(code || '').trim();
      let s = otpSessions.get(raw);
      if (!s) {
        const withPref = raw.startsWith('AUTH_') ? raw : `AUTH_${raw}`;
        const withoutPref = raw.replace(/^AUTH_/, '');
        s = otpSessions.get(withPref) || otpSessions.get(withoutPref) || null;
      }
      if (!s) {
        auditAuth('otp_not_found', { ip: getClientIp(req), received: raw });
        return res.json({ ok: false, error: 'otp_not_found', received: raw });
      }
      if (Date.now() - s.createdAt > 10 * 60 * 1000) {
        otpSessions.delete(s.code);
        auditAuth('otp_expired', { ip: getClientIp(req), code: s.code });
        return res.json({ ok: false, error: 'otp_expired' });
      }
      const displayName = username || [first_name, last_name].filter(Boolean).join(' ') || `tg_${id}`;
      const saved = await upsertUserProfile({ telegramId: String(id), username: username || '', name: displayName, avatarUrl: photo_url || null });
      s.status = 'confirmed';
      s.profile = { id: saved.telegramId, name: saved.name, avatarUrl: saved.avatarUrl || null };
      auditAuth('otp_confirmed', { ip: getClientIp(req), code: s.code, telegramId: String(id) });
      res.json({ ok: true, status: 'confirmed', profile: s.profile });
    } catch (e) {
      auditAuth('otp_confirm_error', { ip: getClientIp(req), message: String(e?.message || e) });
      res.json({ ok: false, error: 'server_error', message: String(e?.message || e) });
    }
  });

  return router;
}

module.exports = { createAuthRouter };



