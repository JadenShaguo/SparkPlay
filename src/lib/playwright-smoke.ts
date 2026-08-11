import type { PlayableManifest, SmokeReport } from "@/types/domain";
import { escapeHtml } from "@/lib/validation";

export interface SmokeResult {
  report: SmokeReport;
  thumbnail: {
    content: Buffer | string;
    extension: "png" | "svg";
  };
}

const smokeViewport = {
  width: 390,
  height: 844
};

export async function runPlayableSmoke(input: {
  html: string;
  manifest: PlayableManifest;
}): Promise<SmokeResult> {
  const startedAt = Date.now();
  if (!isSmokeEnabled()) {
    return {
      report: {
        status: "skipped",
        issues: [],
        warnings: ["Playwright smoke 未启用，已使用 fallback thumbnail"],
        durationMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        viewport: smokeViewport,
        consoleErrors: []
      },
      thumbnail: {
        content: fallbackThumbnailSvg(input.manifest),
        extension: "svg"
      }
    };
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const consoleErrors: string[] = [];
  try {
    const page = await browser.newPage({
      viewport: smokeViewport,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.setContent(input.html, {
      waitUntil: "domcontentloaded",
      timeout: 8000
    });
    await page.waitForTimeout(250);

    const visibleSummary = await page.evaluate(() => {
      const body = document.body;
      const rect = body.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        textLength: body.innerText.trim().length,
        elementCount: document.querySelectorAll("button, canvas, input, [onclick]").length,
        canvasCount: document.querySelectorAll("canvas").length
      };
    });
    const before = await page.screenshot({ type: "png", fullPage: false });

    const interactionTested = await page.evaluate(() => {
      const target = document.querySelector("button, canvas, input, [onclick]") as HTMLElement | null;
      if (!target) return false;
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      target.click();
      return true;
    });
    await page.waitForTimeout(300);
    const after = await page.screenshot({ type: "png", fullPage: false });

    const issues: string[] = [];
    const warnings: string[] = [];
    if (visibleSummary.width < 100 || visibleSummary.height < 100) {
      issues.push("页面可视区域过小或为空");
    }
    if (visibleSummary.textLength < 4 && visibleSummary.canvasCount === 0) {
      issues.push("页面缺少可见文本或 canvas 内容");
    }
    if (visibleSummary.elementCount === 0) {
      issues.push("未找到可交互元素");
    }
    if (!interactionTested) {
      issues.push("未能执行一次点击/触摸交互");
    }
    if (consoleErrors.length > 0) {
      issues.push("页面存在 console error");
    }
    const visualChangeDetected = Buffer.compare(before, after) !== 0;
    if (!visualChangeDetected) {
      warnings.push("交互后截图未发生明显变化");
    }

    return {
      report: {
        status: issues.length === 0 ? "passed" : "failed",
        issues,
        warnings,
        durationMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        viewport: smokeViewport,
        consoleErrors,
        screenshotBytes: before.byteLength,
        interactionTested,
        visualChangeDetected
      },
      thumbnail: {
        content: before,
        extension: "png"
      }
    };
  } finally {
    await browser.close();
  }
}

export function isSmokeEnabled(): boolean {
  return process.env.SPARKPLAY_SMOKE_ENABLED === "true";
}

export function fallbackThumbnailSvg(manifest: PlayableManifest): string {
  const title = escapeHtml(manifest.title);
  const category = escapeHtml(manifest.category);
  const description = escapeHtml(manifest.description);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1200" viewBox="0 0 780 1200">
  <rect width="780" height="1200" fill="#f7f4ed"/>
  <rect x="72" y="92" width="636" height="1016" rx="48" fill="#17201a"/>
  <rect x="100" y="140" width="580" height="920" rx="34" fill="#fcfbf6"/>
  <circle cx="390" cy="270" r="92" fill="#1f6b4a"/>
  <path d="M350 222 L350 318 L442 270 Z" fill="#fcfbf6"/>
  <text x="140" y="460" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#17201a">${title}</text>
  <text x="140" y="530" font-family="Arial, sans-serif" font-size="24" fill="#607064">${category}</text>
  <foreignObject x="140" y="590" width="500" height="220">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:30px;line-height:1.35;color:#26352c;">${description}</div>
  </foreignObject>
  <rect x="140" y="890" width="500" height="92" rx="18" fill="#f0b44c"/>
  <text x="256" y="948" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#2f2410">SparkPlay</text>
</svg>`;
}
