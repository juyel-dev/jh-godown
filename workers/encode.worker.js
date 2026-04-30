// ============================================================
// JH GODOWN — Encode Web Worker
// Offloads encoding from UI thread for large files
// ============================================================

// pako is imported via importScripts
importScripts("https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js");

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF!#$%&*+-./:;<=>?@^_`{|}~\u20B9";
const START_UNICODE = 0xE000;
const CHUNK_BITS = 18;
const MASK = 262143;
const POOL_LEN = POOL.length;
const POOL_MAP = new Map();
for (let i = 0; i < POOL_LEN; i++) POOL_MAP.set(POOL[i], i);

self.onmessage = function(e) {
  const { action, data, fileIndex } = e.data;

  if (action === "encode") {
    try {
      const result = encodeBuffer(data, (pct, status, detail) => {
        self.postMessage({ type: "progress", pct, status, detail, fileIndex });
      });
      self.postMessage({ type: "complete", result, fileIndex });
    } catch (err) {
      self.postMessage({ type: "error", error: err.message, fileIndex });
    }
  }
};

function encodeBuffer(uint8Array, onProgress) {
  // Step 1: Compress
  if (onProgress) onProgress(5, "Compressing...", "");
  const compressed = pako.deflate(uint8Array, { level: 9 });

  if (onProgress) onProgress(20, "Encoding bits...", "");

  let bit_buffer = 0;
  let bit_count = 0;
  const encoded_chars = [];
  const totalBytes = compressed.length;

  for (let i = 0; i < totalBytes; i++) {
    const byte = compressed[i];
    bit_buffer = (bit_buffer * 256) + byte;
    bit_count += 8;

    while (bit_count >= CHUNK_BITS) {
      const val = Math.floor(bit_buffer / Math.pow(2, bit_count - CHUNK_BITS)) & MASK;
      bit_count -= CHUNK_BITS;
      bit_buffer = bit_buffer % Math.pow(2, bit_count + 18);

      if (val < POOL_LEN) {
        encoded_chars.push(POOL[val]);
      } else {
        encoded_chars.push(String.fromCodePoint(START_UNICODE + (val - POOL_LEN)));
      }
    }

    if (onProgress && i % 50000 === 0) {
      const pct = 20 + Math.floor((i / totalBytes) * 60);
      onProgress(pct, `Encoding... ${Math.floor((i/totalBytes)*100)}%`, "");
    }
  }

  // Leftover bits
  if (bit_count > 0) {
    const val = (bit_buffer << (CHUNK_BITS - bit_count)) & MASK;
    if (val < POOL_LEN) {
      encoded_chars.push(POOL[val]);
    } else {
      encoded_chars.push(String.fromCodePoint(START_UNICODE + (val - POOL_LEN)));
    }
  }

  if (onProgress) onProgress(100, "Complete", "");
  return encoded_chars.join("");
}
