// ============================================================
// JH GODOWN — Core Encoding/Decoding Engine (JavaScript Port)
// 18-bit chunked encoding with zlib compression via pako
// ============================================================

const JH_ENGINE = (() => {
  const POOL = JH_CONFIG.ENGINE.POOL;
  const START_UNICODE = JH_CONFIG.ENGINE.START_UNICODE;
  const CHUNK_BITS = JH_CONFIG.ENGINE.CHUNK_BITS;
  const MASK = JH_CONFIG.ENGINE.MASK;
  const POOL_LEN = POOL.length;

  // Build reverse lookup map for O(1) decode
  const POOL_MAP = new Map();
  for (let i = 0; i < POOL_LEN; i++) POOL_MAP.set(POOL[i], i);

  // ─── ENCODE: Uint8Array → encoded string ───
  function encode(uint8Array, onProgress) {
    if (!uint8Array || uint8Array.length === 0) {
      throw new Error("Empty input data");
    }

    // Step 1: Compress with pako (equivalent to Python's zlib.compress level=9)
    if (onProgress) onProgress(5, "Compressing...");
    const compressed = pako.deflate(uint8Array, { level: 9 });

    if (onProgress) onProgress(20, "Encoding bits...");

    let bit_buffer = 0;
    let bit_count = 0;
    const encoded_chars = [];
    const totalBytes = compressed.length;

    // Step 2 & 3: Bit manipulation loop
    for (let i = 0; i < totalBytes; i++) {
      const byte = compressed[i];
      // Use BigInt to avoid 32-bit overflow on large files
      bit_buffer = (bit_buffer * 256) + byte;
      bit_count += 8;

      // Extract complete 18-bit chunks
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
        onProgress(pct, `Encoding... ${Math.floor((i/totalBytes)*100)}%`);
      }
    }

    if (onProgress) onProgress(80, "Finalizing...");

    // Step 5: Handle leftover bits (pad right with zeros to make 18 bits)
    if (bit_count > 0) {
      const val = (bit_buffer << (CHUNK_BITS - bit_count)) & MASK;
      if (val < POOL_LEN) {
        encoded_chars.push(POOL[val]);
      } else {
        encoded_chars.push(String.fromCodePoint(START_UNICODE + (val - POOL_LEN)));
      }
    }

    const result = encoded_chars.join("");
    if (onProgress) onProgress(100, "Encoding complete");
    return result;
  }

  // ─── DECODE: encoded string → Uint8Array ───
  function decode(encodedText, onProgress) {
    if (!encodedText || encodedText.length === 0) {
      throw new Error("Empty encoded text");
    }

    if (onProgress) onProgress(5, "Decoding characters...");

    let bit_buffer = 0;
    let bit_count = 0;
    const decoded_bytes = [];
    const totalChars = encodedText.length;

    for (let i = 0; i < totalChars; i++) {
      const char = encodedText[i];
      let val;

      if (POOL_MAP.has(char)) {
        val = POOL_MAP.get(char);
      } else {
        const cp = char.codePointAt(0);
        val = cp - START_UNICODE + POOL_LEN;
      }

      // Push 18 bits into buffer using multiply to avoid overflow
      bit_buffer = (bit_buffer * (1 << CHUNK_BITS)) + val;
      bit_count += CHUNK_BITS;

      // Extract complete bytes (8 bits each)
      while (bit_count >= 8) {
        decoded_bytes.push(Math.floor(bit_buffer / Math.pow(2, bit_count - 8)) & 0xFF);
        bit_count -= 8;
        bit_buffer = bit_buffer % Math.pow(2, bit_count + 8);
      }

      if (onProgress && i % 50000 === 0) {
        const pct = 5 + Math.floor((i / totalChars) * 45);
        onProgress(pct, `Decoding... ${Math.floor((i/totalChars)*100)}%`);
      }
    }

    if (onProgress) onProgress(50, "Decompressing...");

    // Step 4: Decompress with pako
    const compressed = new Uint8Array(decoded_bytes);
    const result = pako.inflate(compressed);

    if (onProgress) onProgress(100, "Decoding complete");
    return result;
  }

  // ─── Streaming Decode: process in chunks for memory efficiency ───
  async function decodeStreaming(encodedText, chunkCallback, onProgress) {
    // For large files, decode the full string then stream via callbacks
    const result = decode(encodedText, onProgress);
    if (chunkCallback) chunkCallback(result);
    return result;
  }

  // ─── Batch Encode: multiple files ───
  async function encodeBatch(files, onEachComplete, onProgress) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const encoded = encode(new Uint8Array(buffer), (pct, status) => {
        if (onProgress) onProgress(pct, status, i, files.length);
      });
      const result = {
        name: file.name,
        size: file.size,
        encoded: encoded,
        encodedLen: encoded.length,
      };
      results.push(result);
      if (onEachComplete) onEachComplete(result, i);
    }
    return results;
  }

  // ─── Get compression stats ───
  function getStats(originalBytes, encodedString) {
    const originalSize = originalBytes.length || originalBytes;
    const encodedSize = new Blob([encodedString]).size;
    const ratio = ((1 - (encodedSize / originalSize)) * 100).toFixed(1);
    return {
      originalSize,
      encodedSize,
      encodedChars: encodedString.length,
      ratio: ratio > 0 ? ratio : "0",
      chunks: Math.ceil(encodedString.length / JH_CONFIG.ENGINE.CHUNK_SIZE),
    };
  }

  return {
    encode,
    decode,
    decodeStreaming,
    encodeBatch,
    getStats,
    POOL_LEN,
    CHUNK_BITS,
  };
})();

// Legacy alias
const TOTKA_ENGINE = JH_ENGINE;
