// QR tokens: HMAC-signed "eventId.userId" so a code can't be forged by guessing IDs.
const crypto = require('crypto');
const QRCode = require('qrcode');

const SECRET = process.env.QR_SECRET || 'ccs-orghub-qr-secret';

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 12);
}

function makeToken(eventId, userId) {
  const payload = `${eventId}.${userId}`;
  return `${payload}.${sign(payload)}`;
}

// Returns { eventId, userId } or null
function verifyToken(token) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) return null;
  const [eventId, userId, sig] = parts;
  const expected = sign(`${eventId}.${userId}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { eventId, userId };
}

function toDataUrl(token) {
  return QRCode.toDataURL(token, { margin: 1, width: 240 });
}

module.exports = { makeToken, verifyToken, toDataUrl };
