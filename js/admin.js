// ============================================================
// JH GODOWN — Admin Panel: Stats, Storage, Posts, Users, Broadcast
// ============================================================

const AdminPanel = {
  isAuthenticated: false,

  init() {
    this.checkAuth();
    this.setupUI();
  },

  checkAuth() {
    const authed = sessionStorage.getItem("jh_admin") === "1";
    this.isAuthenticated = authed;

    const loginSection = document.getElementById("admin-login");
    const dashboard = document.getElementById("admin-dashboard");

    if (loginSection) loginSection.style.display = authed ? "none" : "flex";
    if (dashboard) dashboard.style.display = authed ? "block" : "none";

    if (authed) {
      this.loadAllData();
    }
  },

  setupUI() {
    // Login button
    const loginBtn = document.getElementById("btn-admin-login");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => this.login());
    }

    // Enter key on password
    const passInput = document.getElementById("admin-password");
    if (passInput) {
      passInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.login();
      });
    }

    // Logout
    const logoutBtn = document.getElementById("btn-admin-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.logout());
    }

    // Refresh
    const refreshBtn = document.getElementById("btn-admin-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadAllData());
    }

    // Add storage
    const addStorageBtn = document.getElementById("btn-add-storage");
    if (addStorageBtn) {
      addStorageBtn.addEventListener("click", () => this.addStorage());
    }

    // Broadcast
    const broadcastBtn = document.getElementById("btn-broadcast");
    if (broadcastBtn) {
      broadcastBtn.addEventListener("click", () => this.sendBroadcast());
    }
  },

  login() {
    const password = document.getElementById("admin-password")?.value;
    if (!password) return;

    const hash = CryptoJS.SHA256(password).toString();
    if (hash === JH_CONFIG.ADMIN_PASS) {
      sessionStorage.setItem("jh_admin", "1");
      this.checkAuth();
    } else {
      Swal.fire({
        icon: "error", title: "Wrong password",
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });
    }
  },

  logout() {
    sessionStorage.removeItem("jh_admin");
    this.checkAuth();
  },

  async loadAllData() {
    this.loadStats();
    this.loadStorage();
    this.loadRecentPosts();
    this.loadRecentUsers();
  },

  async loadStats() {
    const container = document.getElementById("admin-stats");
    if (!container) return;

    container.innerHTML = `<div class="jh-skeleton" style="height:80px"></div>`;

    try {
      const stats = await API.getAdminStats();
      container.innerHTML = `
        <div class="jh-admin-stats-grid">
          <div class="jh-admin-stat">
            <i data-lucide="users"></i>
            <strong>${Number(stats.totalUsers || 0).toLocaleString()}</strong>
            <span>Users</span>
          </div>
          <div class="jh-admin-stat">
            <i data-lucide="file-text"></i>
            <strong>${Number(stats.totalPosts || 0).toLocaleString()}</strong>
            <span>Posts</span>
          </div>
          <div class="jh-admin-stat">
            <i data-lucide="database"></i>
            <strong>${Number(stats.totalSheets || 0)}</strong>
            <span>Storage Sheets</span>
          </div>
          <div class="jh-admin-stat">
            <i data-lucide="activity"></i>
            <strong>${Number(stats.postsLast24h || 0)}</strong>
            <span>Posts (24h)</span>
          </div>
          ${stats.nsfwPosts ? `
          <div class="jh-admin-stat jh-admin-stat-warn">
            <i data-lucide="alert-triangle"></i>
            <strong>${stats.nsfwPosts}</strong>
            <span>NSFW Posts</span>
          </div>` : ""}
          <div class="jh-admin-stat">
            <i data-lucide="hard-drive"></i>
            <strong>${stats.activeStorage ? stats.activeStorage.usedPct + "%" : "N/A"}</strong>
            <span>Storage Used</span>
          </div>
        </div>
      `;
      lucide.createIcons();
    } catch (err) {
      container.innerHTML = `<div class="jh-error-text">Failed to load stats</div>`;
    }
  },

  async loadStorage() {
    const container = document.getElementById("admin-storage");
    if (!container) return;

    try {
      const data = await API.getStorageList();
      if (!data.sheets || data.sheets.length === 0) {
        container.innerHTML = `<p>No storage sheets</p>`;
        return;
      }

      container.innerHTML = `
        <div class="jh-admin-storage-list">
          ${data.sheets.map(s => `
            <div class="jh-storage-item jh-storage-${(s.status || "EMPTY").toLowerCase()}">
              <div class="jh-storage-info">
                <strong>${s.sheetId}</strong>
                <span class="jh-storage-status">${s.status}</span>
              </div>
              <div class="jh-storage-bar">
                <div class="jh-storage-bar-fill" style="width:${s.usedPct || 0}%"></div>
              </div>
              <div class="jh-storage-meta">
                <span>${Number(s.totalRows || 0).toLocaleString()} / ${Number(s.maxLimit || 500000).toLocaleString()}</span>
                <span>${s.usedPct || 0}%</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="jh-error-text">Failed to load storage</div>`;
    }
  },

  async loadRecentPosts() {
    const container = document.getElementById("admin-posts");
    if (!container) return;

    try {
      const data = await API.getRecentPosts(20);
      if (!data.posts || data.posts.length === 0) {
        container.innerHTML = `<p>No posts</p>`;
        return;
      }

      container.innerHTML = `
        <div class="jh-admin-table-wrap">
          <table class="jh-admin-table">
            <thead><tr><th>ID</th><th>Title</th><th>User</th><th>Size</th><th>Actions</th></tr></thead>
            <tbody>
              ${data.posts.map(p => `
                <tr>
                  <td><code>${p.postId}</code></td>
                  <td>${sanitizeHTML(p.title)}</td>
                  <td>@${sanitizeHTML(p.username)}</td>
                  <td>${p.originalSize || "?"}</td>
                  <td>
                    <button class="jh-btn jh-btn-danger jh-btn-sm" onclick="AdminPanel.deletePost('${p.postId}')">
                      <i data-lucide="trash-2"></i>
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      lucide.createIcons();
    } catch (err) {
      container.innerHTML = `<div class="jh-error-text">Failed to load posts</div>`;
    }
  },

  async loadRecentUsers() {
    const container = document.getElementById("admin-users");
    if (!container) return;

    try {
      const data = await API.getRecentUsers(20);
      if (!data.users || data.users.length === 0) {
        container.innerHTML = `<p>No users</p>`;
        return;
      }

      container.innerHTML = `
        <div class="jh-admin-table-wrap">
          <table class="jh-admin-table">
            <thead><tr><th>ID</th><th>Username</th><th>Name</th><th>Joined</th></tr></thead>
            <tbody>
              ${data.users.map(u => `
                <tr>
                  <td><code>${u.userId}</code></td>
                  <td>@${sanitizeHTML(u.username)}</td>
                  <td>${sanitizeHTML(u.name || "—")}</td>
                  <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="jh-error-text">Failed to load users</div>`;
    }
  },

  async addStorage() {
    const sheetId = document.getElementById("storage-sheet-id")?.value?.trim();
    const spreadsheetId = document.getElementById("storage-spreadsheet-id")?.value?.trim();
    const sheetName = document.getElementById("storage-sheet-name")?.value?.trim() || "chunks";

    if (!sheetId || !spreadsheetId) {
      Swal.fire({ icon: "warning", title: "Fill all required fields", background: "var(--bg-secondary)", color: "var(--text-primary)" });
      return;
    }

    try {
      Swal.fire({ title: "Adding...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const resp = await API.adminAddStorage(sheetId, spreadsheetId, sheetName);

      if (resp.success) {
        Swal.fire({
          icon: "success", title: "Storage added!", timer: 1500, showConfirmButton: false,
          background: "var(--bg-secondary)", color: "var(--text-primary)",
        });
        document.getElementById("storage-sheet-id").value = "";
        document.getElementById("storage-spreadsheet-id").value = "";
        this.loadStorage();
      } else {
        throw new Error(resp.error || "Failed");
      }
    } catch (err) {
      Swal.fire({
        icon: "error", title: "Failed", text: err.message,
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });
    }
  },

  async deletePost(postId) {
    const result = await Swal.fire({
      title: "Delete post?",
      text: `Post ${postId} will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--accent-red)",
      confirmButtonText: "Delete",
      background: "var(--bg-secondary)", color: "var(--text-primary)",
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: "Deleting...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await API.adminDeletePost(postId);
        Swal.fire({
          icon: "success", title: "Deleted!", timer: 1500, showConfirmButton: false,
          background: "var(--bg-secondary)", color: "var(--text-primary)",
        });
        this.loadRecentPosts();
        this.loadStats();
      } catch (err) {
        Swal.fire({
          icon: "error", title: "Failed", text: err.message,
          background: "var(--bg-secondary)", color: "var(--text-primary)",
        });
      }
    }
  },

  async sendBroadcast() {
    const message = document.getElementById("broadcast-message")?.value?.trim();
    if (!message) {
      Swal.fire({ icon: "warning", title: "Enter a message", background: "var(--bg-secondary)", color: "var(--text-primary)" });
      return;
    }

    try {
      Swal.fire({ title: "Sending...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await API.adminBroadcast(message);
      Swal.fire({
        icon: "success", title: "Broadcast sent!", timer: 1500, showConfirmButton: false,
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });
      document.getElementById("broadcast-message").value = "";
    } catch (err) {
      Swal.fire({
        icon: "error", title: "Failed", text: err.message,
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });
    }
  }
};

// Init on page load
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("admin-page")) {
    AdminPanel.init();
  }
});
