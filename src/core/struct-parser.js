/**
 * 结构体定义与解析
 * 用声明式方式描述二进制/内存布局，自动生成读取器
 */
'use strict';

const TYPE_SIZE = {
  uint8: 1, int8: 1,
  uint16: 2, int16: 2,
  uint32: 4, int32: 4,
  float: 4, double: 8,
  uint64: 8, int64: 8,
};

const READERS = {
  uint8: (b, o) => b.readUInt8(o),
  int8: (b, o) => b.readInt8(o),
  uint16: (b, o) => b.readUInt16LE(o),
  int16: (b, o) => b.readInt16LE(o),
  uint32: (b, o) => b.readUInt32LE(o),
  int32: (b, o) => b.readInt32LE(o),
  float: (b, o) => b.readFloatLE(o),
  double: (b, o) => b.readDoubleLE(o),
  uint64: (b, o) => Number(b.readBigUInt64LE(o)),
  int64: (b, o) => Number(b.readBigInt64LE(o)),
};

/**
 * 定义结构体
 * @param {Object} schema  字段 -> 类型（支持 'string:N' 定长字符串）
 * @returns {{ size:number, read:(buf:Buffer, offset?:number)=>Object, fields:Array }}
 */
function defineStruct(schema) {
  const fields = [];
  let size = 0;

  for (const [name, type] of Object.entries(schema)) {
    if (type.startsWith('string:')) {
      const len = parseInt(type.split(':')[1], 10);
      fields.push({ name, type: 'string', size: len, offset: size });
      size += len;
    } else {
      const s = TYPE_SIZE[type];
      if (!s) throw new Error('未知类型: ' + type);
      fields.push({ name, type, size: s, offset: size });
      size += s;
    }
  }

  return {
    size,
    fields,
    read(buf, offset = 0) {
      const obj = {};
      for (const f of fields) {
        const abs = offset + f.offset;
        if (f.type === 'string') {
          obj[f.name] = buf
            .slice(abs, abs + f.size)
            .toString('utf8')
            .replace(/\0+$/, '');
        } else {
          obj[f.name] = READERS[f.type](buf, abs);
        }
      }
      return obj;
    },
  };
}

module.exports = { defineStruct, TYPE_SIZE };

/* ---------------- 自测 ---------------- */
if (require.main === module) {
  const Player = defineStruct({
    id: 'uint32',
    hp: 'int32',
    mp: 'int32',
    name: 'string:16',
  });

  console.log('结构体大小:', Player.size, '字节');
  console.log('字段布局:', Player.fields);

  const buf = Buffer.alloc(Player.size);
  buf.writeUInt32LE(10001, 0);
  buf.writeInt32LE(8800, 4);
  buf.writeInt32LE(3200, 8);
  buf.write('测试玩家', 12, 'utf8');

  console.log('解析结果:', Player.read(buf));
}
