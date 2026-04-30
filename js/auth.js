// ============================================================
// JH GODOWN — Authentication & Session Management
// ============================================================

const Auth = {
  // ─── Get current session ───
  getSession() {
    try {
      const raw = localStorage.getItem("jh_session");
      if (!raw) return null;
      const session = JSON.parse(raw);
      // Check expiry (7 days)
      if (Date.now() - session._timestamp > 7 * 86400000) {
        this.logout();
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  },

  // ─── Save session ───
  saveSession(data) {
    const session = {
      ...data,
      _timestamp: Date.now(),
    };
    localStorage.setItem("jh_session", JSON.stringify(session));
  },

  // ─── Check if logged in ───
  isLoggedIn() {
    return !!this.getSession();
  },

  // ─── Get current user ───
  getUser() {
    const s = this.getSession();
    if (!s) return null;
    return {
      userId: s.userId,
      username: s.username,
      name: s.name,
      bio: s.bio,
      profilePic: s.profilePic,
      profession: s.profession,
      socialLinks: s.socialLinks,
      createdAt: s.createdAt,
    };
  },

  // ─── Get auth token ───
  getToken() {
    const s = this.getSession();
    return s ? s.token : null;
  },

  // ─── Login ───
  async login(loginId, password) {
    const resp = await API.login(loginId, password);
    if (resp.success) {
      this.saveSession(resp);
      // Track analytics
      await Analytics.track("login", { username: resp.username });
    }
    return resp;
  },

  // ─── Signup ───
  async signup(data) {
    const resp = await API.signup(data);
    if (resp.success) {
      // Auto-login after signup
      const loginResp = await API.login(data.loginId, data.password);
      if (loginResp.success) {
        this.saveSession(loginResp);
      }
      // Notify admin
      Notify.newUser({
        name: data.name || data.username,
        username: data.username,
        userId: resp.userId,
        loginId: data.loginId,
        bio: data.bio || "",
        profession: data.profession || "",
      }).catch(() => {});
    }
    return resp;
  },

  // ─── Logout ───
  logout() {
    localStorage.removeItem("jh_session");
    Cache.clear();
    location.reload();
  },

  // ─── Require auth (redirect to login if not) ───
  requireAuth() {
    if (!this.isLoggedIn()) {
      const current = encodeURIComponent(location.pathname + location.search);
      location.href = `login.html?redirect=${current}`;
      return false;
    }
    return true;
  },

  // ─── Update profile UI across pages ───
  updateUI() {
    const user = this.getUser();
    const avatars = document.querySelectorAll("[data-auth-avatar]");
    const names = document.querySelectorAll("[data-auth-name]");
    const loginBtns = document.querySelectorAll("[data-auth-login]");
    const logoutBtns = document.querySelectorAll("[data-auth-logout]");
    const authed = document.querySelectorAll("[data-auth-show]");
    const guest = document.querySelectorAll("[data-guest-show]");

    if (user) {
      avatars.forEach(el => {
        el.src = user.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%2358a6ff'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6'/%3E%3C/svg%3E";
      });
      names.forEach(el => { el.textContent = user.name || user.username; });
      loginBtns.forEach(el => el.style.display = "none");
      logoutBtns.forEach(el => el.style.display = "");
      authed.forEach(el => el.style.display = "");
      guest.forEach(el => el.style.display = "none");
    } else {
      avatars.forEach(el => { el.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%238b949e'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6'/%3E%3C/svg%3E"; });
      names.forEach(el => { el.textContent = "Guest"; });
      loginBtns.forEach(el => el.style.display = "");
      logoutBtns.forEach(el => el.style.display = "none");
      authed.forEach(el => el.style.display = "none");
      guest.forEach(el => el.style.display = "");
    }
  },
};

// ─── Personal Analytics ───
const Analytics = {
  async track(event, data = {}) {
    if (!JH_CONFIG.FEATURES.ANALYTICS) return;
    try {
      const entry = {
        id: Date.now() + "_" + Math.random().toString(36).slice(2),
        event,
        data,
        timestamp: Date.now(),
      };
      await DBManager.set(JH_CONFIG.DB.STORES.ANALYTICS, entry);
    } catch (e) {}
  },

  async getStats() {
    const entries = await DBManager.getAll(JH_CONFIG.DB.STORES.ANALYTICS);
    const uploads = entries.filter(e => e.event === "upload");
    const downloads = entries.filter(e => e.event === "download");
    const logins = entries.filter(e => e.event === "login");

    // By day (last 7 days)
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { uploads: 0, downloads: 0 };
    }

    uploads.forEach(e => {
      const d = new Date(e.timestamp).toISOString().slice(0, 10);
      if (days[d] !== undefined) days[d].uploads++;
    });
    downloads.forEach(e => {
      const d = new Date(e.timestamp).toISOString().slice(0, 10);
      if (days[d] !== undefined) days[d].downloads++;
    });

    return {
      totalUploads: uploads.length,
      totalDownloads: downloads.length,
      totalLogins: logins.length,
      daily: days,
    };
  },

  renderChart(containerId, stats) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const days = Object.keys(stats.daily);
    const uploadData = days.map(d => stats.daily[d].uploads);
    const downloadData = days.map(d => stats.daily[d].downloads);
    const maxVal = Math.max(...uploadData, ...downloadData, 1);

    const barWidth = 30;
    const gap = 10;
    const chartHeight = 150;
    const totalWidth = days.length * (barWidth + gap) + gap;

    let svg = `<svg viewBox="0 0 ${totalWidth} ${chartHeight + 40}" class="jh-analytics-chart">`;

    days.forEach((day, i) => {
      const x = gap + i * (barWidth + gap);
      const upH = (uploadData[i] / maxVal) * chartHeight;
      const downH = (downloadData[i] / maxVal) * chartHeight;

      if (uploadData[i] > 0) {
        svg += `<rect x="${x}" y="${chartHeight - upH}" width="${barWidth/2 - 1}" height="${upH}" fill="var(--accent-green)" rx="3"/>`;
      }
      if (downloadData[i] > 0) {
        svg += `<rect x="${x + barWidth/2}" y="${chartHeight - downH}" width="${barWidth/2 - 1}" height="${downH}" fill="var(--accent-blue)" rx="3"/>`;
      }

      svg += `<text x="${x + barWidth/2}" y="${chartHeight + 20}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${day.slice(5)}</text>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }
};
