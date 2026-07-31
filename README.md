# Box document metadata dashboard

A minimal, runnable reference app that turns a Box folder into a filterable, sortable, editable
metadata dashboard. A setup script builds an `Invoice` metadata template, asks
[Box AI Extract](https://developer.box.com/guides/box-ai/ai-tutorials/extract-metadata-structured)
to read the fields out of each document, and writes them back as Box metadata. A single static
HTML page then embeds the enhanced
[Content Explorer metadata view (v2)](https://developer.box.com/guides/embed/ui-elements/explorer-metadata-v2)
over that metadata.

It implements the **template > extract > metadata > embed** flow. There is no backend and no build
tooling: `setup.js` runs once on your machine, and `index.html` is served as a static file.

This is the companion repository to the tutorial:
[**Build a document dashboard with the Content Explorer metadata view**](https://developer.box.com/tutorials/explorer-metadata-view).

The example uses invoices, but the same page fits contracts, claims, or anything else with a
metadata template.

## What it does

| Capability | How |
| --- | --- |
| Define the fields the dashboard shows | POST /2.0/metadata_templates/schema |
| Read those fields out of each document | POST /2.0/ai/extract_structured with a metadata template |
| Tag each file with the extracted values | POST /2.0/files/:id/metadata/enterprise/:template |
| Render the filterable metadata table | Box UI Elements Content Explorer (CDN), metadata view v2 |

## Project layout

```
box-document-metadata-dashboard/
├── setup.js           # Creates the template, extracts with Box AI, writes metadata
├── index.html         # Static page embedding the Content Explorer metadata view
├── sample-invoices/   # Five sample PDFs to test with (INV-1001 - INV-1005)
├── package.json
├── .env.example
└── .gitignore
```

## Prerequisites

- **Node.js 22 or later** (`setup.js` relies on the built-in `--env-file` flag).
- A free [Box developer account](https://account.box.com/signup/developer), or a Box Enterprise
  account with **Box AI** enabled. Consumer/Individual accounts do not work. A developer account
  includes 1,000 AI units per month, and the five sample invoices use only a small part of that.
- A Box Platform app using **User Authentication (OAuth 2.0)** in the
  [Developer Console](https://account.box.com/developers/console), with these scopes enabled under
  **Configuration** > **Application Scopes**:
  - **Read and write all files and folders stored in Box**
  - **Manage AI**
- Admin rights on the account, because `setup.js` creates an enterprise metadata template. A free
  developer account gives you this in your own Box environment.

## Setup

1. **Clone and enter the project**

   ```bash
   git clone https://github.com/box-community/box-document-metadata-dashboard.git
   cd box-document-metadata-dashboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   The [`box`](https://developer.box.com/guides/tooling/box-npm-package) package installs the Box
   Node SDK and the Box CLI as direct dependencies.

3. **Allowlist the serving origin.** In the Developer Console, go to **Configuration** >
   **CORS Domains** and add:

   ```text
   http://localhost:8080
   ```

   The metadata view calls `api.box.com` directly from the browser, so Box rejects those calls with
   `403 Forbidden` unless the exact origin (scheme, host, and port) is allowlisted. Note that
   `http://localhost:8080` and `http://127.0.0.1:8080` are different origins. Select
   **Save Changes**.

4. **Create the invoices folder.** Create a folder in Box and note its folder ID from the URL
   (`https://app.box.com/folder/123456789` > `123456789`). Upload a few invoices to it — the PDFs in
   `sample-invoices/` work, and they are billed in different currencies so the **Amount** column
   mixes them.

5. **Generate a developer token.** In the Developer Console, go to **Configuration** >
   **App Details** > **Access**, locate the **Developer Token** field, and select
   **Generate Developer Token**. Generate it last: if you change and save the app configuration
   afterwards, generate a fresh one.

   > Developer tokens expire after **60 minutes** and belong to the account you were signed in with
   > when you generated the token. If it belongs to a different user, template creation fails.

6. **Configure credentials**

   ```bash
   cp .env.example .env
   ```

   Fill in `BOX_DEVELOPER_TOKEN` from step 5 and `BOX_FOLDER_ID` from step 4.

   > **Never commit `.env`.** It is already in `.gitignore`.

## Run

1. **Tag the documents with Box AI**

   ```bash
   npm run setup
   ```

   Extraction takes a few seconds per document. The script prints what Box AI read from each file,
   then the two values the page needs:

   ```text
   Created template 'invoice'
     Tagged INV-1001.pdf: {"vendor":"Acme Solutions Inc.","invoiceNumber":"INV-1001","amount":1250,"status":"Paid"}
     Tagged INV-1002.pdf: {"vendor":"Acme Solutions Inc.","invoiceNumber":"INV-1002","amount":3480.5,"status":"Pending"}

   --- Paste these into index.html ---
   FOLDER_ID     = 987654321
   METADATA_FROM = enterprise_123456.invoice
   ```

2. **Configure the page.** Open `index.html` and replace the three placeholders at the top of the
   script: `ACCESS_TOKEN` with your developer token, and `FOLDER_ID` and `METADATA_FROM` with the
   values the script printed.

3. **Serve the page**

   ```bash
   npm run serve
   ```

   Serve it over HTTP so the origin matches your CORS allowlist — opening the file directly with a
   `file://` URL does not work. If port 8080 is taken, `serve` starts on a different port and prints
   that address instead; a different port is a different origin, so allowlist whichever you use.

4. **Explore.** Go to <http://localhost:8080>. From there you can filter with the chips in the
   action bar, sort by selecting a column header, toggle between list and grid layouts, and select a
   row then **Metadata** > **Edit** to change values in the side panel. Edits are written straight
   back to Box metadata.

## How it works

1. `setup.js` creates the `Invoice` metadata template in the `enterprise` scope, or reuses it if it
   already exists. The API returns the scope as `enterprise_123456`, where the number is your
   enterprise ID, so the script prints the full `scope.templateKey` rather than hard-coding a
   prefix.
2. For each file in the folder, it calls Box AI structured extraction, passing `metadataTemplate`
   instead of an explicit `fields` array. The template doubles as the extraction schema, so the
   response already matches the field keys and types the metadata view expects.
3. It filters out empty values before writing, because a metadata instance rejects them, and then
   attaches the result to the file.
4. `index.html` runs a metadata query scoped to the folder and hands the fully qualified field IDs
   (`metadata.<scope>.<templateKey>.<field>`) to the Content Explorer as columns, with
   `metadataViewV2` enabled.

## Security notes

- The developer token in `index.html` is for prototyping only. Every UI Element needs a token in the
  browser, so in production mint a short-lived
  [downscoped token](https://developer.box.com/guides/authentication/tokens/downscope) server-side
  and never ship app credentials or a full-privilege token to the client. See
  [UI Elements scopes](https://developer.box.com/guides/embed/ui-elements/scopes).
- Keep `.env` out of version control.
- Allowlist only the origins you actually serve from.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| 403 Forbidden on calls to api.box.com | The serving origin is not on the CORS allowlist. Add the exact origin under **CORS Domains**, save, wait a minute, and reload. Confirm the port your server printed. |
| 401 Unauthorized | The developer token expired after 60 minutes, or was pasted incorrectly. Generate a fresh one and update both `.env` and `index.html`. |
| You don't have permission to create metadata templates | The token belongs to a non-admin user. Sign in with your developer account, generate a fresh token, and rerun. |
| 409 tuple_already_exists on every file | The files already carry the template, which happens on a second run. The existing values still show in the dashboard. To re-extract, remove the metadata instance first. |
| Box AI returned no fields, or the wrong ones | Check the file against the [supported file formats](https://developer.box.com/guides/box-ai/ai-tutorials/extract-metadata-structured#supported-file-formats). If it is readable but the values are off, add a `description` to each template field, or switch to an explicit `fields` array with a `prompt` per field. |
| The table is empty | `METADATA_FROM` must match the `scope.templateKey` the script printed, and `FOLDER_ID` must be the folder holding the tagged files. |
| Nothing renders, or the console shows `Box is not defined` | The CDN scripts did not load, or the version is too old. The metadata view v2 requires Box UI Elements **v24.0.0 or higher**. |

## License

MIT
