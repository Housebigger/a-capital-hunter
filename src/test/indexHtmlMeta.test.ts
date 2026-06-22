import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");

describe("index.html SEO / share meta", () => {
  const patterns: ReadonlyArray<readonly [string, RegExp]> = [
    ["title", /<title>[^<]*A Capital Hunter[^<]*<\/title>/],
    ["description", /<meta name="description" content="[^"]{20,}"/],
    ["theme-color", /<meta name="theme-color" content="#10151b"/],
    ["canonical", /<link rel="canonical" href="https:\/\/housebigger\.github\.io\/a-capital-hunter\/"/],
    ["icon (base-relative)", /<link rel="icon"[^>]*href="%BASE_URL%favicon\.svg"/],
    ["og:title", /<meta property="og:title" content="[^"]+"/],
    ["og:description", /<meta property="og:description" content="[^"]+"/],
    ["og:url", /<meta property="og:url" content="https:\/\/housebigger\.github\.io\/a-capital-hunter\/"/],
    ["og:image (absolute)", /<meta property="og:image" content="https:\/\/housebigger\.github\.io\/a-capital-hunter\/og-image\.[a-z]+"/],
    ["og:image:width", /<meta property="og:image:width" content="1200"/],
    ["twitter:card", /<meta name="twitter:card" content="summary_large_image"/],
    ["twitter:image (absolute)", /<meta name="twitter:image" content="https:\/\/housebigger\.github\.io\/a-capital-hunter\/og-image\.[a-z]+"/],
  ];
  it.each(patterns)("has %s", (_label, re) => {
    expect(html).toMatch(re);
  });
});
