/**
 * URL Normalizer - Shared utility for URL normalization
 * Used by both background service worker and content script
 */

const UrlNormalizer = (() => {
  const VALID_PROTOCOLS = ['http:', 'https:'];

  /**
   * Normalize a URL by removing specified query parameters and sorting remaining ones
   * @param {string} url - Original URL string
   * @param {string[]} ignoreParams - List of query parameter names to ignore
   * @returns {string} Normalized URL string; returns original string if URL is invalid
   */
  function normalizeUrl(url, ignoreParams = []) {
    try {
      const urlObj = new URL(url);

      if (!VALID_PROTOCOLS.includes(urlObj.protocol)) {
        return url;
      }

      if (ignoreParams.length > 0) {
        const ignoreSet = new Set(ignoreParams.map(p => p.toLowerCase()));
        const keysToDelete = [];
        for (const key of urlObj.searchParams.keys()) {
          if (ignoreSet.has(key.toLowerCase())) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => urlObj.searchParams.delete(key));
      }

      urlObj.searchParams.sort();

      // Remove trailing hash if empty
      if (urlObj.hash === '#') {
        urlObj.hash = '';
      }

      return urlObj.toString();
    } catch (e) {
      return url;
    }
  }

  /**
   * Extract the domain (hostname) from a URL
   * @param {string} url - Original URL string
   * @returns {string|null} Domain string, or null if URL is invalid
   */
  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if a URL is valid and uses http/https protocol
   * @param {string} url - URL string to validate
   * @returns {boolean}
   */
  function isValidHttpUrl(url) {
    try {
      const urlObj = new URL(url);
      return VALID_PROTOCOLS.includes(urlObj.protocol);
    } catch (e) {
      return false;
    }
  }

  return {
    normalizeUrl,
    extractDomain,
    isValidHttpUrl
  };
})();

// Make available in different contexts
if (typeof globalThis !== 'undefined') {
  globalThis.UrlNormalizer = UrlNormalizer;
}
