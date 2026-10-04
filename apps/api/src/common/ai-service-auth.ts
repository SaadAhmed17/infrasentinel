// The AI service only accepts requests that carry this shared secret, so
// nothing but this API can read anomaly scores or query incidents through it.
// AI_SERVICE_SHARED_SECRET must have the same value in apps/api/.env and
// apps/ai-service/.env. Names match the main branch.
export function aiServiceAuthHeaders(): Record<string, string> {
  const secret = process.env.AI_SERVICE_SHARED_SECRET;
  return secret ? { 'x-internal-secret': secret } : {};
}
