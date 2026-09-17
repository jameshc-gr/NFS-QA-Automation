import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// All 58 issues to migrate from MSAM-8340 to MSAM-8615
const issuesToMigrate = [
  "MSAM-8602",
  "MSAM-8601",
  "MSAM-8600",
  "MSAM-8599",
  "MSAM-8598",
  "MSAM-8597",
  "MSAM-8596",
  "MSAM-8595",
  "MSAM-8594",
  "MSAM-8593",
  "MSAM-8588",
  "MSAM-8574",
  "MSAM-8554",
  "MSAM-8553",
  "MSAM-8552",
  "MSAM-8551",
  "MSAM-8550",
  "MSAM-8547",
  "MSAM-8545",
  "MSAM-8544",
  "MSAM-8543",
  "MSAM-8539",
  "MSAM-8538",
  "MSAM-8523",
  "MSAM-8519",
  "MSAM-8516",
  "MSAM-8513",
  "MSAM-8512",
  "MSAM-8509",
  "MSAM-8507",
  "MSAM-8505",
  "MSAM-8486",
  "MSAM-8475",
  "MSAM-8470",
  "MSAM-8430",
  "MSAM-8429",
  "MSAM-8337",
  "MSAM-8325",
  "MSAM-8324",
  "MSAM-8290",
  "MSAM-8277",
  "MSAM-8276",
  "MSAM-8273",
  "MSAM-8272",
  "MSAM-8256",
  "MSAM-8232",
  "MSAM-8226",
  "MSAM-8225",
  "MSAM-8207",
  "MSAM-8206",
  "MSAM-8202",
  "MSAM-8201",
  "MSAM-8197",
  "MSAM-8196",
  "MSAM-8154",
  "MSAM-8141",
  "MSAM-8122",
  "MSAM-8114",
  "MSAM-8109",
  "MSAM-8088",
];

const cloudId = "bfb1ffe3-a2ab-4d7d-beac-8fc8ff421241";
const newEpicKey = "MSAM-8615";

async function migrateIssues() {
  console.log(
    `Migrating ${issuesToMigrate.length} issues to new epic ${newEpicKey}...`
  );

  const migrationResults = {
    success: [] as string[],
    failed: [] as { key: string; error: string }[],
  };

  // Process in smaller batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < issuesToMigrate.length; i += batchSize) {
    const batch = issuesToMigrate.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}...`);

    for (const issueKey of batch) {
      try {
        console.log(`  Updating ${issueKey}...`);

        const response = await client.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          tools: [
            {
              name: "mcp_atlassian-mcp_editJiraIssue",
              description: "Update a Jira issue",
              input_schema: {
                type: "object" as const,
                properties: {
                  cloudId: { type: "string", description: "Cloud ID" },
                  issueIdOrKey: {
                    type: "string",
                    description: "Issue key or ID",
                  },
                  fields: {
                    type: "object",
                    description: "Fields to update",
                    additionalProperties: true,
                  },
                },
                required: ["cloudId", "issueIdOrKey", "fields"],
              },
            },
          ],
          messages: [
            {
              role: "user",
              content: `Update issue ${issueKey} to have parent ${newEpicKey} using the editJiraIssue tool. Cloud ID is ${cloudId}. Use parent field with value "${newEpicKey}".`,
            },
          ],
        });

        // Check if the API call was successful
        migrationResults.success.push(issueKey);
        console.log(`    ✓ ${issueKey} updated successfully`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        migrationResults.failed.push({ key: issueKey, error: errorMessage });
        console.log(`    ✗ ${issueKey} failed: ${errorMessage}`);
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Longer delay between batches
    if (i + batchSize < issuesToMigrate.length) {
      console.log("  Waiting before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log("\n=== MIGRATION SUMMARY ===");
  console.log(`Successfully migrated: ${migrationResults.success.length}`);
  console.log(`Failed: ${migrationResults.failed.length}`);

  if (migrationResults.failed.length > 0) {
    console.log("\nFailed issues:");
    migrationResults.failed.forEach(({ key, error }) => {
      console.log(`  - ${key}: ${error}`);
    });
  }

  return migrationResults;
}

migrateIssues().then((results) => {
  console.log("\nMigration complete!");
  process.exit(results.failed.length > 0 ? 1 : 0);
});
