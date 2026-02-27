# Visited Link Highlighter

A Chrome extension that highlights visited links on web pages with customizable colors and URL parameter ignore rules.

## Features

- **Visited Link Highlighting** — Automatically colors links you've visited before on every web page
- **Customizable Color** — Pick any text color via color picker or hex input (default: `#C58AF9`)
- **URL Parameter Ignore Rules** — Strip specified query parameters (e.g., `utm_source`, `frompage`) before URL comparison, so tracking params don't break matching
- **Enable/Disable Toggle** — Master switch to turn the feature on/off globally
- **Page Stats** — Ring chart in popup showing visited link count and percentage on the current page
- **SPA Support** — MutationObserver watches for dynamically added links and auto-highlights them
- **Real-time Config Sync** — Settings changes are applied to all open tabs immediately
- **Refresh Button** — Manually re-scan and re-apply highlights on the current page

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder

## Project Structure

```
visited-link/
├── manifest.json              # Extension metadata & configuration
├── background/
│   └── service-worker.js      # History queries, URL matching, message routing
├── content/
│   ├── content.js             # Page link scanning & highlight application
│   └── content.css            # Visited link styles
├── popup/
│   ├── popup.html             # Settings panel UI
│   ├── popup.js               # Popup logic & event handlers
│   └── popup.css              # Popup styling
├── utils/
│   └── url-normalizer.js      # Shared URL normalization utility
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## How It Works

1. **Content script** scans all `<a>` links on the page and sends URLs to the background service worker
2. **Service worker** groups URLs by domain, queries `chrome.history` in parallel, normalizes URLs (strips ignored params, sorts remaining params), and returns matched visited URLs
3. **Content script** adds the `vlh-visited` CSS class to visited link elements, applying the configured text color
4. **Popup** provides a settings UI for toggling, color customization, parameter ignore rules, and page stats

## Permissions

| Permission | Purpose |
|---|---|
| `history` | Query browsing history to identify visited URLs |
| `storage` | Persist user settings via `chrome.storage.sync` |
| `activeTab` | Access the active tab for stats retrieval |
| `tabs` | Broadcast config changes to all open tabs |

## License

MIT
