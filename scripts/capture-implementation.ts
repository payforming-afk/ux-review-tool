import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

interface CaptureOptions {
  url: string;
  output: string;
  viewportWidth: number;
  viewportHeight: number;
  fullPage: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.url) {
    throw new Error("Missing --url argument. Example: npm run capture -- --url http://localhost:3000");
  }

  const absoluteOutput = path.isAbsolute(options.output)
    ? options.output
    : path.join(process.cwd(), options.output);

  await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: {
      width: options.viewportWidth,
      height: options.viewportHeight
    }
  });

  try {
    const page = await context.newPage();
    await page.goto(options.url, { waitUntil: "networkidle" });
    await page.screenshot({ path: absoluteOutput, fullPage: options.fullPage });
    console.log(`Screenshot saved: ${absoluteOutput}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

function parseArgs(args: string[]): CaptureOptions {
  const argMap = new Map<string, string>();

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (!current.startsWith("--")) {
      continue;
    }

    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      argMap.set(current, "true");
      continue;
    }

    argMap.set(current, next);
    i += 1;
  }

  return {
    url: argMap.get("--url") ?? "",
    output: argMap.get("--output") ?? "public/uploads/captured-implementation.png",
    viewportWidth: Number(argMap.get("--width") ?? 1440),
    viewportHeight: Number(argMap.get("--height") ?? 1080),
    fullPage: (argMap.get("--fullPage") ?? "true") === "true"
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
