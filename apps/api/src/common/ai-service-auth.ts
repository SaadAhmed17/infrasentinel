// The AI service only accepts requests that carry this shared secret, so
// nothing but this API can read anomaly scores or query incidents through it.
// AI_SERVICE_TOKEN must have the same value in apps/api/.env and
// apps/ai-service/.env.
export function aiServiceAuthHeaders(): Record<string, string> {
  const token = process.env.AI_SERVICE_TOKEN;
  return token ? { 'X-Service-Token': token } : {};
}
