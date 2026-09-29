// The rule engine normally runs on cron timers (every 30s / 60s). In tests we
// call its methods directly instead, so detections happen exactly when a test
// says so — never at a random moment mid-test, which would make results flaky.
jest.mock('@nestjs/schedule', () => ({
  ...jest.requireActual<typeof import('@nestjs/schedule')>('@nestjs/schedule'),
  Cron: () => () => undefined,
}));
