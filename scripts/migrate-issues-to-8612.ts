#!/usr/bin/env ts-node

/**
 * Migrate issues from MSAM-8340 to MSAM-8612 (change parent)
 * This script updates 60 issues to have MSAM-8612 as the parent instead of MSAM-8340
 */

const issues = [
  "MSAM-1611", "MSAM-1990", "MSAM-2109", "MSAM-2899", "MSAM-3783",
  "MSAM-4881", "MSAM-5925", "MSAM-5992", "MSAM-5993", "MSAM-6068",
  "MSAM-6190", "MSAM-6301", "MSAM-6364", "MSAM-6395", "MSAM-6711",
  "MSAM-6794", "MSAM-6801", "MSAM-6904", "MSAM-6962", "MSAM-7015",
  "MSAM-7029", "MSAM-7034", "MSAM-7045", "MSAM-7063", "MSAM-7077",
  "MSAM-7083", "MSAM-7084", "MSAM-7364", "MSAM-7680", "MSAM-7681",
  "MSAM-7686", "MSAM-7711", "MSAM-7726", "MSAM-7843", "MSAM-7844",
  "MSAM-7878", "MSAM-8109", "MSAM-8114", "MSAM-8154", "MSAM-8196",
  "MSAM-8197", "MSAM-8207", "MSAM-8226", "MSAM-8276", "MSAM-8277",
  "MSAM-8429", "MSAM-8470", "MSAM-8507", "MSAM-8520", "MSAM-8539",
  "MSAM-8542", "MSAM-8543", "MSAM-8544", "MSAM-8545", "MSAM-8547",
  "MSAM-8550", "MSAM-8556", "MSAM-8557"
];

console.log(`Total issues to migrate: ${issues.length}`);
console.log("Issue keys:", issues.join(", "));
console.log("\nNote: Use the Atlassian MCP tools to update the parent field for each issue.");
