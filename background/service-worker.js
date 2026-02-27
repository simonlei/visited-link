/**
 * Background Service Worker
 * Handles history queries, URL normalization matching, message communication and caching
 */

importScripts('/utils/url-normalizer.js');

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  ignoreParams: [],
  highlightTextColor: '#C58AF9'
};

// Cache for history queries (keyed by tab id)
const historyCache = new Map();

/**
 * Get current configuration from storage
 * @returns {Promise<Object>}
 */
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_CONFIG, (result) => {
      resolve(result);
    });
  });
}

/**
 * Query history for a specific domain and return all visited URLs
 * @param {string} domain - Domain to search
 * @returns {Promise<string[]>} List of visited URLs for that domain
 */
async function queryHistoryByDomain(domain) {
  return new Promise((resolve) => {
    chrome.history.search(
      {
        text: domain,
        maxResults: 10000,
        startTime: 0
      },
      (results) => {
        const urls = results ? results.map(item => item.url) : [];
        resolve(urls);
      }
    );
  });
}

/**
 * Check which URLs from the given list have been visited
 * Uses domain-grouped batch querying and URL normalization
 * @param {string[]} urls - List of URLs to check
 * @param {string[]} ignoreParams - Parameters to ignore during comparison
 * @returns {Promise<string[]>} List of visited original URLs
 */
async function checkVisitedUrls(urls, ignoreParams) {
  // Group URLs by domain
  const domainGroups = new Map();
  const urlToOriginals = new Map(); // normalized -> [original URLs]

  for (const url of urls) {
    if (!UrlNormalizer.isValidHttpUrl(url)) continue;

    const domain = UrlNormalizer.extractDomain(url);
    if (!domain) continue;

    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain).push(url);

    const normalized = UrlNormalizer.normalizeUrl(url, ignoreParams);
    if (!urlToOriginals.has(normalized)) {
      urlToOriginals.set(normalized, []);
    }
    urlToOriginals.get(normalized).push(url);
  }

  // Query history for each domain in parallel
  const visitedOriginalUrls = new Set();
  const domainQueries = [];

  for (const [domain, domainUrls] of domainGroups) {
    domainQueries.push(
      queryHistoryByDomain(domain).then((historyUrls) => {
        // Normalize all history URLs
        const normalizedHistory = new Set();
        for (const hUrl of historyUrls) {
          normalizedHistory.add(UrlNormalizer.normalizeUrl(hUrl, ignoreParams));
        }

        // Check each page URL against normalized history
        for (const pageUrl of domainUrls) {
          const normalizedPageUrl = UrlNormalizer.normalizeUrl(pageUrl, ignoreParams);
          if (normalizedHistory.has(normalizedPageUrl)) {
            visitedOriginalUrls.add(pageUrl);
          }
        }
      })
    );
  }

  await Promise.all(domainQueries);
  return Array.from(visitedOriginalUrls);
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkVisited') {
    handleCheckVisited(message, sender).then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (message.action === 'getConfig') {
    getConfig().then(sendResponse);
    return true;
  }

  if (message.action === 'configUpdated') {
    // Clear cache when config changes
    historyCache.clear();
    // Notify all tabs to refresh
    notifyAllTabs();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'refreshTab') {
    if (sender.tab) {
      historyCache.delete(sender.tab.id);
    }
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Handle checkVisited message
 */
async function handleCheckVisited(message, sender) {
  try {
    const config = await getConfig();

    if (!config.enabled) {
      return { visitedUrls: [], config };
    }

    const visitedUrls = await checkVisitedUrls(
      message.urls || [],
      config.ignoreParams || []
    );

    return { visitedUrls, config };
  } catch (error) {
    console.error('[Visited Link] Error checking visited URLs:', error);
    return { visitedUrls: [], config: DEFAULT_CONFIG, error: error.message };
  }
}

/**
 * Notify all tabs to refresh their highlighted links
 */
async function notifyAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(tab.id, { action: 'refreshHighlights' }).catch(() => {
          // Tab might not have content script loaded, ignore
        });
      }
    }
  } catch (error) {
    console.error('[Visited Link] Error notifying tabs:', error);
  }
}

// When user switches to a tab, notify it to re-scan links
// (the visited link may have been clicked from this tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url && !tab.url.startsWith('chrome://')) {
      // Clear cache for this tab so fresh history is queried
      historyCache.delete(activeInfo.tabId);
      chrome.tabs.sendMessage(activeInfo.tabId, { action: 'refreshHighlights' }).catch(() => {
        // Content script might not be loaded
      });
    }
  } catch {
    // Tab may no longer exist
  }
});

// Clean up cache when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  historyCache.delete(tabId);
});
