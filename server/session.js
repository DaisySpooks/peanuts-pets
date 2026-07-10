import crypto from 'node:crypto'

// Stateless signed session: base64url(payload) + "." + HMAC-SHA256(payload, SESSION_SECRET).
// No server-side session store — the cookie itself is the session, and the
// signature makes it tamper-evident. Only the minimal identity fields the
// caller passes in are ever included; never put access/refresh tokens here.

function base64UrlEncode(input) {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

export function createSessionCookieValue(sessionData, secret) {
  const payloadB64 = base64UrlEncode(JSON.stringify(sessionData))
  const signature = sign(payloadB64, secret)
  return `${payloadB64}.${signature}`
}

export function verifySessionCookieValue(cookieValue, secret) {
  if (!cookieValue || typeof cookieValue !== 'string') return null
  const separatorIndex = cookieValue.lastIndexOf('.')
  if (separatorIndex === -1) return null

  const payloadB64 = cookieValue.slice(0, separatorIndex)
  const signature = cookieValue.slice(separatorIndex + 1)
  const expectedSignature = sign(payloadB64, secret)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    return JSON.parse(base64UrlDecode(payloadB64))
  } catch {
    return null
  }
}
