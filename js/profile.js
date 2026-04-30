// ============================================================
// JH GODOWN — Profile Page: View & Edit Profile, User Posts
// ============================================================

const ProfilePage = {
  userId: null,
  isOwnProfile: false,
  userData: null,

  async init() {
    const params = new URLSearchParams(location.search);
    this.userId = params.get("id");

    // If no ID, show current user's profile
    if (!this.userId) {
      const session = Auth.getSession();
      if (session) {
        this.userId = session.userId;
        this.isOwnProfile = true;
      } else {
        location.href = "login.html?redirect=" + encodeURIComponent(location.href);
        return;
      }
    } else {
      const session = Auth.getSession();
      this.isOwnProfile = session && session.userId === this.userId;
    }

    await this.loadProfile();
    if (this.isOwnProfile) {
      this.setupEditForm();
    }
  },

  async loadProfile() {
    const container = document.getElementById("profile-container");
    if (!container) return;

    container.innerHTML = `<div class="jh-skeleton" style="height:200px"></div>`;

    try {
      // Get user info from GAS
      const userData = await API.getUserInfo(this.userId);
      if (userData.error) {
        container.innerHTML = `<div class="jh-empty-state"><i data-lucide="user-x"></i><p>User not found</p></div>`;
        lucide.createIcons();
        return;
      }

      this.userData = userData;
      this.renderProfile(userData);
      this.loadUserPosts(this.userId);

      // Load personal analytics if own profile
      if (this.isOwnProfile && JH_CONFIG.FEATURES.ANALYTICS) {
        this.loadAnalytics();
      }

    } catch (err) {
      container.innerHTML = `<div class="jh-empty-state jh-error"><i data-lucide="alert-circle"></i><p>Failed to load profile</p></div>`;
      lucide.createIcons();
    }
  },

  renderProfile(user) {
    const container = document.getElementById("profile-container");
    if (!container) return;

    const social = user.socialLinks || {};
    const socialHtml = [
      social.twitter ? `<a href="https://twitter.com/${social.twitter}" target="_blank" class="jh-social-link"><i data-lucide="twitter"></i></a>` : "",
      social.ig ? `<a href="https://instagram.com/${social.ig}" target="_blank" class="jh-social-link"><i data-lucide="instagram"></i></a>` : "",
      social.fb ? `<a href="https://facebook.com/${social.fb}" target="_blank" class="jh-social-link"><i data-lucide="facebook"></i></a>` : "",
      social.gh ? `<a href="https://github.com/${social.gh}" target="_blank" class="jh-social-link"><i data-lucide="github"></i></a>` : "",
    ].filter(Boolean).join("");

    container.innerHTML = `
      <div class="jh-profile-header">
        <div class="jh-profile-avatar-wrap">
          <img src="${user.profilePic || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%2358a6ff'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6'/%3E%3C/svg%3E`}" alt="@${user.username}" class="jh-profile-avatar"/>
          ${this.isOwnProfile ? `<button class="jh-avatar-edit" onclick="document.getElementById('avatar-input').click()" title="Change photo"><i data-lucide="camera"></i></button>` : ""}
          <input type="file" id="avatar-input" accept="image/*" style="display:none" onchange="ProfilePage.handleAvatarChange(event)">
        </div>
        <div class="jh-profile-info">
          <h2 class="jh-profile-name">${sanitizeHTML(user.name || user.username)}</h2>
          <p class="jh-profile-username">@${sanitizeHTML(user.username)}</p>
          ${user.profession ? `<p class="jh-profile-profession"><i data-lucide="briefcase"></i> ${sanitizeHTML(user.profession)}</p>` : ""}
          ${user.bio ? `<p class="jh-profile-bio">${sanitizeHTML(user.bio)}</p>` : ""}
          ${socialHtml ? `<div class="jh-profile-social">${socialHtml}</div>` : ""}
          <div class="jh-profile-meta">
            <span><i data-lucide="calendar"></i> Joined ${new Date(user.createdAt).toLocaleDateString()}</span>
            <span><i data-lucide="file-text"></i> ${user.postCount || 0} posts</span>
          </div>
        </div>
        ${this.isOwnProfile ? `<button class="jh-btn jh-btn-secondary" onclick="ProfilePage.toggleEdit()"><i data-lucide="edit-2"></i> Edit</button>` : ""}
      </div>

      ${this.isOwnProfile ? `
      <div class="jh-edit-form jh-hidden" id="edit-form">
        <h3>Edit Profile</h3>
        <div class="jh-form-group">
          <label>Display Name</label>
          <input type="text" id="edit-name" class="jh-input" value="${sanitizeHTML(user.name || "")}" maxlength="50"/>
        </div>
        <div class="jh-form-group">
          <label>Bio (max 150 chars)</label>
          <textarea id="edit-bio" class="jh-input" maxlength="150" rows="3">${sanitizeHTML(user.bio || "")}</textarea>
          <span class="jh-char-count"><span id="bio-count">${(user.bio || "").length}</span>/150</span>
        </div>
        <div class="jh-form-group">
          <label>Profession</label>
          <input type="text" id="edit-profession" class="jh-input" value="${sanitizeHTML(user.profession || "")}" maxlength="50"/>
        </div>
        <div class="jh-form-group">
          <label>Social Links</label>
          <div class="jh-social-inputs">
            <input type="text" id="edit-twitter" class="jh-input" placeholder="Twitter username" value="${sanitizeHTML(social.twitter || "")}"/>
            <input type="text" id="edit-ig" class="jh-input" placeholder="Instagram username" value="${sanitizeHTML(social.ig || "")}"/>
            <input type="text" id="edit-fb" class="jh-input" placeholder="Facebook username" value="${sanitizeHTML(social.fb || "")}"/>
            <input type="text" id="edit-gh" class="jh-input" placeholder="GitHub username" value="${sanitizeHTML(social.gh || "")}"/>
          </div>
        </div>
        <div class="jh-form-actions">
          <button class="jh-btn jh-btn-primary" onclick="ProfilePage.saveProfile()"><i data-lucide="save"></i> Save</button>
          <button class="jh-btn jh-btn-secondary" onclick="ProfilePage.toggleEdit()">Cancel</button>
        </div>
      </div>
      ` : ""}
    `;
    lucide.createIcons();

    // Bio char counter
    const bioInput = document.getElementById("edit-bio");
    if (bioInput) {
      bioInput.addEventListener("input", (e) => {
        document.getElementById("bio-count").textContent = e.target.value.length;
      });
    }
  },

  async loadUserPosts(userId) {
    const container = document.getElementById("user-posts");
    if (!container) return;

    container.innerHTML = `<div class="jh-skeleton" style="height:100px"></div>`;

    try {
      const data = await API.getUserPosts(userId);
      if (!data.posts || data.posts.length === 0) {
        container.innerHTML = `<div class="jh-empty-state"><i data-lucide="inbox"></i><p>No posts yet</p></div>`;
        lucide.createIcons();
        return;
      }

      container.innerHTML = `
        <h3 class="jh-section-title"><i data-lucide="file-text"></i> ${data.posts.length} Posts</h3>
        <div class="jh-user-posts-grid">
          ${data.posts.map(post => `
            <div class="jh-user-post-card">
              <div class="jh-user-post-icon"><i data-lucide="${ImageProcessor.getFileIcon("", post.title)}"></i></div>
              <h4>${sanitizeHTML(post.title)}</h4>
              <div class="jh-user-post-meta">
                <span>${timeAgo(post.timestamp)}</span>
                <span>${post.originalSize || "?"}</span>
              </div>
              <div class="jh-user-post-actions">
                <a href="decode.html?id=${post.postId}" class="jh-btn jh-btn-primary jh-btn-sm">Decode</a>
                ${this.isOwnProfile ? `<button class="jh-btn jh-btn-danger jh-btn-sm" onclick="Feed.deletePost('${post.postId}')">Delete</button>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;
      lucide.createIcons();

    } catch (err) {
      container.innerHTML = `<div class="jh-empty-state"><p>Failed to load posts</p></div>`;
    }
  },

  async loadAnalytics() {
    const container = document.getElementById("analytics-section");
    if (!container) return;

    const stats = await Analytics.getStats();
    container.innerHTML = `
      <h3 class="jh-section-title"><i data-lucide="bar-chart-2"></i> Your Activity</h3>
      <div class="jh-stats-grid">
        <div class="jh-stat-card">
          <i data-lucide="upload-cloud"></i>
          <strong>${stats.totalUploads}</strong>
          <span>Uploads</span>
        </div>
        <div class="jh-stat-card">
          <i data-lucide="download-cloud"></i>
          <strong>${stats.totalDownloads}</strong>
          <span>Downloads</span>
        </div>
        <div class="jh-stat-card">
          <i data-lucide="log-in"></i>
          <strong>${stats.totalLogins}</strong>
          <span>Logins</span>
        </div>
      </div>
      <div id="analytics-chart"></div>
    `;
    lucide.createIcons();
    Analytics.renderChart("analytics-chart", stats);
  },

  toggleEdit() {
    document.getElementById("edit-form")?.classList.toggle("jh-hidden");
  },

  async handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      Swal.fire({ title: "Compressing...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const { base64 } = await ImageProcessor.compressProfilePic(file);
      const user = Auth.getUser();

      await API.updateProfile({
        userId: user.userId,
        profilePic: base64,
      });

      // Update session
      const session = Auth.getSession();
      session.profilePic = base64;
      Auth.saveSession(session);

      // Notify
      Notify.profileUpdate({ userId: user.userId, username: user.username, name: user.name, bio: user.bio }).catch(() => {});

      Swal.fire({
        icon: "success", title: "Photo updated!", timer: 1500, showConfirmButton: false,
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });

      this.loadProfile();

    } catch (err) {
      Swal.fire({
        icon: "error", title: "Failed", text: err.message,
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });
    }
  },

  async saveProfile() {
    const user = Auth.getUser();
    if (!user) return;

    const name = document.getElementById("edit-name")?.value?.trim();
    const bio = document.getElementById("edit-bio")?.value?.trim();
    const profession = document.getElementById("edit-profession")?.value?.trim();
    const socialLinks = {
      twitter: document.getElementById("edit-twitter")?.value?.trim() || "",
      ig: document.getElementById("edit-ig")?.value?.trim() || "",
      fb: document.getElementById("edit-fb")?.value?.trim() || "",
      gh: document.getElementById("edit-gh")?.value?.trim() || "",
    };

    try {
      Swal.fire({ title: "Saving...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      await API.updateProfile({
        userId: user.userId,
        name,
        bio,
        profession,
        socialLinks,
      });

      // Update session
      const session = Auth.getSession();
      session.name = name;
      session.bio = bio;
      session.profession = profession;
      session.socialLinks = socialLinks;
      Auth.saveSession(session);

      // Notify admin
      Notify.profileUpdate({ userId: user.userId, username: user.username, name, bio, profession }).catch(() => {});

      Swal.fire({
        icon: "success", title: "Profile updated!", timer: 1500, showConfirmButton: false,
        background: "var(--bg-secondary)", color: "var(--text-primary)",
      });

      this.toggleEdit();
      this.loadProfile();

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
  if (document.getElementById("profile-page")) {
    ProfilePage.init();
  }
});
