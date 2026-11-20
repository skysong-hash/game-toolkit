/**
 * 特征码扫描器
 * 在二进制缓冲区中定位字节序列，支持 ?? 通配符
 */
'use strict';

/**
 * 把 "48 8B ?? ?? 89" 解析为 [0x48, 0x8B, null, null, 0x89]
 * @param {string} pattern
 * @returns {(number|null)[]}
 */
function parsePattern(pattern) {
  const tokens = pattern.trim().split(/\s+/);
  return tokens.map((t) => {
    if (t === '??' || t === '**' || t === '?') return null;
    const v = parseInt(t, 16);
    if (Number.isNaN(v)) throw new Error('非法特征码: ' + t);
    return v & 0xff;
  });
}

/**
 * 在缓冲区中扫描第一个匹配位置
 * @param {Buffer} buf
 * @param {string} pattern  形如 "48 8B ?? 89"
 * @param {number} [start]  起始偏移
 * @returns {number} 匹配到的偏移，未找到返回 -1
 */
function scanPattern(buf, pattern, start = 0) {
  const pat = parsePattern(pattern);
  const last = buf.length - pat.length;

  outer:
  for (let i = start; i <= last; i++) {
    for (let j = 0; j < pat.length; j++) {
      const want = pat[j];
      if (want !== null && buf[i + j] !== want) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * 扫描全部匹配位置
 * @param {Buffer} buf
 * @param {string} pattern
 * @param {number} [limit] 最多返回多少条
 * @returns {number[]}
 */
function scanAll(buf, pattern, limit = 100) {
  const res = [];
  let from = 0;
  while (res.length < limit) {
    const pos = scanPattern(buf, pattern, from);
    if (pos < 0) break;
    res.push(pos);
    from = pos + 1;
  }
  return res;
}

/**
 * 生成特征码唯一性报告：统计某模式在缓冲区中出现次数
 * 用于评估特征码是否足够唯一
 */
function uniqueness(buf, pattern) {
  const hits = scanAll(buf, pattern, 1000);
  return { count: hits.length, offsets: hits.slice(0, 10) };
}

module.exports = { parsePattern, scanPattern, scanAll, uniqueness };

/* ---------------- 自测 ---------------- */
if (require.main === module) {
  const sample = Buffer.from([
    0x00, 0x48, 0x8B, 0x05, 0x12, 0x89, 0xFF,
    0x00, 0x48, 0x8B, 0x90, 0x34, 0x89, 0x00,
  ]);

  console.log('扫描 "48 8B ??" 首个位置:', scanPattern(sample, '48 8B ??'));
  console.log('全部匹配:', scanAll(sample, '48 8B ??'));
  console.log('唯一性报告:', uniqueness(sample, '48 8B 05 12'));
}
