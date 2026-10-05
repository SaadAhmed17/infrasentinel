// Deterministic, obviously-fake configuration for automated tests.
// These are NOT real secrets: tokens signed with them only work inside tests.
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-for-production';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Nothing listens on port 9, so calls to the AI service fail immediately
// instead of reaching a real model/LLM. Tests that need AI behaviour stub it.
process.env.AI_SERVICE_URL = 'http://127.0.0.1:9';
process.env.AI_SERVICE_SHARED_SECRET = 'test-shared-secret';

// Never reach a real mail server, even when a developer's apps/api/.env
// configures one: Prisma loads that file for every variable not set here.
// Tests that need e-mail replace the MailService.
process.env.SMTP_HOST = '';
