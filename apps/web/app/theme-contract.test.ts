import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the runtime theming contract.
 *
 * `@theme inline` compiles utilities to literal token values, which silently
 * disabled every display mode: `.bg-card` became `background-color:#fff`, so
 * redefining `--color-card` under `[data-display-mode="night"]` did nothing.
 * Night and high-contrast modes were dead for the whole of that period without
 * any test or build failing.
 */

// Comments are stripped first: this file's own prose mentions `@theme inline`
// as the thing to avoid, and that must not count as a declaration.
const css = readFileSync(join(__dirname, "globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function tokensIn(block: string): Set<string> {
  return new Set(
    [...block.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1]),
  );
}

function blockFor(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `expected ${selector} in globals.css`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open, close);
}

describe("theme contract", () => {
  it("declares the theme without `inline` so utilities reference variables", () => {
    // The whole point: `@theme inline` would bake literals into utilities and
    // make every override below unreachable.
    expect(css).not.toMatch(/@theme\s+inline/);
    expect(css).toMatch(/@theme\s*\{/);
  });

  it("defines every theme colour token in the night palette", () => {
    const theme = tokensIn(blockFor("@theme"));
    const night = tokensIn(blockFor(':root[data-display-mode="night"]'));

    expect(theme.size).toBeGreaterThan(0);
    expect([...theme].filter((token) => !night.has(token))).toEqual([]);
  });

  it("defines every theme colour token in the high-contrast palette", () => {
    const theme = tokensIn(blockFor("@theme"));
    const contrast = tokensIn(blockFor(':root[data-display-mode="contrast"]'));

    expect([...theme].filter((token) => !contrast.has(token))).toEqual([]);
  });
});
