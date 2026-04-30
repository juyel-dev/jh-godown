// ============================================================
// JH GODOWN — Decode Page: Encoded Text → Original File
// Supports: PostID lookup, paste text, streaming preview, download
// ============================================================

const DecodePage = {
  currentBlob: null,
  currentFilename: "",
  decodedData: null,

  init() {
    this.setupUI();
    this.checkDeepLink();
  },

  setupUI() {
    // Decode by PostID
    const fetchBtn = document.getElementById("btn-fetch");
    if (fetchBtn) {
      fetchBtn.addEventListener("click", () => this.fetchByPostId());
    }

    // Decode pasted text
    const decodeBtn = document.getElementById("btn-decode-text");
    if (decodeBtn) {
      decodeBtn.addEventListener("click", () => this.decodePastedText());
    }

    // Download
    const dlBtn = document.getElementById("btn-download");
    if (dlBtn) {
      dlBtn.addEventListener("click", () => this.downloadFile());
    }

    // Copy text output
    const copyBtn = document.getElementById("btn-copy-text");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.copyTextOutput());
    }

    // Enter key on PostID input
    const postIdInput = document.getElementById("decode-post-id");
    if (postIdInput) {
      postIdInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.fetchByPostId();
      });
    }
  },

  checkDeepLink() {
    const p = new URLSearchParams(location.search);
    const postId = p.get("id");
    if (postId) {
      const input = document.getElementById("decode-post-id");
      if (input) input.value = postId;
      this.fetchByPostId(postId);
    }
  },

  async fetchByPostId(postId) {
    const id = postId || document.getElementById("decode-post-id")?.value?.trim();
    if (!id) {
      Swal.fire({ icon: "warning", title: "Enter Post ID", background: "var(--bg-secondary)", color: "var(--text-primary)" });
      return;
    }

    this.prog = new JHProgress("decode-progress", { autoHide: false });
    this.prog.show("Fetching from cloud...");

    try {
      const data = await API.getEncodedData(id);
      if (data.error) {
        this.prog.error(data.error);
        return;
      }

      this.prog.update(30, "Decoding...", `${data.encodedLen?.toLocaleString() || "?"} chars | ${data.chunks || "?"} chunks`);

      // Decode
      const decoded = JH_ENGINE.decode(data.encoded, (pct, status) => {
        this.prog.update(30 + Math.floor(pct * 0.6), status);
      });

      this.decodedData = decoded;
      this.currentFilename = data.title || `decoded_${id}`;

      this.prog.success("Decoded successfully!");
      this.showResult(decoded, data);

      // Track
      Analytics.track("download", { postId: id, size: decoded.length });

    } catch (err) {
      // err.message যদি না থাকে, তবে সরাসরি err প্রিন্ট করবে
      this.prog.error("Invalid encoded text: " + (err.message || err));
      console.error("Decode error details:", err);
    }
  },

  async decodePastedText() {
    const textArea = document.getElementById("decode-input");
    const text = textArea?.value?.trim();
    if (!text) {
      Swal.fire({ icon: "warning", title: "Paste encoded text first", background: "var(--bg-secondary)", color: "var(--text-primary)" });
      return;
    }

    this.prog = new JHProgress("decode-progress", { autoHide: false });
    this.prog.show("Decoding...");

    try {
      const decoded = JH_ENGINE.decode(text, (pct, status) => {
        this.prog.update(pct, status);
      });

      this.decodedData = decoded;
      this.currentFilename = "decoded_file";

      this.prog.success("Decoded!");
      this.showResult(decoded, { encodedLen: text.length, title: "Pasted text" });

    } catch (err) {
      // err.message যদি না থাকে, তবে সরাসরি err প্রিন্ট করবে
      this.prog.error("Invalid encoded text: " + (err.message || err));
      console.error("Decode error details:", err);
    }
  },

  showResult(uint8Array, meta) {
    const resultSection = document.getElementById("decode-result");
    if (!resultSection) return;

    resultSection.classList.remove("jh-hidden");

    // Create blob
    this.currentBlob = new Blob([uint8Array]);

    // Try to detect mime type
    const mime = this.detectMime(uint8Array, meta.title);
    const blobUrl = URL.createObjectURL(new Blob([uint8Array], { type: mime }));

    // Preview
    const preview = document.getElementById("decode-preview");
    if (preview) {
      if (mime.startsWith("image/")) {
        preview.innerHTML = `<img src="${blobUrl}" class="jh-preview-img" alt="Preview"/>`;
      } else if (mime.startsWith("video/")) {
        preview.innerHTML = `<video src="${blobUrl}" controls class="jh-preview-video"></video>`;
      } else if (mime.startsWith("audio/")) {
        preview.innerHTML = `<audio src="${blobUrl}" controls class="jh-preview-audio"></audio>`;
      } else if (mime.startsWith("text/") || this.isTextFile(uint8Array)) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(uint8Array);
        preview.innerHTML = `<pre class="jh-preview-code"><code>${sanitizeHTML(text.substring(0, 2000))}${text.length > 2000 ? "..." : ""}</code></pre>`;
      } else {
        preview.innerHTML = `
          <div class="jh-preview-file">
            <i data-lucide="file" style="width:64px;height:64px"></i>
            <p>${formatBytes(uint8Array.length)}</p>
            <p>Type: ${mime}</p>
          </div>
        `;
      }
      lucide.createIcons();
    }

    // Stats
    const stats = document.getElementById("decode-stats");
    if (stats) {
      stats.innerHTML = `
        <div class="jh-stats-grid">
          <div class="jh-stat"><span>Size</span><strong>${formatBytes(uint8Array.length)}</strong></div>
          <div class="jh-stat"><span>Encoded</span><strong>${Number(meta.encodedLen || 0).toLocaleString()} chars</strong></div>
          <div class="jh-stat"><span>Type</span><strong>${mime}</strong></div>
        </div>
      `;
    }

    // Enable download
    const dlBtn = document.getElementById("btn-download");
    if (dlBtn) dlBtn.classList.remove("jh-disabled");
  },

  detectMime(uint8, filename = "") {
    // Magic number detection
    if (uint8[0] === 0xFF && uint8[1] === 0xD8) return "image/jpeg";
    if (uint8[0] === 0x89 && uint8[1] === 0x50) return "image/png";
    if (uint8[0] === 0x47 && uint8[1] === 0x49) return "image/gif";
    if (uint8[0] === 0x52 && uint8[1] === 0x49) return "image/webp";
    if (uint8[0] === 0x25 && uint8[1] === 0x50) return "application/pdf";
    if (uint8[0] === 0x50 && uint8[1] === 0x4B) return "application/zip";
    if (uint8[0] === 0x1F && uint8[1] === 0x8B) return "application/gzip";
    if (uint8.length > 8) {
      const sig = new TextDecoder().decode(uint8.slice(0, 8));
      if (sig.includes("ID3") || sig.startsWith("fLaC")) return "audio/mpeg";
      if (sig.startsWith("fLaC")) return "audio/flac";
      if (sig.startsWith("OggS")) return "audio/ogg";
      if (sig.startsWith("ftyp")) return "video/mp4";
    }

    // Extension-based fallback
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeMap = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
      webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg",
      pdf: "application/pdf", zip: "application/zip", txt: "text/plain",
      json: "application/json", html: "text/html", css: "text/css", js: "text/javascript",
    };
    return mimeMap[ext] || "application/octet-stream";
  },

  isTextFile(uint8) {
    // Check if mostly printable ASCII/UTF-8
    let printable = 0;
    for (let i = 0; i < Math.min(uint8.length, 1000); i++) {
      const b = uint8[i];
      if ((b >= 32 && b < 127) || b === 9 || b === 10 || b === 13) printable++;
    }
    return printable / Math.min(uint8.length, 1000) > 0.9;
  },

  downloadFile() {
    if (!this.currentBlob || !this.decodedData) return;

    const mime = this.detectMime(this.decodedData, this.currentFilename);
    const blob = new Blob([this.decodedData], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = this.currentFilename.includes(".") ? this.currentFilename : this.currentFilename + ".bin";
    a.click();
    URL.revokeObjectURL(url);

    Swal.fire({
      icon: "success", title: "Downloaded!", timer: 1200, showConfirmButton: false,
      background: "var(--bg-secondary)", color: "var(--text-primary)",
    });
  },

  copyTextOutput() {
    if (!this.decodedData) return;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(this.decodedData);
    copyToClipboard(text);
    Swal.fire({
      icon: "success", title: "Copied!", timer: 1200, showConfirmButton: false,
      background: "var(--bg-secondary)", color: "var(--text-primary)",
    });
  }
};

// Init on page load
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("decode-page")) {
    DecodePage.init();
  }
});
