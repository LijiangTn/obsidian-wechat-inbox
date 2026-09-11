<div align="center">
  <img src="logo.png" alt="WeChat Inbox logo" width="240">

  <h1>WeChat Inbox</h1>

  <p>
    <strong>Turn WeChat File Transfer Assistant into a local-first Obsidian knowledge inbox.</strong>
  </p>

  <p>
    Capture text, images, and files from WeChat into daily Markdown notes and attachment folders,
    so temporary messages become searchable, organized, and reusable knowledge.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Obsidian-Plugin-7C3AED?style=flat-square&logo=obsidian&logoColor=white" alt="Obsidian Plugin">
    <img src="https://img.shields.io/badge/Local--first-Privacy%20friendly-16A34A?style=flat-square" alt="Local-first">
    <img src="https://img.shields.io/badge/Output-Markdown%20%26%20Attachments-2563EB?style=flat-square" alt="Markdown and attachments">
    <img src="https://img.shields.io/badge/License-MIT-black?style=flat-square" alt="MIT License">
  </p>
  <p align="center">
    <a href="README.md"><img src="https://img.shields.io/badge/lang-English-blue?style=flat-square" alt="English"></a>
    <a href="docs/README.md"><img src="https://img.shields.io/badge/lang-中文-red?style=flat-square" alt="中文"></a>
  </p>

</div>

---

> [!IMPORTANT]
> This plugin must be used together with **Weave**:
> <https://github.com/LijiangTn/Weave>
>
> After installing this plugin, download and start the Weave server so the plugin can fetch the QR code, sync messages, and download attachments.

---

## Preview

<div align="center">
  <img src="docs/demo-image1.png" alt="WeChat Inbox demo screenshot 1" width="48%">
  <img src="docs/demo-image2.png" alt="WeChat Inbox demo screenshot 2" width="48%">
</div>

<div align="center">
  Plugin sidebar preview: QR-code login, connection status, message log, and inbox actions.
</div>

---

## Why this exists

Many people send quick notes and files to WeChat's "File Transfer Assistant" first, but that content usually stays buried in chat history:

- Hard to archive
- Hard to search
- Hard to feed into long-term knowledge workflows
- Painful to copy into a note system by hand

`WeChat Inbox` turns that high-frequency but scattered input path into a stable Obsidian inbox.

---

## Overview

`WeChat Inbox` is an Obsidian community plugin that syncs content from WeChat's "File Transfer Assistant" into your knowledge base.

It focuses on three things:

- A clear inbox view, commands, and settings inside Obsidian
- Pulling messages from the local sync service Weave, with deduplication, classification, and state tracking
- Turning text, images, and files into Markdown notes and attachment folders organized by day

The plugin does not implement the WeChat protocol or talk to WeChat servers directly. Its job is to act as the Obsidian-side inbox client and connect the existing local sync capability into your knowledge workflow.

---

## Highlights

- **Local-first**: data lives in your local Vault and local sync service by default
- **Daily capture**: writes to `YYYY-MM-DD.md`, so the inbox is naturally archivable
- **Multiple content types**: handles text, images, and arbitrary files
- **Idempotent processing**: two-layer deduplication based on `message_id` and `lastUpdateId`
- **Readable index**: maintains a human-readable `message-index.md`
- **Automation-friendly**: exposes a stable query interface via `app.plugins.plugins["wechat-inbox"].api`

---

## What it does not do

To keep the scope clear, this plugin does not handle:

- Parsing the WeChat protocol
- Emulating or taking over the WeChat client
- Uploading data to the cloud
- Executing remote scripts
- Built-in AI processing in Phase 1

---

## How it works

The end-to-end flow:

1. The local sync service handles login, message polling, and file fetching.
2. `WeChat Inbox` polls the local HTTP API on a timer.
3. The plugin deduplicates, classifies, error-handles, and tracks state for each message.
4. Text is written into the daily Markdown file; attachments go into the attachment folder under the day's directory.
5. The plugin maintains the message index and runtime state, so processing resumes correctly after a restart.

Default directory layout:

```text
WeChat Inbox/
├── 2026/
│   └── 09/
│       └── 09/
│           ├── 2026-09-09.md
│           └── attachments/
│               ├── FastAPI最佳实践.pdf
│               └── img_6695653967305283517.jpg
└── _system/
    └── message-index.md
```

---

## Privacy and security

This project runs locally by default:

- No WeChat messages, files, or account data are uploaded
- No Vault contents are sent to third-party services
- No remote code execution is introduced
- All persisted data lives only in the Vault and the plugin's local data file

You are still responsible for how you deploy the local sync service, the ports it exposes, and the security of the device that hosts your Vault.

---

## Requirements

- Obsidian `1.7.2` or later
- A running local sync service: [`Weave`](https://github.com/LijiangTn/Weave)
- Default endpoint: `http://127.0.0.1:8081`
- Node.js 18+ (only required when building from source)

### Server dependency

This plugin is not a standalone WeChat protocol implementation and requires `Weave`:

- GitHub: <https://github.com/LijiangTn/Weave>
- Default endpoint: `http://127.0.0.1:8081`

Recommended setup order:

1. Download and start `Weave`
2. Confirm `http://127.0.0.1:8081/api/v1/health` is reachable
3. Open the Obsidian plugin and scan the QR code to log in

---

## Installation

### Manual install

1. Create `.obsidian/plugins/wechat-inbox/` inside the target Vault
2. Download the following files from [Releases](../../releases):
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. Drop them into `.obsidian/plugins/wechat-inbox/`
4. Open Obsidian and go to **Settings → Community plugins**
5. Enable **WeChat Inbox**

### Install with BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add this repository in BRAT
3. Let BRAT install and update the plugin

### Build from source

```bash
git clone <this-repo>
cd obsidian-wechat-inbox
npm install
npm run build
```

After the build completes, copy `main.js`, `manifest.json`, and `styles.css` to:

```text
<vault>/.obsidian/plugins/wechat-inbox/
```

---

## Configuration

Open **Settings → WeChat Inbox** in Obsidian:

| Setting | Default | Description |
|---|---|---|
| Worker URL | `http://127.0.0.1:8081` | HTTP endpoint of the local sync service [Weave](https://github.com/LijiangTn/Weave) |
| Inbox folder | `WeChat Inbox` | Root folder for the inbox inside the Vault |
| Attachments folder | `attachments` | Subfolder name inside each day's directory |
| Layer by date | `ON` | Organize files as `year/month/day` |
| Auto-write Markdown | `ON` | When off, only the offset advances and nothing is written to the Vault |
| Auto-connect on launch | `ON` | Start polling as soon as the plugin loads |
| Poll interval (ms) | `2000` | Interval for polling messages; minimum `500` |

Setting changes take effect immediately on the running plugin instance. For example, changing the endpoint switches the connection to the new target right away.

---

## Usage

1. Click the message icon in the left ribbon, or run **Open WeChat Inbox** from the command palette
2. If `Weave` is not running yet, follow the prompt at the bottom of the UI to open the GitHub repo and start the server
3. A QR code appears in the right sidebar
4. Scan it with WeChat on your phone and confirm the login
5. Once the status changes to "Connected", anything you send to "File Transfer Assistant" is synced automatically

---

## View and commands

### Sidebar view

The right sidebar shows:

- Current connection status
- Today's and total message counts
- Recent message log
- Recent errors
- Current endpoint and inbox folder
- Common actions such as refresh QR, re-poll, and open inbox folder

### Command palette

| Command | Description |
|---|---|
| Open WeChat Inbox | Open or focus the right-sidebar inbox view |
| Refresh WeChat QR code | Fetch a fresh login QR code immediately |
| Re-poll messages | Reset the sync cursor and re-fetch unprocessed updates from the local service |
| Process all messages (clear processed list) | Clear the dedup records and reprocess from scratch; useful for troubleshooting or rebuilding state |

---

## Data layout

After the plugin runs, it maintains three kinds of data in the Vault and the plugin data directory:

```text
<vault>/
├── WeChat Inbox/
│   ├── 2026/
│   │   └── 09/
│   │       └── 09/
│   │           ├── 2026-09-09.md
│   │           └── attachments/
│   └── _system/
│       └── message-index.md
└── .obsidian/plugins/wechat-inbox/
    └── data.json
```

Details:

- `YYYY-MM-DD.md`: that day's message body, ready for reading and downstream knowledge processing
- `message-index.md`: human-readable message index, including `msg_id`, `update_id`, and the date-file reference
- `data.json`: plugin runtime state, including `processedMessageIds` and `lastUpdateId`

To keep each daily file clean, `msg_id` and `update_id` are not written into the day's body file itself.

---

## Public API

The plugin exposes a public API on `app.plugins.plugins["wechat-inbox"].api`:

```ts
const plugin = app.plugins.plugins["wechat-inbox"];

const recent = plugin.api.getRecentMessages(50);
const indexPath = plugin.api.getMessageIndexPath();
const inboxFolder = plugin.api.getInboxFolder();
const status = plugin.api.getConnectionStatus();
```

Available methods:

- Recent message list
- Message index file path
- Current inbox root folder
- Current connection status

Full type definitions live in `src/api.ts`.

---

## FAQ

### The QR code shows up but login never succeeds

- Make sure [Weave](https://github.com/LijiangTn/Weave) is running
- Check that the endpoint in the plugin settings is correct
- Confirm you tapped "Log in" on your phone after scanning

If you are using the default local backend, try the status endpoint first:

```bash
curl http://127.0.0.1:8081/api/v1/wechat/login/status
```

### The view shows "Connected" but nothing is written to the Vault

- Confirm **Auto-write Markdown** is enabled
- Check that [Weave](https://github.com/LijiangTn/Weave) has actually received the messages
- Open the Obsidian developer console for error logs

```bash
curl "http://127.0.0.1:8081/api/v1/messages?source=wechat&page=1&size=5"
```

### I suspect duplicate imports after restarting Obsidian

In normal operation this should not happen, because the plugin persists:

- `processedMessageIds`
- `lastUpdateId`

If you manually run "Process all messages (clear processed list)", the plugin reprocesses history — that is expected behavior.

---

## Development

### Local development

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Project structure

```text
src/
├── main.ts
├── constants.ts
├── types.ts
├── logger.ts
├── client.ts
├── settings.ts
├── api.ts
├── worker-errors.ts
├── plugin/
│   ├── state.ts
│   └── polling.ts
├── services/
│   ├── derive-phase.ts
│   ├── VaultWriter.ts
│   └── MessageService.ts
└── view/
    ├── InboxView.ts
    └── render.ts
```

---

## License

Released under the [MIT License](LICENSE).

---

## Acknowledgements

- The Obsidian team for the plugin API and community ecosystem
- `obsidian-sample-plugin` as the starting point for the project skeleton
