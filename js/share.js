// ============================================================
// JH GODOWN — Deep Linking & Share System + QR Code
// ============================================================

const Share = {
  // ─── Route helpers ───
  routes: {
    post:    (id) => `${JH_CONFIG.SITE_URL}/post.html?id=${id}`,
    profile: (id) => `${JH_CONFIG.SITE_URL}/profile.html?id=${id}`,
    decode:  (id) => `${JH_CONFIG.SITE_URL}/decode.html?id=${id}`,
    tag:     (tag) => `${JH_CONFIG.SITE_URL}/?tag=${encodeURIComponent(tag)}`,
  },

  // ─── Get shareable URL ───
  getUrl(type, id) {
    return this.routes[type](id);
  },

  // ─── Web Share API + fallback ───
  async share({ title, text, url, postId }) {
    const shareUrl = url || (postId ? this.routes.post(postId) : location.href);
    const shareData = {
      title: title || JH_CONFIG.APP_NAME,
      text: text || "Check this out on Jh Godown!",
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return { success: true, method: "native" };
      } catch (err) {
        if (err.name !== "AbortError") console.warn("Share failed:", err);
      }
    }

    // Fallback to SweetAlert2 dialog
    const waLink = `https://wa.me/?text=${encodeURIComponent(shareData.title + " " + shareData.url)}`;
    const tgLink = `https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.title)}`;
    const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;

    Swal.fire({
      title: "Share",
      html: `
        <div class="jh-share-dialog">
          <input type="text" class="jh-input" value="${shareData.url}" id="jh-share-url" readonly style="width:100%;margin-bottom:12px;text-align:center"/>
          <div class="jh-share-btns">
            <a href="${waLink}" target="_blank" class="jh-btn jh-btn-success jh-btn-sm"><i data-lucide="message-circle"></i> WhatsApp</a>
            <a href="${tgLink}" target="_blank" class="jh-btn jh-btn-primary jh-btn-sm"><i data-lucide="send"></i> Telegram</a>
            <a href="${fbLink}" target="_blank" class="jh-btn jh-btn-info jh-btn-sm"><i data-lucide="facebook"></i> Facebook</a>
            <button class="jh-btn jh-btn-secondary jh-btn-sm" onclick="copyToClipboard(document.getElementById('jh-share-url').value).then(()=>Swal.close())"><i data-lucide="copy"></i> Copy Link</button>
          </div>
          ${JH_CONFIG.FEATURES.QR_CODE_SHARE ? `<div class="jh-qr-wrap"><img src="${getQRCodeURL(shareData.url)}" alt="QR Code" class="jh-qr-img"/><p>Scan to open</p></div>` : ""}
        </div>
      `,
      background: "var(--bg-secondary)",
      color: "var(--text-primary)",
      confirmButtonColor: "var(--accent-blue)",
      confirmButtonText: "Close",
      didOpen: () => lucide.createIcons(),
    });

    return { success: true, method: "fallback" };
  },

  // ─── Copy post ID ───
  async copyPostId(postId) {
    await copyToClipboard(postId);
    Swal.fire({
      icon: "success",
      title: "Copied!",
      text: `Post ID ${postId} copied to clipboard`,
      timer: 1500,
      showConfirmButton: false,
      background: "var(--bg-secondary)",
      color: "var(--text-primary)",
    });
  },

  // ─── Generate QR Code for post ───
  getQRCode(postId) {
    if (!JH_CONFIG.FEATURES.QR_CODE_SHARE) return null;
    return getQRCodeURL(this.routes.post(postId));
  },

  // ─── Handle deep links on page load ───
  handleDeepLink() {
    const p = new URLSearchParams(location.search);
    const postId = p.get("id");
    const profileId = p.get("profile");
    const tag = p.get("tag");

    if (postId) {
      // On index.html, open the post view
      if (typeof Feed !== "undefined" && Feed.openPost) {
        Feed.openPost(postId);
      }
    }

    if (tag) {
      if (typeof Feed !== "undefined" && Feed.filterByTag) {
        Feed.filterByTag(tag);
      }
    }
  },
};

// ─── WebRTC P2P File Transfer ───
const P2PTransfer = {
  peerConnection: null,
  dataChannel: null,
  isInitiator: false,

  // Generate a simple room code for P2P
  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },

  // Initialize WebRTC (simplified - uses a basic signaling approach)
  async init(roomCode, isInitiator = false) {
    if (!JH_CONFIG.FEATURES.P2P_TRANSFER) {
      throw new Error("P2P Transfer is disabled");
    }

    this.isInitiator = isInitiator;
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    if (isInitiator) {
      this.dataChannel = this.peerConnection.createDataChannel("fileTransfer");
      this._setupDataChannel();
    } else {
      this.peerConnection.ondatachannel = (e) => {
        this.dataChannel = e.channel;
        this._setupDataChannel();
      };
    }

    return this.peerConnection;
  },

  _setupDataChannel() {
    this.dataChannel.onopen = () => console.log("P2P: Data channel open");
    this.dataChannel.onclose = () => console.log("P2P: Data channel closed");
    this.dataChannel.onmessage = (e) => {
      // Handle incoming file chunks
      this._onReceiveChunk(e.data);
    };
  },

  _onReceiveChunk(data) {
    // Override this callback externally
    if (this.onReceive) this.onReceive(data);
  },

  async sendFileChunk(chunk) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(chunk);
    }
  },

  close() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.peerConnection) this.peerConnection.close();
    this.dataChannel = null;
    this.peerConnection = null;
  }
};

// Legacy alias
const TOTKA_SHARE = Share;
