/**
 * Popup Page Logic
 * Handles toggle, color config, ignore params, stats display, and refresh
 */

const DEFAULT_CONFIG = {
  enabled: true,
  ignoreParams: [],
  highlightTextColor: '#C58AF9'
};

// DOM Elements
const enableToggle = document.getElementById('enableToggle');
const textColorPicker = document.getElementById('textColorPicker');
const textColorHex = document.getElementById('textColorHex');
const colorPreview = document.getElementById('colorPreview');
const previewLink = colorPreview.querySelector('.preview-link');
const tagsContainer = document.getElementById('tagsContainer');
const emptyHint = document.getElementById('emptyHint');
const paramInput = document.getElementById('paramInput');
const addParamBtn = document.getElementById('addParamBtn');
const refreshBtn = document.getElementById('refreshBtn');
const statsVisited = document.getElementById('statsVisited');
const statsTotal = document.getElementById('statsTotal');
const statsPercent = document.getElementById('statsPercent');
const statsRing = document.getElementById('statsRing');

let currentConfig = { ...DEFAULT_CONFIG };

/**
 * Load config from storage and update UI
 */
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_CONFIG, (config) => {
      currentConfig = config;
      updateUI();
      resolve();
    });
  });
}

/**
 * Save config to storage and notify background
 */
async function saveConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.set(currentConfig, () => {
      chrome.runtime.sendMessage({ action: 'configUpdated' });
      resolve();
    });
  });
}

/**
 * Update all UI elements based on current config
 */
function updateUI() {
  // Toggle
  enableToggle.checked = currentConfig.enabled;
  document.body.classList.toggle('disabled', !currentConfig.enabled);

  // Colors
  textColorPicker.value = currentConfig.highlightTextColor;
  textColorHex.value = currentConfig.highlightTextColor.replace('#', '').toUpperCase();
  updateColorPreview();

  // Tags
  renderTags();
}

/**
 * Update the color preview link
 */
function updateColorPreview() {
  previewLink.style.color = currentConfig.highlightTextColor;
}

/**
 * Render ignore parameter tags
 */
function renderTags() {
  // Remove existing tags (keep empty hint)
  const existingTags = tagsContainer.querySelectorAll('.tag');
  existingTags.forEach(tag => tag.remove());

  const params = currentConfig.ignoreParams || [];
  emptyHint.style.display = params.length === 0 ? 'block' : 'none';

  params.forEach((param) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `
      ${escapeHtml(param)}
      <button class="tag-remove" data-param="${escapeHtml(param)}" title="Remove">&times;</button>
    `;
    tagsContainer.appendChild(tag);
  });

  // Bind remove handlers
  tagsContainer.querySelectorAll('.tag-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const paramToRemove = btn.dataset.param;
      currentConfig.ignoreParams = currentConfig.ignoreParams.filter(p => p !== paramToRemove);
      saveConfig();
      renderTags();
    });
  });
}

/**
 * HTML escape utility
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Add a new ignore parameter
 */
function addParam() {
  const raw = paramInput.value.trim();
  if (!raw) return;

  // Support comma-separated input
  const params = raw.split(/[,，\s]+/).map(p => p.trim()).filter(p => p.length > 0);

  let added = false;
  for (const param of params) {
    if (!currentConfig.ignoreParams.includes(param)) {
      currentConfig.ignoreParams.push(param);
      added = true;
    }
  }

  if (added) {
    saveConfig();
    renderTags();
  }

  paramInput.value = '';
  paramInput.focus();
}

/**
 * Fetch and display stats for current tab
 */
async function loadStats() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith('chrome://')) {
      setStats(0, 0);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'getStats' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setStats(0, 0);
        return;
      }
      setStats(response.visited || 0, response.total || 0);
    });
  } catch {
    setStats(0, 0);
  }
}

/**
 * Update stats display
 */
function setStats(visited, total) {
  statsVisited.textContent = visited;
  statsTotal.textContent = total;

  const percent = total > 0 ? Math.round((visited / total) * 100) : 0;
  statsPercent.textContent = total > 0 ? `${percent}%` : '-';

  // Update ring progress
  const circumference = 2 * Math.PI * 24; // r=24
  const offset = circumference - (percent / 100) * circumference;
  statsRing.style.strokeDashoffset = offset;
}

/**
 * Refresh current tab highlights
 */
async function refreshCurrentTab() {
  refreshBtn.classList.add('spinning');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && !tab.url?.startsWith('chrome://')) {
      await chrome.tabs.sendMessage(tab.id, { action: 'refreshHighlights' });
      // Wait a bit then reload stats
      setTimeout(loadStats, 500);
    }
  } catch {
    // Content script might not be loaded
  }

  setTimeout(() => {
    refreshBtn.classList.remove('spinning');
  }, 600);
}

// Event Listeners
enableToggle.addEventListener('change', () => {
  currentConfig.enabled = enableToggle.checked;
  document.body.classList.toggle('disabled', !currentConfig.enabled);
  saveConfig();
});

textColorPicker.addEventListener('input', () => {
  currentConfig.highlightTextColor = textColorPicker.value;
  textColorHex.value = textColorPicker.value.replace('#', '').toUpperCase();
  updateColorPreview();
});

textColorPicker.addEventListener('change', () => {
  saveConfig();
});

textColorHex.addEventListener('input', () => {
  let val = textColorHex.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
  textColorHex.value = val.toUpperCase();
  if (val.length === 6) {
    const color = '#' + val;
    currentConfig.highlightTextColor = color;
    textColorPicker.value = color;
    updateColorPreview();
  }
});

textColorHex.addEventListener('change', () => {
  let val = textColorHex.value.replace(/[^0-9A-Fa-f]/g, '');
  if (val.length === 3) {
    val = val[0] + val[0] + val[1] + val[1] + val[2] + val[2];
  }
  if (val.length === 6) {
    const color = '#' + val.toUpperCase();
    currentConfig.highlightTextColor = color;
    textColorPicker.value = color;
    textColorHex.value = val.toUpperCase();
    updateColorPreview();
    saveConfig();
  } else {
    textColorHex.value = currentConfig.highlightTextColor.replace('#', '').toUpperCase();
  }
});

addParamBtn.addEventListener('click', addParam);

paramInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addParam();
  }
});

refreshBtn.addEventListener('click', refreshCurrentTab);

// Initialize
loadConfig().then(() => {
  loadStats();
});
