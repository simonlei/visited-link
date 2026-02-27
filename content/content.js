/**
 * Content Script
 * Scans page links, communicates with background to get visited status,
 * and highlights visited links with custom colors.
 */

(() => {
  const HIGHLIGHT_CLASS = 'vlh-visited';
  const DEBOUNCE_DELAY = 300;
  let debounceTimer = null;
  let isProcessing = false;

  /**
   * Apply highlight colors as CSS custom properties on the document
   * @param {Object} config - Configuration with highlightTextColor
   */
  function applyHighlightColors(config) {
    const root = document.documentElement;
    root.style.setProperty('--vlh-text-color', config.highlightTextColor || '#C58AF9');
  }

  /**
   * Collect all valid link URLs from the page
   * @param {Element} root - Root element to scan (default: document)
   * @returns {Map<string, Element[]>} Map of URL -> elements
   */
  function collectLinks(root = document) {
    const linkMap = new Map();
    const anchors = root.querySelectorAll('a[href]');

    for (const anchor of anchors) {
      const href = anchor.href;
      if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('chrome://') || href.startsWith('chrome-extension://')) {
        continue;
      }

      try {
        new URL(href);
      } catch {
        continue;
      }

      if (!linkMap.has(href)) {
        linkMap.set(href, []);
      }
      linkMap.get(href).push(anchor);
    }

    return linkMap;
  }

  /**
   * Remove all highlights from the page
   */
  function clearHighlights() {
    const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    for (const el of highlighted) {
      el.classList.remove(HIGHLIGHT_CLASS);
    }
  }

  /**
   * Main function: scan links and apply highlights
   */
  async function processLinks() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      if (!chrome.runtime?.id) return;

      const linkMap = collectLinks();
      if (linkMap.size === 0) {
        isProcessing = false;
        return;
      }

      const urls = Array.from(linkMap.keys());

      const response = await chrome.runtime.sendMessage({
        action: 'checkVisited',
        urls: urls
      });

      if (!response) {
        isProcessing = false;
        return;
      }

      const { visitedUrls, config } = response;

      if (config) {
        applyHighlightColors(config);
      }

      if (!config?.enabled) {
        clearHighlights();
        isProcessing = false;
        return;
      }

      // Clear existing highlights
      clearHighlights();

      // Apply highlights to visited links
      const visitedSet = new Set(visitedUrls || []);
      let visitedCount = 0;
      let totalCount = 0;

      for (const [url, elements] of linkMap) {
        totalCount += elements.length;
        if (visitedSet.has(url)) {
          visitedCount += elements.length;
          for (const el of elements) {
            el.classList.add(HIGHLIGHT_CLASS);
          }
        }
      }

      // Store stats for popup
      try {
        await chrome.runtime.sendMessage({
          action: 'updateStats',
          stats: { visited: visitedCount, total: totalCount }
        });
      } catch {
        // Popup might not be listening, ignore
      }
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        disconnectObserver();
        return;
      }
      console.error('[Visited Link] Error processing links:', error);
    } finally {
      isProcessing = false;
    }
  }

  /**
   * Debounced version of processLinks
   */
  function debouncedProcessLinks() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processLinks, DEBOUNCE_DELAY);
  }

  // MutationObserver to handle dynamically added links (SPA support)
  let observer = null;

  function startObserver() {
    observer = new MutationObserver((mutations) => {
      let hasNewLinks = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'A' || node.querySelector?.('a[href]')) {
              hasNewLinks = true;
              break;
            }
          }
        }
        if (hasNewLinks) break;
      }

      if (hasNewLinks) {
        debouncedProcessLinks();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function disconnectObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  /**
   * Handle link clicks: immediately mark the clicked link as visited
   * so the color updates without waiting for a full rescan.
   */
  function handleLinkClick(event) {
    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.classList.contains(HIGHLIGHT_CLASS)) return;

    const href = anchor.href;
    if (!href || href.startsWith('javascript:') || href.startsWith('#') ||
        href.startsWith('chrome://') || href.startsWith('chrome-extension://')) {
      return;
    }

    try {
      new URL(href);
    } catch {
      return;
    }

    // Immediately mark as visited visually
    anchor.classList.add(HIGHLIGHT_CLASS);

    // Also mark all other links on the page with the same URL
    const allAnchors = document.querySelectorAll('a[href]');
    for (const a of allAnchors) {
      if (a.href === href && !a.classList.contains(HIGHLIGHT_CLASS)) {
        a.classList.add(HIGHLIGHT_CLASS);
      }
    }
  }

  document.addEventListener('click', handleLinkClick, true);

  /**
   * Re-scan links when the page becomes visible again (e.g. user switches
   * back to this tab after visiting a link in another tab).
   */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      debouncedProcessLinks();
    }
  });

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'refreshHighlights') {
      processLinks();
      sendResponse({ success: true });
    }

    if (message.action === 'getStats') {
      const linkMap = collectLinks();
      const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
      sendResponse({
        total: linkMap.size,
        visited: highlighted.length
      });
    }
  });

  // Initialize
  processLinks();
  startObserver();
})();
