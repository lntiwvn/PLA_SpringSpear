import fs from "fs";
import path from "path";
import { BUILD_ROOT, BUILD_TARGET, PROJECT_NAME, VERSION_NAME } from "./constant";

// Run: npx tsx tools/change-name.ts [--dry-run]

// Comment out any network that should not be included in the output.
const NETWORKS = [
  "applovin",
  // "bigo",
  // "chartboost",
  // "common",
  "facebook",
  // "gdt",
  "google",
  // "inmobi",
  // "ironsource2025",
  // "kwai",
  // "liftoff",
  "mintegral",
  // "moloco",
  // "nefta",
  // "news_break",
  // "pangle",
  // "snapchat",
  "tiktok",
  "unity",
  // "vungle",
  // "yandex",
] as const;

function main() {
  const projectName = getRequiredConfig("PROJECT_NAME", PROJECT_NAME);
  const versionName = getRequiredConfig("VERSION_NAME", VERSION_NAME);
  if (!/^[a-zA-Z0-9_-]+$/.test(versionName) || versionName.toLowerCase() === "super-html" || versionName.toLowerCase() === BUILD_TARGET.toLowerCase()) {
    throw new Error("VERSION_NAME must be a folder name using letters, numbers, underscores or hyphens.");
  }
  var dryRun = process.argv.indexOf("--dry-run") !== -1;

  const buildRoot = BUILD_ROOT;
  const superHtmlRoot = path.join(buildRoot, "super-html");
  const outputRoot = path.join(buildRoot, versionName);

  if (!fs.existsSync(superHtmlRoot)) {
    throw new Error(`super-html folder not found: ${superHtmlRoot}`);
  }

  var copies: { source: string; name: string }[] = [];

  const channelFolders = fs
    .readdirSync(superHtmlRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      (NETWORKS as readonly string[]).includes(entry.name),
    );

  const existingChannels = new Set(
    channelFolders.map((entry) => entry.name),
  );

  for (const network of NETWORKS) {
    if (!existingChannels.has(network)) {
      console.warn(
        `Configured network folder not found: ${path.join(
          superHtmlRoot,
          network,
        )}`,
      );
    }
  }

  for (const channelFolder of channelFolders) {
    const channelName = channelFolder.name;
    const channelRoot = path.join(superHtmlRoot, channelName);

    const expectedSourceBaseName =
      `${projectName}_${channelName}`;

    const sourceFiles = fs
      .readdirSync(channelRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) =>
        isBaseNameOrVariant(
          entry.name,
          expectedSourceBaseName,
        ),
      );

    if (sourceFiles.length === 0) {
      console.warn(
        `No source file found for channel ${channelName}: ` +
        `expected ${expectedSourceBaseName}.* or ` +
        `${expectedSourceBaseName}_*.*`,
      );
      continue;
    }

    for (const file of sourceFiles) {
      const extension = path.extname(file.name);
      const actualSourceBaseName = path.basename(
        file.name,
        extension,
      );

      // Ví dụ:
      // SpingSpearPLA_x10_google           -> ""
      // SpingSpearPLA_x10_google_landscape -> "_landscape"
      // SpingSpearPLA_x10_google_portrait  -> "_portrait"
      const variantSuffix = actualSourceBaseName.slice(
        expectedSourceBaseName.length,
      );

      const sourcePath = path.join(
        channelRoot,
        file.name,
      );

      const outputFileName =
        `${versionName}_${channelName}` +
        `${variantSuffix}${extension}`;

      copies.push({ source: sourcePath, name: outputFileName });

      console.log(
        `${file.name} -> ${outputFileName}`,
      );
    }
  }
  if (copies.length === 0) {
    throw new Error("No matching super-html files found. Check PROJECT_NAME in tools/constant.ts.");
  }
  console.log("Source: " + superHtmlRoot);
  console.log("Output: " + outputRoot);
  if (dryRun) {
    console.log("Dry run complete; no files changed.");
    return;
  }
  recreateOutputFolder(outputRoot, buildRoot);
  for (var i = 0; i < copies.length; i++) {
    fs.copyFileSync(copies[i].source, path.join(outputRoot, copies[i].name));
  }
  console.log("Copied " + copies.length + " files.");
}

function recreateOutputFolder(
  outputRoot: string,
  buildRoot: string,
) {
  assertSafeOutputFolder(outputRoot, buildRoot);

  fs.rmSync(outputRoot, {
    recursive: true,
    force: true,
  });

  fs.mkdirSync(outputRoot, {
    recursive: true,
  });

  console.log(`Recreated output folder: ${outputRoot}`);
}

/**
 * Cho phép:
 * baseName.ext
 * baseName_landscape.ext
 * baseName_portrait.ext
 * và những biến thể _suffix khác.
 */
function isBaseNameOrVariant(
  fileName: string,
  expectedBaseName: string,
) {
  const extension = path.extname(fileName);
  const actualBaseName = path.basename(
    fileName,
    extension,
  );

  return (
    actualBaseName === expectedBaseName ||
    actualBaseName.startsWith(
      `${expectedBaseName}_`,
    )
  );
}

function assertSafeOutputFolder(
  outputRoot: string,
  buildRoot: string,
) {
  const resolvedOutput = path.resolve(outputRoot);
  const resolvedBuild = path.resolve(buildRoot);

  if (
    resolvedOutput === resolvedBuild ||
    !resolvedOutput.startsWith(
      `${resolvedBuild}${path.sep}`,
    )
  ) {
    throw new Error(
      `Refusing to delete unsafe output folder: ${outputRoot}`,
    );
  }
}

function getRequiredConfig(
  name: string,
  value: string,
) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(
      `${name} is empty. Please set it in tools/constant.ts.`,
    );
  }

  return trimmed;
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
