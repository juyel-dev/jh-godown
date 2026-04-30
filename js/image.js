// ============================================================
// JH GODOWN — Image Processing (Profile Pic Compression, Previews)
// ============================================================

const ImageProcessor = {
  // ─── Compress profile picture to ≤50KB ───
  async compressProfilePic(file, maxSizeKB = 50) {
    return new Promise((resolve, reject) => {
      const MAX_SIZE = maxSizeKB * 1024;
      const TARGET_DIM = 300;

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = TARGET_DIM;
          canvas.height = TARGET_DIM;
          const ctx = canvas.getContext("2d");

          // Center-crop to square
          const srcSize = Math.min(img.width, img.height);
          const srcX = (img.width - srcSize) / 2;
          const srcY = (img.height - srcSize) / 2;
          ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, TARGET_DIM, TARGET_DIM);

          // Iterative quality reduction
          let quality = 0.85;
          let base64 = canvas.toDataURL("image/jpeg", quality);

          while (base64.length * 0.75 > MAX_SIZE && quality > 0.1) {
            quality -= 0.05;
            base64 = canvas.toDataURL("image/jpeg", quality);
          }

          const sizeKB = Math.round(base64.length * 0.75 / 1024);
          if (sizeKB > maxSizeKB + 20) {
            reject(new Error(`TOO_LARGE: Still ${sizeKB}KB after max compression`));
            return;
          }

          resolve({ base64, sizeKB, quality: Math.round(quality * 100), width: TARGET_DIM, height: TARGET_DIM });
        };

        img.onerror = () => reject(new Error("Invalid image file"));
      };

      reader.onerror = () => reject(new Error("File read failed"));
    });
  },

  // ─── Generate thumbnail from file ───
  async generateThumbnail(file, maxDim = 200) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ratio = Math.min(maxDim / img.width, maxDim / img.height);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };

        img.onerror = () => reject(new Error("Thumbnail generation failed"));
      };

      reader.onerror = () => reject(new Error("File read failed"));
    });
  },

  // ─── Get file icon based on mime type ───
  getFileIcon(mimeType, filename = "") {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "music";
    if (mimeType.includes("pdf")) return "file-text";
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return "archive";
    if (mimeType.includes("json") || mimeType.includes("xml")) return "code";
    if (filename.endsWith(".js") || filename.endsWith(".html") || filename.endsWith(".css")) return "code";
    return "file";
  },

  // ─── Generate placeholder thumbnail for non-image files ───
  generatePlaceholderIcon(iconName, color = "#58a6ff") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  },
};

// Legacy alias
const compressProfilePic = (file) => ImageProcessor.compressProfilePic(file);
