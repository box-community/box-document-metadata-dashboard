const { BoxClient, BoxDeveloperTokenAuth } = require("box/sdk");

const ACCESS_TOKEN = process.env.BOX_DEVELOPER_TOKEN;
const FOLDER_ID = process.env.BOX_FOLDER_ID;
const TEMPLATE_KEY = "invoice";

async function main() {
  if (!ACCESS_TOKEN || !FOLDER_ID) {
    throw new Error("Set BOX_DEVELOPER_TOKEN and BOX_FOLDER_ID in .env.");
  }

  const client = new BoxClient({
    auth: new BoxDeveloperTokenAuth({ token: ACCESS_TOKEN }),
  });

  // 1. Create the Invoice metadata template, or reuse it if it already exists.
  let template;
  try {
    template = await client.metadataTemplates.createMetadataTemplate({
      scope: "enterprise",
      displayName: "Invoice",
      templateKey: TEMPLATE_KEY,
      fields: [
        { type: "string", key: "vendor", displayName: "Vendor" },
        { type: "string", key: "invoiceNumber", displayName: "Invoice Number" },
        { type: "float", key: "amount", displayName: "Amount" },
        {
          type: "enum",
          key: "status",
          displayName: "Status",
          options: [{ key: "Paid" }, { key: "Pending" }, { key: "Overdue" }],
        },
      ],
    });
    console.log(`Created template '${template.templateKey}'`);
  } catch {
    template = await client.metadataTemplates.getMetadataTemplate(
      "enterprise",
      TEMPLATE_KEY
    );
    console.log(`Template '${template.templateKey}' already exists, reusing it.`);
  }

  const scope = template.scope; // for example, "enterprise_123456"

  // 2. Read the files already in your folder. This returns the first page
  // only, which is 100 items unless you pass a larger limit.
  const items = await client.folders.getFolderItems(FOLDER_ID);
  const files = items.entries.filter((entry) => entry.type === "file");
  if (files.length === 0) {
    throw new Error(
      `Folder ${FOLDER_ID} has no files. Add a few invoices and run again.`
    );
  }

  // 3. Extract the template fields from each document with Box AI, then
  // write them back as metadata. Box AI takes one file per request.
  for (const file of files) {
    let extracted;
    try {
      const response = await client.ai.createAiExtractStructured({
        items: [{ id: file.id, type: "file" }],
        metadataTemplate: {
          templateKey: TEMPLATE_KEY,
          type: "metadata_template",
          scope: scope,
        },
      });
      extracted = response.answer;
    } catch (error) {
      console.log(`  Skipped ${file.name}: extraction failed (${error.message})`);
      continue;
    }

    // Keep only the fields Box AI actually read, so the metadata request
    // doesn't carry empty values.
    const metadata = Object.fromEntries(
      Object.entries(extracted).filter(
        ([, value]) => value !== null && value !== ""
      )
    );

    if (Object.keys(metadata).length === 0) {
      console.log(`  Skipped ${file.name}: no fields found.`);
      continue;
    }

    try {
      await client.fileMetadata.createFileMetadataById(
        file.id,
        "enterprise",
        TEMPLATE_KEY,
        metadata
      );
      console.log(`  Tagged ${file.name}: ${JSON.stringify(metadata)}`);
    } catch (error) {
      console.log(`  Skipped ${file.name}: ${error.message}`);
    }
  }

  // 4. Print the values to paste into index.html.
  console.log("\n--- Paste these into index.html ---");
  console.log(`FOLDER_ID     = ${FOLDER_ID}`);
  console.log(`METADATA_FROM = ${scope}.${TEMPLATE_KEY}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
