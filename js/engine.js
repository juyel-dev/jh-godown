// ============================================================
// JH GODOWN — Core Encoding/Decoding Engine (JavaScript Port)
// 18-bit chunked encoding with zlib compression via pako
// Optimized with BigInt & Surrogate-Pair Safe Iteration
// ============================================================

const JH_ENGINE = (() => {
  const POOL = JH_CONFIG.ENGINE.POOL;
  const START_UNICODE = JH_CONFIG.ENGINE.START_UNICODE;
  const CHUNK_BITS = JH_CONFIG.ENGINE.CHUNK_BITS;
  const MASK = JH_CONFIG.ENGINE.MASK;
  const POOL_LEN = POOL.length;

  const BIG_CHUNK_BITS = BigInt(CHUNK_BITS);
  const BIG_MASK = BigInt(MASK);

  const POOL_MAP = new Map();
  for (let i = 0; i < POOL_LEN; i++) POOL_MAP.set(POOL[i], i);

  // ─── ENCODE: Uint8Array → encoded string ───
  function encode(uint8Array, onProgress) {
    if (!uint8Array || uint8Array.length === 0) throw new Error("Empty input data");

    if (onProgress) onProgress(5, "Compressing...");
    const compressed = pako.deflate(uint8Array, { level: 9 });

    if (onProgress) onProgress(20, "Encoding bits...");

    let bit_buffer = 0n;
    let bit_count = 0;
    const encoded_chars = [];
    const totalBytes = compressed.length;

    for (let i = 0; i < totalBytes; i++) {
      bit_buffer = (bit_buffer << 8n) | BigInt(compressed[i]);
      bit_count += 8;

      while (bit_count >= CHUNK_BITS) {
        const shift = BigInt(bit_count - CHUNK_BITS);
        const val = Number((bit_buffer >> shift) & BIG_MASK);
        
        bit_count -= CHUNK_BITS;
        bit_buffer = bit_buffer & ((1n << BigInt(bit_count)) - 1n);

        if (val < POOL_LEN) {
          encoded_chars.push(POOL[val]);
        } else {
          encoded_chars.push(String.fromCodePoint(START_UNICODE + (val - POOL_LEN)));
        }
      }

      if (onProgress && i % 50000 === 0) {
        onProgress(20 + Math.floor((i / totalBytes) * 60), `Encoding... ${Math.floor((i/totalBytes)*100)}%`);
      }
    }

    if (bit_count > 0) {
      const shift = BigInt(CHUNK_BITS - bit_count);
      const val = Number((bit_buffer << shift) & BIG_MASK);
      
      if (val < POOL_LEN) {
        encoded_chars.push(POOL[val]);
      } else {
        encoded_chars.push(String.fromCodePoint(START_UNICODE + (val - POOL_LEN)));
      }
    }

    if (onProgress) onProgress(100, "Encoding complete");
    return encoded_chars.join("");
  }

  // ─── DECODE: encoded string → Uint8Array ───
  function decode(encodedText, onProgress) {
    if (!encodedText || encodedText.length === 0) throw new Error("Empty encoded text");
    if (onProgress) onProgress(5, "Decoding characters...");

    let bit_buffer = 0n;
    let bit_count = 0;
    const decoded_bytes = [];
    
    let i = 0;
    const totalCharsEstimate = encodedText.length; 

    // 🔥 FIX: Using for...of prevents splitting Unicode Surrogate Pairs!
    for (const char of encodedText) {
      let val;

      if (POOL_MAP.has(char)) {
        val = BigInt(POOL_MAP.get(char));
      } else {
        const cp = char.codePointAt(0);
        val = BigInt(cp - START_UNICODE + POOL_LEN);
      }

      bit_buffer = (bit_buffer << BIG_CHUNK_BITS) | val;
      bit_count += CHUNK_BITS;

      while (bit_count >= 8) {
        const shift = BigInt(bit_count - 8);
        decoded_bytes.push(Number((bit_buffer >> shift) & 0xFFn));
        
        bit_count -= 8;
        bit_buffer = bit_buffer & ((1n << BigInt(bit_count)) - 1n);
      }

      i++;
      if (onProgress && i % 50000 === 0) {
        onProgress(5 + Math.floor((i / totalCharsEstimate) * 45), `Decoding... ${Math.floor((i/totalCharsEstimate)*100)}%`);
      }
    }

    if (onProgress) onProgress(50, "Decompressing...");

    const compressed = new Uint8Array(decoded_bytes);
    const result = pako.inflate(compressed);

    if (onProgress) onProgress(100, "Decoding complete");
    return result;
  }

  // ─── Utility functions ───
  async function decodeStreaming(encodedText, chunkCallback, onProgress) {
    const result = decode(encodedText, onProgress);
    if (chunkCallback) chunkCallback(result);
    return result;
  }

  async function encodeBatch(files, onEachComplete, onProgress) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const encoded = encode(new Uint8Array(buffer), (pct, status) => {
        if (onProgress) onProgress(pct, status, i, files.length);
      });
      const result = { name: file.name, size: file.size, encoded: encoded, encodedLen: encoded.length };
      results.push(result);
      if (onEachComplete) onEachComplete(result, i);
    }
    return results;
  }

  function getStats(originalBytes, encodedString) {
    const originalSize = originalBytes.length || originalBytes;
    const encodedSize = new Blob([encodedString]).size;
    const ratio = ((1 - (encodedSize / originalSize)) * 100).toFixed(1);
    return { originalSize, encodedSize, encodedChars: encodedString.length, ratio: ratio > 0 ? ratio : "0", chunks: Math.ceil(encodedString.length / JH_CONFIG.ENGINE.CHUNK_SIZE) };
  }

  return { encode, decode, decodeStreaming, encodeBatch, getStats, POOL_LEN, CHUNK_BITS };
})();

const TOTKA_ENGINE = JH_ENGINE;
        
