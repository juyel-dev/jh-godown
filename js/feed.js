// ============================================================
// JH GODOWN — Feed System: Infinite Scroll, Search, Tags, Cards
// ============================================================

const Feed = {
  state: {
    posts: [],
    page: 1,
    perPage: 10,
    sort: "newest",
    currentTag: null,
    searchQuery: "",
    isLoading: false,
    hasMore: true,
    viewMode: "grid", // "grid" or "list"
    bookmarks: new Set(),
  },

  // ─── Initialize feed ───
  async init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // Load bookmarks
    const bms = await BookmarkManager.getAll();
    bms.forEach(bm => this.state.bookmarks.add(bm.postId));

    // Initial load
    await this.loadPosts();

    // Infinite scroll
    window.addEventListener("scroll", () => {
      if (this.state.isLoading || !this.state.hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        this.loadMore();
      }
    });

    // Load tags
    this.loadTags();
  },

  // ─── Load posts (with cache) ───
  async loadPosts(reset = true) {
    if (this.state.isLoading) return;
    this.state.isLoading = true;

    if (reset) {
      this.state.page = 1;
      this.state.hasMore = true;
      this.container.innerHTML = this._skeletonLoader(6);
    }

    try {
      let data;
      const cacheKey = this.state.searchQuery
        ? `search_${this.state.searchQuery}_p${this.state.page}_${this.state.sort}`
        : `feed_p${this.state.page}_${this.state.sort}_${this.state.currentTag || "all"}`;

      // Try cache first
      const cached = Cache.get(cacheKey);
      if (cached && reset) {
        data = cached;
      } else {
        if (this.state.searchQuery) {
          data = await API.searchPosts(this.state.searchQuery, this.state.page, this.state.sort);
        } else {
          data = await API.getFeed(this.state.page, this.state.perPage, this.state.sort, this.state.currentTag);
        }
        Cache.set(cacheKey, data);
      }

      if (reset) this.state.posts = [];

      if (data.posts && data.posts.length > 0) {
        this.state.posts.push(...data.posts);
        this.state.hasMore = data.hasMore;
        this.render();
      } else if (reset) {
        this.container.innerHTML = `<div class="jh-empty-state"><i data-lucide="inbox"></i><p>No posts found</p></div>`;
        lucide.createIcons();
      }

    } catch (err) {
      console.error("Feed load error:", err);
      if (reset) {
        this.container.innerHTML = `<div class="jh-empty-state jh-error"><i data-lucide="alert-circle"></i><p>Failed to load feed</p><button class="jh-btn jh-btn-primary" onclick="Feed.loadPosts()">Retry</button></div>`;
        lucide.createIcons();
      }
    }

    this.state.isLoading = false;
  },

  // ─── Load more (pagination) ───
  async loadMore() {
    if (!this.state.hasMore || this.state.isLoading) return;
    this.state.page++;
    await this.loadPosts(false);
  },

  // ─── Render feed ───
  render() {
    if (!this.container) return;

    const posts = this.state.posts;
    const html = posts.map(post => this._renderCard(post)).join("");
    this.container.innerHTML = html;
    lucide.createIcons();

    // Attach event handlers
    posts.forEach(post => {
      // NSFW blur toggle
      const nsfwEl = document.getElementById(`nsfw-${post.postId}`);
      if (nsfwEl && post.nsfw) {
        nsfwEl.addEventListener("click", () => {
          nsfwEl.classList.toggle("nsfw-revealed");
        });
      }
    });
  },

  // ─── Render single card ───
  _renderCard(post) {
    const isBookmarked = this.state.bookmarks.has(post.postId);
    const isOwner = Auth.isLoggedIn() && Auth.getUser()?.userId === post.userId;
    const nsfwClass = post.nsfw ? "nsfw-blur" : "";

    return `
      <article class="jh-card ${this.state.viewMode === "list" ? "jh-card-list" : ""}" data-post-id="${post.postId}">
        <div class="jh-card-header">
          <a href="profile.html?id=${post.userId}" class="jh-card-user">
            <img src="${post.profilePic || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%2358a6ff'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6'/%3E%3C/svg%3E`}" alt="@${post.username}" class="jh-card-avatar"/>
            <div>
              <span class="jh-card-username">@${sanitizeHTML(post.username)}</span>
              <span class="jh-card-time">${timeAgo(post.timestamp)}</span>
            </div>
          </a>
          <div class="jh-card-actions">
            <button class="jh-btn-icon" onclick="Feed.toggleBookmark('${post.postId}')" title="${isBookmarked ? "Remove bookmark" : "Bookmark"}">
              <i data-lucide="${isBookmarked ? "bookmark-check" : "bookmark"}"></i>
            </button>
            <button class="jh-btn-icon" onclick="Share.share({title:'${sanitizeHTML(post.title)}',postId:'${post.postId}'})" title="Share">
              <i data-lucide="share-2"></i>
            </button>
          </div>
        </div>

        <div class="jh-card-body">
          ${post.nsfw ? `<div class="nsfw-overlay" id="nsfw-${post.postId}"><span>🔞 NSFW — Tap to reveal</span></div>` : ""}
          <div class="jh-card-preview ${nsfwClass}">
            <div class="jh-card-file-icon">
              <i data-lucide="${ImageProcessor.getFileIcon("", post.title)}"></i>
            </div>
          </div>
          <h3 class="jh-card-title">${sanitizeHTML(post.title)}</h3>
          ${post.tags ? `<div class="jh-card-tags">${post.tags.split(",").map(t => `<span class="jh-tag" onclick="Feed.filterByTag('${sanitizeHTML(t.trim())}')">#${sanitizeHTML(t.trim())}</span>`).join("")}</div>` : ""}
          ${post.description ? `<p class="jh-card-desc">${sanitizeHTML(post.description)}</p>` : ""}
        </div>

        <div class="jh-card-footer">
          <div class="jh-card-meta">
            <span><i data-lucide="hard-drive"></i> ${sanitizeHTML(post.originalSize || "?")}</span>
            <span><i data-lucide="file-code"></i> ${Number(post.encodedLen || 0).toLocaleString()} chars</span>
            <span><i data-lucide="layers"></i> ${post.totalChunks || "?"}</span>
          </div>
          <div class="jh-card-buttons">
            <a href="decode.html?id=${post.postId}" class="jh-btn jh-btn-primary jh-btn-sm">
              <i data-lucide="unlock"></i> Decode
            </a>
            <button class="jh-btn jh-btn-secondary jh-btn-sm" onclick="Share.copyPostId('${post.postId}')">
              <i data-lucide="copy"></i> ID
            </button>
            ${isOwner ? `<button class="jh-btn jh-btn-danger jh-btn-sm" onclick="Feed.deletePost('${post.postId}')">
              <i data-lucide="trash-2"></i>
            </button>` : ""}
          </div>
        </div>
      </article>
    `;
  },

  // ─── Skeleton loader ───
  _skeletonLoader(count) {
    return Array(count).fill(0).map(() => `
      <div class="jh-card jh-skeleton-card">
        <div class="jh-skeleton" style="height:32px;width:60%;margin-bottom:12px"></div>
        <div class="jh-skeleton" style="height:120px;margin-bottom:12px"></div>
        <div class="jh-skeleton" style="height:16px;width:80%"></div>
      </div>
    `).join("");
  },

  // ─── Filter by tag ───
  async filterByTag(tag) {
    this.state.currentTag = tag;
    this.state.searchQuery = "";
    // Update UI
    const tagPills = document.querySelectorAll(".jh-tag-pill");
    tagPills.forEach(p => p.classList.toggle("jh-tag-active", p.dataset.tag === tag));
    await this.loadPosts(true);
  },

  // ─── Search ───
  async search(query) {
    this.state.searchQuery = query;
    this.state.currentTag = null;
    await this.loadPosts(true);
  },

  // ─── Sort ───
  async setSort(sort) {
    this.state.sort = sort;
    await this.loadPosts(true);
  },

  // ─── Toggle view mode ───
  toggleView() {
    this.state.viewMode = this.state.viewMode === "grid" ? "list" : "grid";
    const container = document.getElementById("feed-container");
    if (container) {
      container.classList.toggle("jh-feed-grid", this.state.viewMode === "grid");
      container.classList.toggle("jh-feed-list", this.state.viewMode === "list");
    }
    this.render();
  },

  // ─── Toggle bookmark ───
  async toggleBookmark(postId) {
    if (!Auth.isLoggedIn()) {
      Swal.fire({
        icon: "info",
        title: "Login Required",
        text: "Please login to bookmark posts",
        background: "var(--bg-secondary)",
        color: "var(--text-primary)",
      });
      return;
    }

    if (this.state.bookmarks.has(postId)) {
      this.state.bookmarks.delete(postId);
      await BookmarkManager.remove(postId);
    } else {
      this.state.bookmarks.add(postId);
      const post = this.state.posts.find(p => p.postId === postId);
      if (post) {
        await BookmarkManager.add(postId, {
          title: post.title,
          username: post.username,
          timestamp: post.timestamp,
        });
      }
    }
    this.render();
  },

  // ─── Delete post ───
  async deletePost(postId) {
    const user = Auth.getUser();
    if (!user) return;

    const result = await Swal.fire({
      title: "Delete post?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--accent-red)",
      cancelButtonColor: "var(--bg-tertiary)",
      confirmButtonText: "Yes, delete!",
      background: "var(--bg-secondary)",
      color: "var(--text-primary)",
    });

    if (result.isConfirmed) {
      try {
        await API.deletePost(postId, user.userId);
        this.state.posts = this.state.posts.filter(p => p.postId !== postId);
        this.render();
        Swal.fire({
          icon: "success", title: "Deleted!", timer: 1500, showConfirmButton: false,
          background: "var(--bg-secondary)", color: "var(--text-primary)",
        });
      } catch (err) {
        Swal.fire({
          icon: "error", title: "Failed to delete", text: err.message,
          background: "var(--bg-secondary)", color: "var(--text-primary)",
        });
      }
    }
  },

  // ─── Open single post ───
  async openPost(postId) {
    try {
      const post = await API.getPostMeta(postId);
      if (post.error) {
        Swal.fire({ icon: "error", title: "Post not found", background: "var(--bg-secondary)", color: "var(--text-primary)" });
        return;
      }
      // Show post modal or navigate
      location.href = `post.html?id=${postId}`;
    } catch (err) {
      console.error("Open post error:", err);
    }
  },

  // ─── Load tags ───
  async loadTags() {
    try {
      const data = await API.getTagList();
      const container = document.getElementById("tag-pills");
      if (!container || !data.tags) return;

      const topTags = data.tags.slice(0, 15);
      container.innerHTML = [
        `<button class="jh-tag-pill jh-tag-active" data-tag="" onclick="Feed.filterByTag('')">All</button>`,
        ...topTags.map(t => `<button class="jh-tag-pill" data-tag="${t.tag}" onclick="Feed.filterByTag('${t.tag}')">#${t.tag} (${t.count})</button>`)
      ].join("");
    } catch (e) {}
  },
};

// Legacy alias
const TOTKA_FEED = Feed;
