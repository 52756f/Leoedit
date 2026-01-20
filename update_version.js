const fs = require('fs');
const path = require('path');

// Version aus JSON lesen und erhöhen
const versionPath = path.join(__dirname, "frontend", "src", 'version.json');
const configPath = path.join(__dirname,"frontend","src",'constants.js');

const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
version.build += 1;

// Version speichern
fs.writeFileSync(versionPath, JSON.stringify(version, null, 2), 'utf8');

// Config aktualisieren
const newVersion = `${version.major}.${version.minor}.${version.patch}.${version.build}`;
let content = fs.readFileSync(configPath, 'utf8');
content = content.replace(
    /get VERSION\(\) \{ return "[^"]+"/,
    `get VERSION() { return "${newVersion}"`
);

fs.writeFileSync(configPath, content, 'utf8');
console.log(`Neue Version: ${newVersion}`);
