import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const DATA = new URL("../../../data/", import.meta.url);

/** True when the gitignored third-party captures in data/fixtures are checked out. */
export const hasFixtures = existsSync(new URL("fixtures/", DATA));

/** Like `test`, but skipped when data/fixtures is absent (for example in CI, which does not ship it). */
export const fixtureTest = hasFixtures ? test : test.skip;

/** Reads a JSON file under data/. A missing fixtures file reads as empty captures and commands; `fixtureTest` skips the tests that use it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture JSON has no fixed shape; callers index it directly
export function loadData(name: string): any {
  const url = new URL(name, DATA);
  if (!existsSync(url)) {
    if (name.startsWith("fixtures/")) return { captures: {}, commands: {} };
    throw new Error(`Missing data/${name}`);
  }
  return JSON.parse(readFileSync(url, "utf8"));
}
