import fs from "fs";
import path from "path";
import sharp from "sharp";
import { BUILD_ROOT, BUILD_TARGET, PROJECT_ROOT, TEMPLATES_ROOT } from "./constant";

// Run: npx tsx tools/optimize.ts [--dry-run]

const excludesFiles = [
  "17cca7b47.png"
];

function hasExtension(filePath) {
  return path.extname(filePath) !== '';
}

function hasSpecificExtension(filePath, extensions) {
  const ext = path.extname(filePath).toLowerCase();
  return extensions.includes(ext);
}

function excludeFiles(name, exts) {
  return exts.some(ext => name == ext);
}

async function main() {
  // const target = "fb-instant-games";
  const target = BUILD_TARGET;
  await optimizeImageAndImportToTemplates(target);
  // optimizeImageRemote(target);
  if (process.argv.indexOf("--dry-run") === -1) {
    await cleanEmptyFolders(path.join(getProjectRoot(), "build-templates", target, "assets"));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function cleanEmptyFolders(directoryPath) {
  console.log(`Starting empty folder clean up in: ${directoryPath}`);
  await cleanEmptyFoldersRecursively(directoryPath);
  console.log('✅ Empty folder clean up finished.');
}

//====

async function optimizeImageAndImportToTemplates(target) {
  // for assets
  const projectRoot = getProjectRoot();
  const BASE_BUILD_URL = path.join(BUILD_ROOT, target, "assets");
  const BASE_TEMPLATES_URL = path.join(TEMPLATES_ROOT, "assets");

  // Validate the build before deleting any existing template assets.
  if (!fs.existsSync(BASE_BUILD_URL) || !fs.statSync(BASE_BUILD_URL).isDirectory()) {
    throw new Error(`Build assets not found: ${BASE_BUILD_URL}. Build target "${target}" in Cocos Creator first.`);
  }
  const listBundle = fs.readdirSync(BASE_BUILD_URL, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const nativePath = path.join(BASE_BUILD_URL, entry.name, "native");
      return fs.existsSync(nativePath) && fs.statSync(nativePath).isDirectory();
    })
    .map((entry) => entry.name);
  if (listBundle.length === 0) {
    throw new Error(`No bundle native folders found in: ${BASE_BUILD_URL}. Build target "${target}" in Cocos Creator first.`);
  }
  console.log(`Project root: ${projectRoot}`);
  console.log(`Bundles: ${listBundle.join(", ")}`);
  console.log("Build assets: " + BASE_BUILD_URL);
  console.log("Template assets: " + BASE_TEMPLATES_URL);
  if (process.argv.indexOf("--dry-run") !== -1) {
    console.log("Dry run complete; no files changed.");
    return;
  }

  const exts = [".png"];
  for (let bundle of listBundle) {
    const destinationFolder = path.join(BASE_TEMPLATES_URL, bundle);
    deleteFolder(path.join(destinationFolder, "native"));
    const nativePath = path.join(BASE_BUILD_URL, bundle, "native");
    const nativeDest = path.join(BASE_TEMPLATES_URL, bundle, "native");

    copyFolderSync(nativePath, nativeDest, exts);
    console.log(`Folder ${bundle} copied successfully.`);
    const promises = [];
    optimizeImages(nativeDest, promises);
    console.log("promises : ", promises.length)
    const arrays = splitArray(promises);
    let count = 0;
    console.log(`optimize image : ${arrays.length === 0 ? 100 : 0}%`)
    for (let array of arrays) {
      await Promise.all(array.map(function (optimize) { return optimize(); }));
      count++;
      console.log(`optimize image : ${Math.floor(100 * (count / arrays.length))}%`)
    }
    console.log(`successfully optimize build.`);
  }
}

async function optimizeImageRemote(target) {
  // for remote
  const listBundle2 = ["area1", "area2"];
  const projectRoot = getProjectRoot();
  const BASE_URL = path.join(projectRoot, "bundles_original");
  const BASE_TEMPLATES_URL = path.join(projectRoot, "build-templates", target, "bundles");
  const exts = [".png", ".jpg", ".jpeg"];
  for (let bundle of listBundle2) {
    const destinationFolder = path.join(BASE_TEMPLATES_URL, bundle);
    deleteFolder(destinationFolder);
    const nativePath = path.join(BASE_URL, bundle);
    const nativeDest = path.join(BASE_TEMPLATES_URL, bundle);
    copyFolderSync(nativePath, nativeDest, exts);
    console.log(`Folder ${bundle} copied successfully.`);
    const promises = [];
    optimizeImages(nativeDest, promises);
    console.log("promises : ", promises.length)
    const arrays = splitArray(promises);
    let count = 0;
    console.log(`optimize image remote : ${Math.floor(100 * (count / arrays.length))}%`)
    for (let array of arrays) {
      await Promise.all(array.map(function (optimize) { return optimize(); }));
      count++;
      console.log(`optimize image remote : ${Math.floor(100 * (count / arrays.length))}%`)
    }
    console.log(`successfully optimize bundle remote.`);
  }
}

// Function to copy files and directories
function copyFolderSync(src, dest, exts) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath, exts);
    } else {
      // if (entry.name.length > 20) continue;
      if (exts && !hasSpecificExtension(entry.name, exts)) continue;
      if (excludeFiles(entry.name, excludesFiles)) continue;
      fs.copyFileSync(srcPath, destPath);
    }
  }
}



function optimizeImages(src, promises){
  try {
    if (fs.lstatSync(src).isFile()) {
      var sharpPromise = function () { return sharpTool(src, path.extname(src).slice(1).toLowerCase()); };
      promises.push(sharpPromise);
    } else {
      const entries = fs.readdirSync(src);
      let count = 0;
      for (let entry of entries) {
        const srcPath = path.join(src, entry);
        if (fs.lstatSync(srcPath).isFile() && /\.(jpg|jpeg|png)$/i.test(entry)) {
          const fileName = path.basename(srcPath);
          console.log("fileName : ", fileName);
          const extension = path.extname(fileName).slice(1).toLowerCase();
          var sharpPromise = function () { return sharpTool(srcPath, extension); };
          promises.push(sharpPromise);
        } else {
          optimizeImages(srcPath, promises);
        }
      }
    }
  } catch (error) {
    throw error;
  }
}

function sharpTool(inputFile, ext?) : Promise<void>{
  return new Promise((resolve, reject) => {
    sharp(inputFile)
      .toFormat(ext, { quality: 80, }) // Convert to JPEG with 80% quality
      .toBuffer()
      .then(data => {
        fs.writeFileSync(inputFile, data); // Replace the original file with the optimized one
        // console.log(`Optimized and replaced ${file}`);
        resolve();
      })
      .catch(err => {
        reject(new Error(`Error optimizing ${inputFile}: ${err.message}`));
      });
  });
}

function deleteFolder(folderPath) {
  const templateRoot = path.resolve(getProjectRoot(), "build-templates") + path.sep;
  const resolvedFolder = path.resolve(folderPath);
  if (!resolvedFolder.startsWith(templateRoot)) {
    throw new Error(`Refusing to delete outside build-templates: ${resolvedFolder}`);
  }
  fs.rmSync(resolvedFolder, { recursive: true, force: true });
  console.log(`Deleted : ${resolvedFolder}`);
}

function splitArray(inputArray, maxLength = 10) {
  const result = [];
  for (let i = 0; i < inputArray.length; i += maxLength) {
    result.push(inputArray.slice(i, i + maxLength));
  }
  return result;
}


function getProjectRoot() {
  return PROJECT_ROOT;
}
async function cleanEmptyFoldersRecursively(directoryPath) {
  try {
      // 1. Read the contents of the directory
      const contents = fs.readdirSync(directoryPath);
      let subDirFound = false;

      // 2. Process all contents: recursively clean subdirectories
      for (const item of contents) {
          const fullPath = path.join(directoryPath, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
              subDirFound = true;
              // Recursive call: try to clean the subdirectory
              const removed = await cleanEmptyFoldersRecursively(fullPath);

              // If a sub-folder was removed, the parent folder's contents have changed,
              // so we need to break and re-read the contents.
              if (removed) {
                  return cleanEmptyFoldersRecursively(directoryPath);
              }
          }
      }

      // 3. After processing all subdirectories, check if the current directory is empty
      const finalContents = fs.readdirSync(directoryPath);

      if (finalContents.length === 0) {
          // 4. Directory is empty, so delete it
          console.log(`🗑️ Deleting empty directory: ${directoryPath}`);
          // Use fs.rmdir or fs.rm (recommended for newer Node.js versions)
          fs.rmdirSync(directoryPath);
          // Or use: await fs.rm(directoryPath, { recursive: false });
          return true; // Directory was removed
      } else {
          // Directory is not empty (it has files or non-empty sub-folders)
          return false;
      }

  } catch (error) {
      // Handle errors like ENOENT (directory not found) or EPERM (permission denied)
      if (error.code === 'ENOENT') {
          return false; // Already gone or never existed
      }
      console.error(`Error processing directory ${directoryPath}:`, error.message);
      return false;
  }
}
