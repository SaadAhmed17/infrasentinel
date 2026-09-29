// A known defect is written as a test of the CORRECT behaviour. The product
// currently violates it, so the test is expected to fail (Jest `it.failing`):
// CI stays green while the defect stays visible and linked to the defect log.
// When someone fixes the bug, this test starts passing, Jest reports that as a
// failure, and we convert it into a permanent regression test.
//
// Evidence mode: `SHOW_DEFECTS=1` runs these as ordinary tests so the real
// failure output (expected vs received) is printed for the defect report.
export function knownDefect(
  defectId: string,
  title: string,
  fn: () => Promise<void>,
  timeout?: number,
): void {
  const name = `${title} [known defect ${defectId}]`;
  if (process.env.SHOW_DEFECTS === '1') {
    it(name, fn, timeout);
  } else {
    it.failing(name, fn, timeout);
  }
}
