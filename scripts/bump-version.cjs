const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function syncCargoLockVersion(lockfilePath, packageName, newVersion) {
  if (!fs.existsSync(lockfilePath)) {
    return;
  }

  const lockfile = fs.readFileSync(lockfilePath, "utf-8");
  const packageBlock = new RegExp(
    `(\\[\\[package\\]\\]\\r?\\nname = "${packageName}"\\r?\\nversion = ")([^"]+)(")`,
    "m",
  );

  if (!packageBlock.test(lockfile)) {
    console.warn(`Warning: could not find ${packageName} entry in ${path.basename(lockfilePath)}`);
    return;
  }

  const updatedLockfile = lockfile.replace(packageBlock, `$1${newVersion}$3`);
  if (updatedLockfile !== lockfile) {
    fs.writeFileSync(lockfilePath, updatedLockfile);
  }
}

// Read current version from package.json
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

// package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// src-tauri/tauri.conf.json
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");

// src-tauri/Cargo.toml
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
let cargo = fs.readFileSync(cargoPath, "utf-8");
const cargoPackageNameMatch = cargo.match(/^name = "([^"]+)"/m);
if (!cargoPackageNameMatch) {
  throw new Error(`Could not determine Cargo package name from ${cargoPath}`);
}
const cargoPackageName = cargoPackageNameMatch[1];
cargo = cargo.replace(/^version = ".*"/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoPath, cargo);

// src-tauri/Cargo.lock
const cargoLockPath = path.join(root, "src-tauri", "Cargo.lock");
syncCargoLockVersion(cargoLockPath, cargoPackageName, newVersion);

console.log(`Bumped version: ${pkg.version.replace(`${major}.${minor}.${patch + 1}`, `${major}.${minor}.${patch}`)} -> ${newVersion}`);
