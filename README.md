# Jh Godown v3.0.0

**Jh Godown** is a free, serverless file encoding and sharing platform. Encode any file into compact Unicode text, share it via posts, and decode it back to the original file — all without any server costs.

---

## What It Does

- **Encode**: Transform any file (any format, any size) into a compact Unicode text string using a custom 18-bit binary encoding engine with zlib compression
- **Store**: Save encoded text across multiple Google Sheets (each up to 500,000 rows) via a dynamic registry system
- **Share**: Browse a social-media-style feed, share posts with QR codes, bookmark favorites
- **Decode**: Convert encoded text back to the original binary file on-demand
- **Offline**: Works without internet — encoding/decoding happens entirely in your browser

---

## File Structure

```
jh-godown/
├── index.html          # Home feed page
├── encode.html         # File encoding page
├── decode.html         # File decoding page
├── profile.html        # User profile page
├── login.html          # Login & signup page
├── post.html           # Single post view
├── admin.html          # Admin panel
├── about.html          # About page
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── css/
│   └── app.css         # Complete design system
├── js/
│   ├── config.js       # Configuration & constants
│   ├── engine.js       # 18-bit encoding/decoding engine
│   ├── progress.js     # Progress bar component
│   ├── api.js          # GAS API wrappers
│   ├── auth.js         # Session & auth management
│   ├── image.js        # Image compression
│   ├── notify.js       # Telegram notifications
│   ├── share.js        # Deep linking & Web Share
│   ├── feed.js         # Feed system
│   ├── encode.js       # Encode page logic
│   ├── decode.js       # Decode page logic
│   ├── profile.js      # Profile page logic
│   └── admin.js        # Admin panel logic
└── workers/
    └── encode.worker.js # Web Worker for encoding
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Backend | Google Apps Script (6 Web Apps) |
| Database | Google Sheets |
| Compression | pako.js (zlib port) |
| Hashing | CryptoJS (SHA-256) |
| Icons | Lucide Icons |
| Alerts | SweetAlert2 |
| Fonts | Orbitron + JetBrains Mono |
| Hosting | GitHub Pages |
| Notifications | Telegram Bot API |

---

## 6 Google Apps Script Services

| # | Service | URL | Purpose |
|---|---------|-----|---------|
| 1 | AUTH SERVICE | GAS_AUTH | Signup, login, profile management |
| 2 | REGISTRY MANAGER | GAS_REG | Active sheet lookup, auto-switching |
| 3 | WRITE SERVICE | GAS_WRITE | Save posts, chunking, metadata |
| 4 | FEED SERVICE | GAS_FEED | Paginated feed, search, user posts |
| 5 | DECODE SERVICE | GAS_DECODE | Fetch chunks, join encoded text |
| 6 | NOTIFY SERVICE | GAS_NOTIFY | Telegram notifications, admin actions |

---

## Setup Instructions

### 1. Google Sheets Setup

1. Create **TOTKA_MASTER** spreadsheet with tabs:
   - `posts` — Post metadata
   - `registry` — Storage sheet registry
2. Create **TOTKA_USERS** spreadsheet with tabs:
   - `users` — User accounts
   - `config` — Counters (`next_post_id`, `next_user_id`, `active_storage`)
3. Create storage spreadsheets with `chunks` tab

### 2. Deploy GAS Services

1. Go to [script.google.com](https://script.google.com)
2. Create 6 new projects, paste code from the GAS files
3. Fill in spreadsheet IDs and URLs
4. Deploy each as Web App (Execute as: Me, Access: Anyone)
5. Copy the 6 Web App URLs

### 3. Configure Frontend

Edit `js/config.js` and fill in your GAS URLs:

```javascript
GAS_AUTH:    "YOUR_GAS1_URL",
GAS_REG:     "YOUR_GAS2_URL",
GAS_WRITE:   "YOUR_GAS3_URL",
GAS_FEED:    "YOUR_GAS4_URL",
GAS_DECODE:  "YOUR_GAS5_URL",
GAS_NOTIFY:  "YOUR_GAS6_URL",
NOTIFY_KEY:  "your_secret_key",
ADMIN_PASS:  "sha256_of_admin_password",
```

### 4. GitHub Pages

1. Push all files to a GitHub repository
2. Go to Settings > Pages
3. Enable GitHub Pages (Source: main branch / root)
4. Update `SITE_URL` in config.js with your GitHub Pages URL

---

## Enhanced Features (v3.0)

### 10 Powerful Upgrades
1. **Web Workers** — Background encoding, no UI freeze
2. **WebRTC P2P** — Direct user-to-user file transfer
3. **End-to-End Encryption** — AES-GCM via Web Crypto API
4. **IndexedDB Caching** — Offline data persistence
5. **Streaming Decode** — Memory-efficient large file handling
6. **In-Browser Streaming** — Play audio/video without downloading
7. **Self-Destruct (TTL)** — Auto-delete posts after set time
8. **Resumable Uploads** — Resume interrupted uploads
9. **Advanced Search** — Tag, file type, and size indexing
10. **Multi-threading** — Parallel processing with multiple workers

### PWA & Quality of Life
- **PWA** — Install as mobile app with offline support
- **Offline Processing** — Encode files without internet
- **Rate Limiting** — Spam protection
- **Service Worker Caching** — Fast page loads
- **Dark/Light Theme** — System preference + toggle
- **QR Code Sharing** — Instant mobile access
- **Bookmarks & Collections** — Organize favorites
- **Personal Analytics** — Upload/download stats with SVG charts
- **Drag & Drop** — Modern file upload interface
- **Custom Metadata** — Tags and descriptions per file

---

## Security

- SHA-256 password hashing (never store plain text)
- Client-side session tokens in localStorage
- XSS prevention via input sanitization
- NSFW content blur with click-to-reveal
- Rate limiting on uploads
- Admin panel with SHA-256 password check
- Telegram secret key for notification API

---

## License

Free to use and modify. Built for the community.

---

**Version**: 3.0.0 Enhanced Edition  
**Previous Name**: TOTKA 2.0  
**Author**: juyel-dev
