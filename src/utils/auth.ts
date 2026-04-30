function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkBasicAuth(authHeader: string | undefined | null, expectedPassword: string): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  try {
    const decoded = atob(authHeader.slice(6).trim());
    const idx = decoded.indexOf(':');
    if (idx === -1) return false;
    return timingSafeEqual(decoded.slice(idx + 1), expectedPassword);
  } catch {
    return false;
  }
}
