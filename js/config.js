// ============================================================
// JH GODOWN — Configuration (Single Source of Truth)
// THE ONLY FILE YOU NEED TO EDIT WHEN GAS URLs CHANGE
// ============================================================

const JH_CONFIG = {
  // ─── GAS Backend URLs ───
  GAS_AUTH:    "https://script.google.com/macros/s/AKfycbxciC7kuwzHk8M9qaYubrWLDOIaqD9sTpIHNAZHWNaK1Q4_2uEfKcWLf3EmrFKYOULsyA/exec",
  GAS_REG:     "https://script.google.com/macros/s/AKfycbwVVGNWyeNM1WXlgzuH5JYhiSL-9NRwApmeFi7vEvJ3YhkJmFRc6-LIUxOfXQIK0XqD/exec",
  GAS_WRITE:   "https://script.google.com/macros/s/AKfycbxcJ2gb7cGXt37QRGYp0YycJas1anaqzSlEpxmrdxhg56hj9XU6EYi1SDjfG2NrsrB4lA/exec",
  GAS_FEED:    "https://script.google.com/macros/s/AKfycbz4ZjPh3acdI4bzmbyaxI-_1ljSg8YZZ3Icn2KuYcRpGpVqtxkWWWY_TV673c4tTE2e/exec",
  GAS_DECODE:  "https://script.google.com/macros/s/AKfycbxvMexIX2Jkt7bd3lLrP5aTpM7uMSQsbCxcbxiK-ceDhvSoXEPwHHJK018L5vAo8sYr/exec",
  GAS_NOTIFY:  "https://script.google.com/macros/s/AKfycbz1mebV013C4jSglJR6AP7lmc9z_aFencG10a8iufAMpq9FsXsrXkWuPrcuMwjfNZYV/exec",

  // ─── Security Keys ───
  NOTIFY_KEY:  "totka_secret_2025_bd",       // Must match GAS6 SECRET
  ADMIN_PASS:  "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", // SHA-256 of admin password

  // ─── Site Config ───
  SITE_URL:    "https://juyel-dev.github.io/jh-godown",
  APP_NAME:    "Jh Godown",
  APP_VERSION: "3.0.0",
  CACHE_TTL:   5 * 60 * 1000, // 5 minutes in ms

  // ─── Feature Flags ───
  FEATURES: {
    WEB_WORKERS:     true,
    P2P_TRANSFER:    true,
    E2EE:            true,
    INDEXEDDB_CACHE: true,
    STREAMING:       true,
    TTL_AUTO_DELETE: true,
    RESUMABLE_UPLOAD:true,
    ADVANCED_SEARCH: true,
    MULTI_THREADING: true,
    PWA:             true,
    OFFLINE_MODE:    true,
    RATE_LIMITING:   true,
    QR_CODE_SHARE:   true,
    BOOKMARKS:       true,
    THEME_TOGGLE:    true,
    ANALYTICS:       true,
    BULK_ENCODE:     true,
    CODE_HIGHLIGHT:  true,
  },

  // ─── Engine Constants ───
  ENGINE: {
    POOL: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF!#$%&*+-./:;<=>?@^_`{|}~\u20B9",
    START_UNICODE: 0xE000,
    CHUNK_BITS: 18,
    CHUNK_SIZE: 45000,
    MASK: 262143, // (1 << 18) - 1
  },

  // ─── Rate Limiting ───
  RATE_LIMIT: {
    UPLOAD_COOLDOWN: 30 * 1000, // 30 seconds between uploads
    MAX_UPLOADS_PER_HOUR: 20,
  },

  // ─── TTL Config ───
  TTL: {
    DEFAULT_HOURS: 168, // 7 days default
    OPTIONS: [24, 72, 168, 720], // 1d, 3d, 7d, 30d
  },

  // ─── IndexedDB ───
  DB: {
    NAME: "JhGodownDB",
    VERSION: 1,
    STORES: {
      CACHE: "cache",
      BOOKMARKS: "bookmarks",
      OFFLINE: "offline_queue",
      ANALYTICS: "analytics",
    }
  }
};

// Legacy alias for backward compatibility with GAS references
const TOTKA = JH_CONFIG;

// ─── Utility: Generate QR Code URL ───
function getQRCodeURL(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
}

// ─── Utility: Format bytes ───
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ─── Utility: Time ago ───
function timeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 30) return days + "d ago";
  return Math.floor(days / 30) + "mo ago";
}

// ─── Utility: Sanitize HTML ───
function sanitizeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ─── Utility: Copy to clipboard ───
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

// ─── IndexedDB Manager ───
const DBManager = {
  db: null,

  async init() {
    if (!JH_CONFIG.FEATURES.INDEXEDDB_CACHE) return;
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(JH_CONFIG.DB.NAME, JH_CONFIG.DB.VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(JH_CONFIG.DB.STORES.CACHE))
          db.createObjectStore(JH_CONFIG.DB.STORES.CACHE, { keyPath: "key" });
        if (!db.objectStoreNames.contains(JH_CONFIG.DB.STORES.BOOKMARKS))
          db.createObjectStore(JH_CONFIG.DB.STORES.BOOKMARKS, { keyPath: "postId" });
        if (!db.objectStoreNames.contains(JH_CONFIG.DB.STORES.OFFLINE))
          db.createObjectStore(JH_CONFIG.DB.STORES.OFFLINE, { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains(JH_CONFIG.DB.STORES.ANALYTICS))
          db.createObjectStore(JH_CONFIG.DB.STORES.ANALYTICS, { keyPath: "id", autoIncrement: true });
      };
    });
  },

  async set(store, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      const req = os.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(store, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, "readonly");
      const os = tx.objectStore(store);
      const req = os.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(store) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, "readonly");
      const os = tx.objectStore(store);
      const req = os.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(store, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      const req = os.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};

// ─── Rate Limiter ───
const RateLimiter = {
  checkUpload() {
    if (!JH_CONFIG.FEATURES.RATE_LIMITING) return true;
    const now = Date.now();
    const last = parseInt(localStorage.getItem("jh_last_upload") || "0");
    const count = parseInt(localStorage.getItem("jh_upload_count") || "0");
    const hourStart = parseInt(localStorage.getItem("jh_upload_hour") || "0");

    if (now - hourStart > 3600000) {
      localStorage.setItem("jh_upload_hour", now.toString());
      localStorage.setItem("jh_upload_count", "0");
      return true;
    }

    if (count >= JH_CONFIG.RATE_LIMIT.MAX_UPLOADS_PER_HOUR) {
      return false;
    }

    if (now - last < JH_CONFIG.RATE_LIMIT.UPLOAD_COOLDOWN) {
      return false;
    }

    return true;
  },

  recordUpload() {
    const now = Date.now();
    localStorage.setItem("jh_last_upload", now.toString());
    const count = parseInt(localStorage.getItem("jh_upload_count") || "0");
    localStorage.setItem("jh_upload_count", (count + 1).toString());
  },

  getRemaining() {
    const count = parseInt(localStorage.getItem("jh_upload_count") || "0");
    return Math.max(0, JH_CONFIG.RATE_LIMIT.MAX_UPLOADS_PER_HOUR - count);
  }
};

// ─── Theme Manager ───
const ThemeManager = {
  init() {
    if (!JH_CONFIG.FEATURES.THEME_TOGGLE) return;
    const saved = localStorage.getItem("jh_theme") || "auto";
    this.apply(saved);
  },

  apply(theme) {
    const root = document.documentElement;
    if (theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  },

  toggle() {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const newTheme = isDark ? "light" : "dark";
    this.apply(newTheme);
    localStorage.setItem("jh_theme", newTheme);
  }
};

// ─── Bookmark Manager ───
const BookmarkManager = {
  async add(postId, data) {
    if (!JH_CONFIG.FEATURES.BOOKMARKS) return;
    await DBManager.init();
    await DBManager.set(JH_CONFIG.DB.STORES.BOOKMARKS, { postId, ...data, addedAt: Date.now() });
  },

  async remove(postId) {
    await DBManager.delete(JH_CONFIG.DB.STORES.BOOKMARKS, postId);
  },

  async getAll() {
    if (!JH_CONFIG.FEATURES.BOOKMARKS) return [];
    await DBManager.init();
    return DBManager.getAll(JH_CONFIG.DB.STORES.BOOKMARKS);
  },

  async has(postId) {
    const bm = await DBManager.get(JH_CONFIG.DB.STORES.BOOKMARKS, postId);
    return !!bm;
  }
};

// ─── Init on load ───
document.addEventListener("DOMContentLoaded", () => {
  DBManager.init().catch(() => {});
  ThemeManager.init();
});
