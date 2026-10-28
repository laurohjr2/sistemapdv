const zlib = require("node:zlib");
function png(width = 64, height = 48, seed = 1, filter = 0) {
  const crc = (data) => {
    let c = 0xffffffff;
    for (const byte of data) {
      c ^= byte;
      for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (name, data) => {
    const type = Buffer.from(name),
      len = Buffer.alloc(4),
      check = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    check.writeUInt32BE(crc(Buffer.concat([type, data])));
    return Buffer.concat([len, type, data, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = filter;
    for (let x = 0; x < width; x++) {
      const pos = y * (width * 3 + 1) + 1 + x * 3;
      raw[pos] = (x * 3 + seed) % 256;
      raw[pos + 1] = (y * 5 + seed) % 256;
      raw[pos + 2] = 90;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const strokes = [
  [
    { x: 0.1, y: 0.65 },
    { x: 0.18, y: 0.2 },
    { x: 0.25, y: 0.7 },
    { x: 0.4, y: 0.4 },
    { x: 0.45, y: 0.6 },
    { x: 0.6, y: 0.35 },
    { x: 0.8, y: 0.6 },
    { x: 0.9, y: 0.3 },
  ],
];
module.exports = { png, strokes };
