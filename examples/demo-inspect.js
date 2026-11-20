/**
 * 示例：资源包结构探查
 * 演示如何自动识别归档格式的头部与索引表
 */
'use strict';

const fs = require('node:fs');
const { scanAll } = require('../src/core/pattern-scan');

/**
 * 猜测归档格式：扫描常见的 Magic Number
 */
const MAGIC_TABLE = [
  { magic: 'PK\x03\x04', name: 'ZIP 归档' },
  { magic: 'Rar!', name: 'RAR 归档' },
  { magic: '\x89PNG', name: 'PNG 图片' },
  { magic: 'OggS', name: 'OGG 音频' },
  { magic: 'RIFF', name: 'RIFF 容器（WAV/WebP）' },
];

function detectMagic(buf) {
  for (const item of MAGIC_TABLE) {
    const bytes = Buffer.from(item.magic, 'binary');
    if (buf.length >= bytes.length && buf.slice(0, bytes.length).equals(bytes)) {
      return item.name;
    }
  }
  return '未知格式（可能是自定义归档）';
}

/**
 * 统计重复出现的固定长度结构，辅助定位索引表
 * 原理：索引表每项长度相同，相邻项的某些字段呈规律性
 */
function guessEntrySize(buf, minSize = 8, maxSize = 64) {
  const candidates = [];

  for (let size = minSize; size <= maxSize; size += 4) {
    let hits = 0;
    // 检查偏移字段是否单调递增（索引表的典型特征）
    for (let off = 0; off + size * 2 < Math.min(buf.length, 4096); off += size) {
      const a = buf.readUInt32LE(off);
      const b = buf.readUInt32LE(off + size);
      if (b > a && b - a < buf.length) hits++;
    }
    if (hits >= 3) candidates.push({ size, score: hits });
  }

  return candidates.sort((x, y) => y.score - x.score).slice(0, 5);
}

function inspect(filePath) {
  const buf = fs.readFileSync(filePath);

  console.log('文件:', filePath);
  console.log('大小:', buf.length, '字节');
  console.log('格式判断:', detectMagic(buf));
  console.log('头 32 字节:', buf.slice(0, 32).toString('hex').replace(/(..)/g, '$1 '));

  const sizes = guessEntrySize(buf);
  if (sizes.length) {
    console.log('\n可能的索引表项长度:');
    sizes.forEach((s) => console.log(`  ${s.size} 字节（匹配度 ${s.score}）`));
  } else {
    console.log('\n未检测到明显的索引表结构');
  }

  // 搜索内嵌的 PNG 资源
  const pngPositions = scanAll(buf, '89 50 4E 47', 20);
  if (pngPositions.length) {
    console.log('\n发现内嵌 PNG 资源', pngPositions.length, '处，前几个偏移:');
    console.log(' ', pngPositions.slice(0, 10));
  }
}

/* ---------------- 运行 ---------------- */
const target = process.argv[2];
if (!target) {
  console.log('用法: node examples/demo-inspect.js <文件路径>');
  console.log('\n未提供文件，用内置样例演示：');
  // 构造一个假的归档做演示
  const fake = Buffer.alloc(256);
  fake.writeUInt32LE(0x4B41504B, 0); // 'KPAK'
  fake.writeUInt32LE(2, 4);          // version
  fake.writeUInt32LE(4, 8);          // entry count
  for (let i = 0; i < 4; i++) {
    fake.writeUInt32LE(32 + i * 48, 16 + i * 12);
    fake.writeUInt32LE(48, 20 + i * 12);
  }
  fs.writeFileSync('demo.pak', fake);
  inspect('demo.pak');
  fs.unlinkSync('demo.pak');
} else {
  inspect(target);
}
