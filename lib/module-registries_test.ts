import { determineModuleBase, determineModuleLabel } from "./module-registries.ts";
import { assertEquals } from "https://deno.land/std@0.105.0/testing/asserts.ts";

Deno.test('gist', () => {
  const gistBase = 'https://gist.githubusercontent.com/danopia/d8b92fdbaa146133dac74a248e62d761/raw/bf5074703f24fee4c2f08577908115f2a6ffff6a';
  const gistUrl = `${gistBase}/repro.ts`;

  assertEquals(determineModuleBase(gistUrl, false), gistBase);
  assertEquals(determineModuleLabel({
    base: gistBase, fragment: '',
    deps: new Set(), depsUnversioned: new Set(),
    files: [], totalSize: 0,
  }, false), [
    "gist: danopia/d8b92fdbaa146133dac74a248e62d761",
    "  @ bf5074703f24fee4c2f08577908115f2a6ffff6a",
  ]);
})
