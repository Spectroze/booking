/**
 * Suppress all browser console output in production.
 *
 * This is a runtime safety net that works alongside the compile-time
 * `removeConsole` option in next.config.ts. It ensures that even any
 * console calls injected by third-party libraries (e.g. Firebase SDK)
 * are silenced in the browser DevTools when running in production.
 *
 * Only console.error is kept so critical runtime errors remain visible
 * in server logs / crash reporters.
 */

if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV === "production"
) {
  const noop = () => {};

  console.log   = noop;
  console.debug = noop;
  console.info  = noop;
  console.warn  = noop;
  console.table = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.groupCollapsed = noop;
  console.dir   = noop;
  console.dirxml = noop;
  console.trace = noop;
  console.time  = noop;
  console.timeEnd = noop;
  console.count = noop;
  console.countReset = noop;
  console.assert = noop;
  // console.error is intentionally left untouched
}
