import { createHmac } from 'crypto';

export function signPayload(payload: Record<string, unknown>, secret: string) {
  const sanitized = { ...payload };
  delete sanitized.signature;
  delete sanitized.signatureAlg;
  return createHmac('sha256', secret).update(JSON.stringify(sanitized)).digest('hex');
}

export function verifyPayloadSignature(payload: Record<string, unknown>, secret: string) {
  const signature = payload.signature;
  if (typeof signature !== 'string') return false;
  return signPayload(payload, secret) === signature;
}
