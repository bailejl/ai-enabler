// What a test may do to the e2e gate: declare the codes it expects, and nothing else. The object
// has no other key, so no option, flag or allow-list can be passed through it. Pure, so unit tests
// can import it without loading Playwright.

/** `expected` is the array the gate reads at the end of the test; `expect` appends to it. */
export const createExpectedCodes = (expected) => ({
  expect: (codes) => expected.push(...codes),
})
