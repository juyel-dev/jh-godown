// ============================================================
// JH GODOWN — API Layer: All GAS API Call Wrappers
// With caching, retry logic, and error handling
// ============================================================

const API = {
  // ─── CORS Proxy helper ───
  async fetchWithRetry(url, options = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        const resp = await fetch(url, {
          ...options,
          redirect: "follow",
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
      } catch (err) {
        if (i === retries) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  },

  // ─── POST to GAS ───
  async post(endpoint, data) {
    return this.fetchWithRetry(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ─── GET from GAS ───
  async get(endpoint, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;
    return this.fetchWithRetry(url);
  },

  // ═══════════════════════════════════════════════════════════
  // AUTH API (GAS 1)
  // ═══════════════════════════════════════════════════════════

  async signup(data) {
    return this.post(JH_CONFIG.GAS_AUTH, { action: "signup", ...data });
  },

  async login(loginId, password) {
    const hash = CryptoJS.SHA256(password).toString();
    return this.post(JH_CONFIG.GAS_AUTH, { action: "login", loginId, password });
  },

  async getProfile(userId) {
    return this.post(JH_CONFIG.GAS_AUTH, { action: "getProfile", userId });
  },

  async updateProfile(data) {
    return this.post(JH_CONFIG.GAS_AUTH, { action: "updateProfile", ...data });
  },

  async checkUsername(username) {
    return this.get(JH_CONFIG.GAS_AUTH, { action: "checkUsername", username });
  },

  // ═══════════════════════════════════════════════════════════
  // REGISTRY API (GAS 2)
  // ═══════════════════════════════════════════════════════════

  async getActiveStorage() {
    return this.get(JH_CONFIG.GAS_REG, { action: "getActive" });
  },

  async listStorage() {
    return this.get(JH_CONFIG.GAS_REG, { action: "listAll" });
  },

  async getStats() {
    return this.get(JH_CONFIG.GAS_REG, { action: "stats" });
  },

  // ═══════════════════════════════════════════════════════════
  // WRITE API (GAS 3)
  // ═══════════════════════════════════════════════════════════

  async savePost(data) {
    return this.post(JH_CONFIG.GAS_WRITE, { action: "savePost", ...data });
  },

  async deletePost(postId, userId) {
    return this.post(JH_CONFIG.GAS_WRITE, { action: "deletePost", postId, userId });
  },

  // ═══════════════════════════════════════════════════════════
  // FEED API (GAS 4)
  // ═══════════════════════════════════════════════════════════

  async getFeed(page = 1, perPage = 10, sort = "newest", tag = null) {
    const params = { action: "feed", page, perPage, sort };
    if (tag) params.tag = tag;
    return this.get(JH_CONFIG.GAS_FEED, params);
  },

  async searchPosts(q, page = 1, sort = "newest") {
    return this.get(JH_CONFIG.GAS_FEED, { action: "search", q, page, sort });
  },

  async getUserPosts(userId) {
    return this.get(JH_CONFIG.GAS_FEED, { action: "userPosts", userId });
  },

  async getPostMeta(postId) {
    return this.get(JH_CONFIG.GAS_FEED, { action: "postMeta", postId });
  },

  async getUserInfo(userId) {
    return this.get(JH_CONFIG.GAS_FEED, { action: "userInfo", userId });
  },

  async getTagList() {
    return this.get(JH_CONFIG.GAS_FEED, { action: "tagList" });
  },

  async getRecentTags(limit = 20) {
    return this.get(JH_CONFIG.GAS_FEED, { action: "recentTags", limit });
  },

  // ═══════════════════════════════════════════════════════════
  // DECODE API (GAS 5)
  // ═══════════════════════════════════════════════════════════

  async getEncodedData(postId) {
    return this.get(JH_CONFIG.GAS_DECODE, { postId });
  },

  // ═══════════════════════════════════════════════════════════
  // NOTIFY API (GAS 6)
  // ═══════════════════════════════════════════════════════════

  async notify(action, data) {
    return this.post(JH_CONFIG.GAS_NOTIFY, {
      action,
      secret: JH_CONFIG.NOTIFY_KEY,
      ...data,
    });
  },

  // Admin endpoints
  async getAdminStats() {
    return this.get(JH_CONFIG.GAS_NOTIFY, { action: "stats", secret: JH_CONFIG.NOTIFY_KEY });
  },

  async getRecentPosts(limit = 10) {
    return this.get(JH_CONFIG.GAS_NOTIFY, { action: "recentPosts", secret: JH_CONFIG.NOTIFY_KEY, limit });
  },

  async getRecentUsers(limit = 10) {
    return this.get(JH_CONFIG.GAS_NOTIFY, { action: "recentUsers", secret: JH_CONFIG.NOTIFY_KEY, limit });
  },

  async getStorageList() {
    return this.get(JH_CONFIG.GAS_NOTIFY, { action: "storageList", secret: JH_CONFIG.NOTIFY_KEY });
  },

  async adminDeletePost(postId, reason = "Admin action") {
    return this.post(JH_CONFIG.GAS_NOTIFY, {
      action: "deletePost",
      secret: JH_CONFIG.NOTIFY_KEY,
      postId,
      reason,
    });
  },

  async adminAddStorage(sheetId, spreadsheetId, sheetName, notes = "") {
    return this.post(JH_CONFIG.GAS_NOTIFY, {
      action: "addStorage",
      secret: JH_CONFIG.NOTIFY_KEY,
      sheetId,
      spreadsheetId,
      sheetName,
      notes,
    });
  },

  async adminBroadcast(message) {
    return this.post(JH_CONFIG.GAS_NOTIFY, {
      action: "broadcastMsg",
      secret: JH_CONFIG.NOTIFY_KEY,
      message,
    });
  },
};

// ─── Cache Helpers ───
const Cache = {
  get(key) {
    try {
      const hit = sessionStorage.getItem("jh_" + key);
      const ts = sessionStorage.getItem("jh_" + key + "_ts");
      if (hit && ts && Date.now() - parseInt(ts) < JH_CONFIG.CACHE_TTL) {
        return JSON.parse(hit);
      }
    } catch (e) {}
    return null;
  },

  set(key, data) {
    try {
      sessionStorage.setItem("jh_" + key, JSON.stringify(data));
      sessionStorage.setItem("jh_" + key + "_ts", Date.now().toString());
    } catch (e) {}
  },

  clear() {
    const keys = Object.keys(sessionStorage);
    keys.forEach(k => { if (k.startsWith("jh_")) sessionStorage.removeItem(k); });
  },

  // IndexedDB-backed persistent cache
  async getPersistent(key) {
    if (!JH_CONFIG.FEATURES.INDEXEDDB_CACHE) return null;
    const data = await DBManager.get(JH_CONFIG.DB.STORES.CACHE, key);
    if (data && data.expires > Date.now()) return data.value;
    return null;
  },

  async setPersistent(key, value, ttlMs = JH_CONFIG.CACHE_TTL) {
    if (!JH_CONFIG.FEATURES.INDEXEDDB_CACHE) return;
    await DBManager.set(JH_CONFIG.DB.STORES.CACHE, {
      key,
      value,
      expires: Date.now() + ttlMs,
    });
  }
};
