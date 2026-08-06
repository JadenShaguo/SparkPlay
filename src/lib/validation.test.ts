import { describe, expect, it } from "vitest";
import { validateHtml } from "@/lib/validation";

describe("validateHtml", () => {
  it("accepts a self contained playable html", () => {
    const report = validateHtml(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width" /></head>
<body><button id="b">Play</button><script>document.getElementById("b").addEventListener("click",()=>{})</script></body></html>`);

    expect(report.valid).toBe(true);
  });

  it("blocks external scripts and network calls", () => {
    const report = validateHtml(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width" /></head>
<body><script src="https://example.com/a.js"></script><script>fetch("/x")</script></body></html>`);

    expect(report.valid).toBe(false);
    expect(report.issues.join(" ")).toContain("外部脚本");
    expect(report.issues.join(" ")).toContain("fetch");
  });
});
