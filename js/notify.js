// ============================================================
// JH GODOWN — Telegram Notification Triggers
// Fire-and-forget notifications to admin via GAS 6
// ============================================================

const Notify = {
  // ─── Generic notify helper ───
  async _send(action, data) {
    try {
      return await API.notify(action, data);
    } catch (err) {
      console.warn("Notify failed:", err);
      return { error: err.message };
    }
  },

  // ─── New user registered ───
  async newUser({ name, username, userId, loginId, bio, profession }) {
    return this._send("newUser", {
      name, username, userId, loginId,
      bio: bio || "—",
      profession: profession || "—",
    });
  },

  // ─── Profile updated ───
  async profileUpdate({ userId, username, name, bio, sheetId, profession }) {
    return this._send("profileUpdate", {
      userId, username, name,
      bio: bio || "—",
      profession: profession || "—",
      sheetId: sheetId || "",
    });
  },

  // ─── New post uploaded ───
  async newPost({ title, tags, originalSize, postId, username, userId, storageId, chunks, encodedLen, nsfw }) {
    return this._send("newPost", {
      title, tags: tags || "—", originalSize: originalSize || "?",
      postId, username, userId, storageId,
      chunks: chunks || "?",
      encodedLen: encodedLen || "?",
      nsfw: !!nsfw,
    });
  },

  // ─── System error ───
  async error({ errorType, message, userId, context }) {
    return this._send("systemError", {
      errorType: errorType || "Unknown",
      message: message || "",
      userId: userId || "—",
      context: context || "",
    });
  },

  // ─── Storage warning ───
  async storageWarn({ sheetId, currentRows, maxRows, usedPct }) {
    return this._send("storageWarn", {
      sheetId, currentRows, maxRows, usedPct,
    });
  },
};

// Legacy alias
const TOTKA_NOTIFY = Notify;
