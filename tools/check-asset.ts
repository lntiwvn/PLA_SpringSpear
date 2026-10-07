import fs from "fs";
import path from "path";
import { BUILD_ROOT, PROJECT_ROOT } from "./constant";

type AssetSizeInfo = {
  bundle: string;
  extension: string;
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  sizeKB: number;
  sizeMB: number;
};

const CONFIG = {
  // Thư mục build/<target>/assets cần kiểm tra.
  target: "web-mobile",

  // Chỉ lấy file có dung lượng LỚN HƠN giá trị này.
  minSizeKB: 50,

  // [] = quét toàn bộ assets. Ví dụ: ["main", "items"].
  bundles: [] as string[],

  // [] = tất cả định dạng. Ví dụ: [".png", ".jpg", ".bin"].
  extensions: [] as string[],

  // Giới hạn số dòng in ra terminal. 0 = in toàn bộ.
  maxConsoleRows: 200,

  // Xuất thêm báo cáo JSON và CSV ở thư mục gốc dự án.
  writeReportFiles: true,
  reportFolderName: "build-size-reports",
};

function main(): void {
  const projectRoot = getProjectRoot();
  const target = getStringArg("--target", CONFIG.target);
  const minSizeKB = getNumberArg("--min-kb", CONFIG.minSizeKB);
  const bundles = getListArg("--bundles", CONFIG.bundles);
  const extensions = normalizeExtensions(
    getListArg("--ext", CONFIG.extensions),
  );
  const assetsRoot = path.join(BUILD_ROOT, target, "assets");

  if (!Number.isFinite(minSizeKB) || minSizeKB < 0) {
    throw new Error(`minSizeKB không hợp lệ: ${minSizeKB}`);
  }

  if (!fs.existsSync(assetsRoot)) {
    throw new Error(
      `Không tìm thấy thư mục build: ${assetsRoot}\n` +
        `Hãy build target "${target}" trước khi chạy tool.`,
    );
  }

  const scanRoots = getScanRoots(assetsRoot, bundles);
  const allFiles: AssetSizeInfo[] = [];

  for (const scanRoot of scanRoots) {
    scanDirectory(scanRoot, assetsRoot, extensions, allFiles);
  }

  const minSizeBytes = minSizeKB * 1024;
  const largeFiles = allFiles
    .filter((file) => file.sizeBytes > minSizeBytes)
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  printResult({
    target,
    assetsRoot,
    minSizeKB,
    bundles,
    extensions,
    allFiles,
    largeFiles,
  });

  if (CONFIG.writeReportFiles) {
    writeReports(projectRoot, target, minSizeKB, allFiles, largeFiles);
  }
}

function getScanRoots(assetsRoot: string, bundles: string[]): string[] {
  if (bundles.length === 0) {
    return [assetsRoot];
  }

  const roots: string[] = [];
  for (const bundle of bundles) {
    const bundlePath = path.join(assetsRoot, bundle);
    if (!fs.existsSync(bundlePath)) {
      console.warn(`⚠️ Bỏ qua bundle không tồn tại: ${bundlePath}`);
      continue;
    }
    roots.push(bundlePath);
  }

  if (roots.length === 0) {
    throw new Error("Không có bundle hợp lệ để quét.");
  }

  return roots;
}

function scanDirectory(
  directoryPath: string,
  assetsRoot: string,
  extensions: string[],
  result: AssetSizeInfo[],
): void {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(absolutePath, assetsRoot, extensions, result);
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase() || "(no extension)";
    if (
      extensions.length > 0 &&
      !extensions.includes(extension.toLowerCase())
    ) {
      continue;
    }

    const stats = fs.statSync(absolutePath);
    const relativePath = toForwardSlashes(path.relative(assetsRoot, absolutePath));
    const bundle = relativePath.split("/")[0] || "(assets root)";

    result.push({
      bundle,
      extension,
      relativePath,
      absolutePath,
      sizeBytes: stats.size,
      sizeKB: round(stats.size / 1024, 2),
      sizeMB: round(stats.size / 1024 / 1024, 3),
    });
  }
}

function printResult(options: {
  target: string;
  assetsRoot: string;
  minSizeKB: number;
  bundles: string[];
  extensions: string[];
  allFiles: AssetSizeInfo[];
  largeFiles: AssetSizeInfo[];
}): void {
  const {
    target,
    assetsRoot,
    minSizeKB,
    bundles,
    extensions,
    allFiles,
    largeFiles,
  } = options;

  const totalBytes = sumBytes(allFiles);
  const largeFileBytes = sumBytes(largeFiles);
  const rows =
    CONFIG.maxConsoleRows > 0
      ? largeFiles.slice(0, CONFIG.maxConsoleRows)
      : largeFiles;

  console.log("\n===== BUILD ASSET SIZE REPORT =====");
  console.log(`Target       : ${target}`);
  console.log(`Assets root  : ${assetsRoot}`);
  console.log(`Threshold    : > ${minSizeKB} KB`);
  console.log(`Bundles      : ${bundles.length ? bundles.join(", ") : "all"}`);
  console.log(
    `Extensions   : ${extensions.length ? extensions.join(", ") : "all"}`,
  );
  console.log(`Scanned      : ${allFiles.length} files (${formatBytes(totalBytes)})`);
  console.log(
    `Matched      : ${largeFiles.length} files (${formatBytes(largeFileBytes)})`,
  );

  if (largeFiles.length === 0) {
    console.log("✅ Không có file nào vượt quá ngưỡng đã cấu hình.");
    return;
  }

  console.table(
    rows.map((file, index) => ({
      "#": index + 1,
      Bundle: file.bundle,
      Type: file.extension,
      KB: file.sizeKB,
      MB: file.sizeMB,
      Path: file.relativePath,
    })),
  );

  if (rows.length < largeFiles.length) {
    console.log(
      `Terminal chỉ hiển thị ${rows.length}/${largeFiles.length} file. ` +
        "Báo cáo JSON/CSV vẫn chứa đầy đủ.",
    );
  }
}

function writeReports(
  projectRoot: string,
  target: string,
  minSizeKB: number,
  allFiles: AssetSizeInfo[],
  largeFiles: AssetSizeInfo[],
): void {
  const reportDirectory = path.join(projectRoot, CONFIG.reportFolderName);
  fs.mkdirSync(reportDirectory, { recursive: true });

  const timestamp = createTimestamp();
  const baseName = `asset-size-${target}-over-${minSizeKB}kb-${timestamp}`;
  const jsonPath = path.join(reportDirectory, `${baseName}.json`);
  const csvPath = path.join(reportDirectory, `${baseName}.csv`);

  const jsonData = {
    generatedAt: new Date().toISOString(),
    target,
    thresholdKB: minSizeKB,
    scannedFileCount: allFiles.length,
    scannedSizeBytes: sumBytes(allFiles),
    matchedFileCount: largeFiles.length,
    matchedSizeBytes: sumBytes(largeFiles),
    files: largeFiles,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), "utf8");
  fs.writeFileSync(csvPath, createCsv(largeFiles), "utf8");

  console.log(`\n✅ JSON report: ${jsonPath}`);
  console.log(`✅ CSV report : ${csvPath}`);
}

function createCsv(files: AssetSizeInfo[]): string {
  const header = [
    "rank",
    "bundle",
    "extension",
    "size_bytes",
    "size_kb",
    "size_mb",
    "relative_path",
    "absolute_path",
  ];

  const rows = files.map((file, index) => [
    index + 1,
    file.bundle,
    file.extension,
    file.sizeBytes,
    file.sizeKB,
    file.sizeMB,
    file.relativePath,
    file.absolutePath,
  ]);

  // BOM giúp Excel trên Windows nhận UTF-8 chính xác.
  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")}`;
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeExtensions(extensions: string[]): string[] {
  return extensions.map((extension) => {
    const normalized = extension.trim().toLowerCase();
    if (!normalized) return normalized;
    return normalized.startsWith(".") ? normalized : `.${normalized}`;
  });
}

function getStringArg(name: string, fallback: string): string {
  const value = getRawArg(name);
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function getNumberArg(name: string, fallback: number): number {
  const value = getRawArg(name);
  if (value === undefined || value.trim() === "") return fallback;
  return Number(value);
}

function getListArg(name: string, fallback: string[]): string[] {
  const value = getRawArg(name);
  if (value === undefined) return fallback;
  if (value.trim() === "") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRawArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return argument?.slice(prefix.length);
}

function getProjectRoot(): string {
  return PROJECT_ROOT;
}

function sumBytes(files: AssetSizeInfo[]): number {
  return files.reduce((total, file) => total + file.sizeBytes, 0);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${round(bytes / 1024, 2)} KB`;
  if (bytes < 1024 ** 3) return `${round(bytes / 1024 ** 2, 2)} MB`;
  return `${round(bytes / 1024 ** 3, 2)} GB`;
}

function round(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function toForwardSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

function createTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

try {
  main();
} catch (error) {
  console.error("❌ Check build asset size failed:", error);
  process.exitCode = 1;
}
