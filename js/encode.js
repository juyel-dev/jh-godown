// ============================================================
// JH GODOWN — Encode Page: File → Encoded Text with Web Worker
// Supports: drag-drop, batch encode, progress tracking, metadata
// ============================================================

const EncodePage = {
  files: [],
  encodedResults: [],
  worker: null,
  isEncoding: false,

  init() {
    this.setupDragDrop();
    this.setupWorker();
    this.setupUI();
  },

  setupUI() {
    // File input change
    const fileInput = document.getElementById("encode-files");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => this.handleFiles(e.target.files));
    }

    // Encode button
    const encodeBtn = document.getElementById("btn-encode");
    if (encodeBtn) {
      encodeBtn.addEventListener("click", () => this.startEncode());
    }

    // Save button
    const saveBtn = document.getElementById("btn-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.savePost());
    }

    // Clear button
    const clearBtn = document.getElementById("btn-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearAll());
    }

    // Copy encoded text
    const copyBtn = document.getElementById("btn-copy-encoded");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.copyEncoded());
    }

    // Download encoded text
    const dlBtn = document.getElementById("btn-download-encoded");
    if (dlBtn) {
      dlBtn.addEventListener("click", () => this.downloadEncoded());
    }

    // Check rate limit
    this.updateRateLimitUI();
  },

  setupDragDrop() {
    const dropZone = document.getElementById("drop-zone");
    if (!dropZone) return;

    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.add("jh-drop-active"));
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove("jh-drop-active"));
    });

    dropZone.addEventListener("drop", (e) => {
      this.handleFiles(e.dataTransfer.files);
    });
  },

  setupWorker() {
    if (!JH_CONFIG.FEATURES.WEB_WORKERS) return;
    try {
      this.worker = new Worker("workers/encode.worker.js");
      this.worker.onmessage = (e) => {
        const { type, pct, status, detail, result, error, fileIndex } = e.data;
        if (type === "progress") {
          this.prog.update(pct, status, detail);
        } else if (type === "complete") {
          this.onEncodeComplete(result, fileIndex);
        } else if (type === "error") {
          this.prog.error(error);
          this.isEncoding = false;
        }
      };
    } catch (e) {
      console.warn("Web Worker not available, falling back to main thread");
      this.worker = null;
    }
  },

  handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Check rate limit
    if (!RateLimiter.checkUpload()) {
      Swal.fire({
        icon: "warning",
        title: "Rate Limited",
        text: `Please wait. ${RateLimiter.getRemaining()} uploads remaining this hour.`,
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });
      return;
    }

    this.files = [...this.files, ...files];
    this.renderFileList();
    document.getElementById("btn-encode")?.classList.remove("jh-disabled");
  },

  renderFileList() {
    const list = document.getElementById("file-list");
    if (!list) return;

    list.innerHTML = this.files.map((f, i) => `
      <div class="jh-file-item">
        <i data-lucide="${ImageProcessor.getFileIcon(f.type, f.name)}"></i>
        <div class="jh-file-info">
          <span class="jh-file-name">${sanitizeHTML(f.name)}</span>
          <span class="jh-file-size">${formatBytes(f.size)}</span>
        </div>
        <button class="jh-btn-icon jh-btn-danger" onclick="EncodePage.removeFile(${i})">
          <i data-lucide="x"></i>
        </button>
      </div>
    `).join("");
    lucide.createIcons();
  },

  removeFile(index) {
    this.files.splice(index, 1);
    this.renderFileList();
    if (this.files.length === 0) {
      document.getElementById("btn-encode")?.classList.add("jh-disabled");
    }
  },

  clearAll() {
    this.files = [];
    this.encodedResults = [];
    this.isEncoding = false;
    this.renderFileList();
    document.getElementById("encoded-output")?.classList.add("jh-hidden");
    document.getElementById("btn-encode")?.classList.add("jh-disabled");
    if (this.prog) this.prog.hide();
  },

  async startEncode() {
    if (this.isEncoding || this.files.length === 0) return;
    this.isEncoding = true;

    // Init progress
    this.prog = new JHProgress("encode-progress", { autoHide: false });
    this.prog.show("Reading files...");

    this.encodedResults = [];

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      this.prog.update(0, `Encoding ${file.name}...`, `File ${i + 1} of ${this.files.length}`);

      try {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        let encoded;
        if (this.worker && JH_CONFIG.FEATURES.WEB_WORKERS) {
          encoded = await this.encodeWithWorker(uint8, i);
        } else {
          encoded = await this.encodeMainThread(uint8, i);
        }

        const stats = JH_ENGINE.getStats(uint8, encoded);
        this.encodedResults.push({
          file,
          encoded,
          stats,
        });

        this.prog.update(100, `${file.name} done!`, `${stats.encodedChars.toLocaleString()} chars | ${stats.chunks} chunks`);

      } catch (err) {
        this.prog.error(`${file.name}: ${err.message}`);
        console.error("Encode error:", err);
      }
    }

    this.isEncoding = false;
    this.showResults();
    RateLimiter.recordUpload();
    this.updateRateLimitUI();
  },

  encodeWithWorker(uint8, fileIndex) {
    return new Promise((resolve, reject) => {
      const handler = (e) => {
        const { type, result, error, fileIndex: fi } = e.data;
        if (fi !== fileIndex) return;

        if (type === "complete") {
          this.worker.removeEventListener("message", handler);
          resolve(result);
        } else if (type === "error") {
          this.worker.removeEventListener("message", handler);
          reject(new Error(error));
        } else if (type === "progress") {
          this.prog.update(e.data.pct, e.data.status, e.data.detail);
        }
      };
      this.worker.addEventListener("message", handler);
      this.worker.postMessage({
        action: "encode",
        data: uint8,
        fileIndex,
      });
    });
  },

  async encodeMainThread(uint8, fileIndex) {
    return JH_ENGINE.encode(uint8, (pct, status) => {
      this.prog.update(pct, status);
    });
  },

  onEncodeComplete(result, fileIndex) {
    // Handled in the loop
  },

  showResults() {
    const outputSection = document.getElementById("encoded-output");
    const preview = document.getElementById("encoded-preview");
    if (!outputSection || !preview) return;

    outputSection.classList.remove("jh-hidden");

    if (this.encodedResults.length === 1) {
      const r = this.encodedResults[0];
      preview.textContent = r.encoded.substring(0, 500) + (r.encoded.length > 500 ? "..." : "");
      document.getElementById("encode-stats").innerHTML = `
        <div class="jh-stats-grid">
          <div class="jh-stat"><span>Original</span><strong>${formatBytes(r.stats.originalSize)}</strong></div>
          <div class="jh-stat"><span>Encoded</span><strong>${r.stats.encodedChars.toLocaleString()} chars</strong></div>
          <div class="jh-stat"><span>Chunks</span><strong>${r.stats.chunks}</strong></div>
          <div class="jh-stat"><span>Ratio</span><strong>${r.stats.ratio}%</strong></div>
        </div>
      `;
    } else {
      preview.textContent = `Successfully encoded ${this.encodedResults.length} files.`;
    }

    // Show save section if logged in
    if (Auth.isLoggedIn()) {
      document.getElementById("save-section")?.classList.remove("jh-hidden");
    }
  },

  async savePost() {
    if (!Auth.isLoggedIn()) {
      location.href = "login.html?redirect=" + encodeURIComponent(location.href);
      return;
    }

    const user = Auth.getUser();
    const title = document.getElementById("post-title")?.value?.trim();
    const tags = document.getElementById("post-tags")?.value?.trim();
    const description = document.getElementById("post-description")?.value?.trim();
    const nsfw = document.getElementById("post-nsfw")?.checked || false;

    if (!title) {
      Swal.fire({ icon: "warning", title: "Title required", background: "var(--bg-secondary)", color: "var(--text-primary)" });
      return;
    }

    if (this.encodedResults.length === 0) return;

    this.prog.show("Saving to cloud...");

    for (const result of this.encodedResults) {
      try {
        const resp = await API.savePost({
          encoded: result.encoded,
          title,
          tags,
          description,
          nsfw,
          originalSize: formatBytes(result.stats.originalSize),
          encodedLen: result.stats.encodedChars,
          userId: user.userId,
          username: user.username,
        });

        if (resp.success) {
          this.prog.success(`Saved! ID: ${resp.postId}`);

          // Notify
          Notify.newPost({
            title, tags, originalSize: formatBytes(result.stats.originalSize),
            postId: resp.postId, username: user.username, userId: user.userId,
            storageId: resp.storageId, chunks: resp.chunks,
            encodedLen: result.stats.encodedChars, nsfw,
          }).catch(() => {});

          // Track analytics
          Analytics.track("upload", { postId: resp.postId, size: result.stats.originalSize });

          Swal.fire({
            icon: "success",
            title: "Posted!",
            html: `Post ID: <code>${resp.postId}</code><br><a href="post.html?id=${resp.postId}" class="jh-link">View Post</a>`,
            background: "var(--bg-secondary)", color: "var(--text-primary)",
          });
        } else {
          this.prog.error(resp.error || "Save failed");
        }
      } catch (err) {
        this.prog.error(err.message);
        Notify.error({ errorType: "SAVE_POST", message: err.message, userId: user.userId }).catch(() => {});
      }
    }
  },

  copyEncoded() {
    if (this.encodedResults.length === 0) return;
    copyToClipboard(this.encodedResults[0].encoded);
    Swal.fire({ icon: "success", title: "Copied!", timer: 1200, showConfirmButton: false, background: "var(--bg-secondary)", color: "var(--text-primary)" });
  },

  downloadEncoded() {
    if (this.encodedResults.length === 0) return;
    const r = this.encodedResults[0];
    const blob = new Blob([r.encoded], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.file.name + ".jh.txt";
    a.click();
    URL.revokeObjectURL(url);
  },

  updateRateLimitUI() {
    const el = document.getElementById("rate-limit-info");
    if (!el) return;
    const remaining = RateLimiter.getRemaining();
    el.textContent = `${remaining} uploads left this hour`;
    el.classList.toggle("jh-rate-warning", remaining < 5);
  }
};

// ─── Offline Encode (no server required) ───
const OfflineEncode = {
  async encodeToText(file) {
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    return JH_ENGINE.encode(uint8);
  },

  downloadAsText(encoded, filename) {
    const blob = new Blob([encoded], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".jh.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Init on page load
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("encode-page")) {
    EncodePage.init();
  }
});
