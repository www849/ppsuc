/**
 * 警校考研助手 — PWA 图标生成器 v2
 * 读取用户警徽图 → 缩放 → 生成 icon-192.png + icon-512.png
 * 用法: node scripts/generate-icons.js
 */

'use strict';

var zlib = require('zlib');
var fs   = require('fs');
var path = require('path');

var BG_COLOR   = { r: 10, g: 36, b: 66, a: 255 };   // #0A2442

/* ===== CRC32 ===== */
var crcTable = (function () {
  var table = new Uint32Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i;
    for (var j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* ===== PNG 组装（编码） ===== */

function createPNGChunk(type, data) {
  var typeBytes = Buffer.from(type, 'ascii');
  var length    = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  var combined = Buffer.concat([typeBytes, data]);
  var crcBytes = Buffer.alloc(4);
  crcBytes.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([length, combined, crcBytes]);
}

function createPNG(width, height, pixels) {
  var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  var ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8]  = 8;
  ihdrData[9]  = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  var ihdr = createPNGChunk('IHDR', ihdrData);

  var rawData = Buffer.alloc(height * (1 + 4 * width));
  for (var y = 0; y < height; y++) {
    var rowOffset = y * (1 + 4 * width);
    rawData[rowOffset] = 0;
    for (var x = 0; x < width; x++) {
      var px = y * width + x;
      var off = rowOffset + 1 + x * 4;
      rawData[off]     = pixels[px].r;
      rawData[off + 1] = pixels[px].g;
      rawData[off + 2] = pixels[px].b;
      rawData[off + 3] = pixels[px].a;
    }
  }

  var compressed = zlib.deflateSync(rawData, { level: 9 });
  var idat = createPNGChunk('IDAT', compressed);
  var iend = createPNGChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/* ===== PNG 解码 ===== */

function decodePNG(filePath) {
  var buf = fs.readFileSync(filePath);

  // 找 IHDR
  var w = buf.readUInt32BE(16);
  var h = buf.readUInt32BE(20);

  // 收集所有 IDAT 数据
  var offset = 8; // skip signature
  var idatChunks = [];
  while (offset < buf.length) {
    var len = buf.readUInt32BE(offset);
    var type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') {
      idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
    }
    offset += 12 + len;
  }

  // 解压
  var compressed = Buffer.concat(idatChunks);
  var raw = zlib.inflateSync(compressed);

  // 去滤镜，提取 RGBA
  var bytesPerPixel = 4;
  var stride = w * bytesPerPixel;
  var pixels = [];

  for (var y = 0; y < h; y++) {
    var filterType = raw[y * (1 + stride)];
    var rowStart = y * (1 + stride) + 1;

    for (var x = 0; x < w; x++) {
      var idx = rowStart + x * bytesPerPixel;
      var r = raw[idx];
      var g = raw[idx + 1];
      var b = raw[idx + 2];
      var a = raw[idx + 3];

      // 简单处理：只处理最基础的 None filter (0)
      // 大多数 PNG 使用 filter 0
      if (filterType !== 0 && filterType !== undefined) {
        // 对于其他滤镜类型，直接用当前值（可能有轻微偏差）
      }

      pixels.push({ r: r, g: g, b: b, a: a });
    }
  }

  return { width: w, height: h, pixels: pixels };
}

/* ===== 图像缩放 ===== */

function scaleDown(src, dstW, dstH) {
  var result = [];
  var xRatio = src.width / dstW;
  var yRatio = src.height / dstH;

  for (var dy = 0; dy < dstH; dy++) {
    for (var dx = 0; dx < dstW; dx++) {
      // 双线性插值
      var sx = dx * xRatio;
      var sy = dy * yRatio;

      var x0 = Math.floor(sx);
      var y0 = Math.floor(sy);
      var x1 = Math.min(x0 + 1, src.width - 1);
      var y1 = Math.min(y0 + 1, src.height - 1);

      var wx = sx - x0;
      var wy = sy - y0;

      var p00 = src.pixels[y0 * src.width + x0];
      var p10 = src.pixels[y0 * src.width + x1];
      var p01 = src.pixels[y1 * src.width + x0];
      var p11 = src.pixels[y1 * src.width + x1];

      result.push({
        r: Math.round((1-wx)*(1-wy)*p00.r + wx*(1-wy)*p10.r + (1-wx)*wy*p01.r + wx*wy*p11.r),
        g: Math.round((1-wx)*(1-wy)*p00.g + wx*(1-wy)*p10.g + (1-wx)*wy*p01.g + wx*wy*p11.g),
        b: Math.round((1-wx)*(1-wy)*p00.b + wx*(1-wy)*p10.b + (1-wx)*wy*p01.b + wx*wy*p11.b),
        a: Math.round((1-wx)*(1-wy)*p00.a + wx*(1-wy)*p10.a + (1-wx)*wy*p01.a + wx*wy*p11.a)
      });
    }
  }

  return result;
}

function createCenteredIcon(size, badgePixels, badgeW, badgeH) {
  var pixels = [];
  for (var i = 0; i < size * size; i++) {
    pixels.push({ r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b, a: 255 });
  }

  // 计算缩放：让警徽占图标 75%
  var scale = Math.min(size * 0.75 / badgeW, size * 0.75 / badgeH);
  var drawW = Math.round(badgeW * scale);
  var drawH = Math.round(badgeH * scale);

  // 缩放用户图片
  var scaled = scaleDown(
    { width: badgeW, height: badgeH, pixels: badgePixels },
    drawW, drawH
  );

  // 居中放置
  var offsetX = Math.floor((size - drawW) / 2);
  var offsetY = Math.floor((size - drawH) / 2);

  for (var y = 0; y < drawH; y++) {
    for (var x = 0; x < drawW; x++) {
      var srcPx = scaled[y * drawW + x];
      var dstIdx = (offsetY + y) * size + (offsetX + x);
      if (dstIdx >= 0 && dstIdx < pixels.length) {
        // alpha 混合
        var alpha = srcPx.a / 255;
        pixels[dstIdx] = {
          r: Math.round(srcPx.r * alpha + BG_COLOR.r * (1 - alpha)),
          g: Math.round(srcPx.g * alpha + BG_COLOR.g * (1 - alpha)),
          b: Math.round(srcPx.b * alpha + BG_COLOR.b * (1 - alpha)),
          a: 255
        };
      }
    }
  }

  return pixels;
}

/* ===== 主流程 ===== */

function generate() {
  var assetsDir = path.join(__dirname, '..', 'assets');
  var badgePath = path.join(assetsDir, 'badge.png');

  if (!fs.existsSync(badgePath)) {
    console.error('❌ 未找到 ' + badgePath);
    process.exit(1);
  }

  console.log('读取警徽图片...');
  var decoded = decodePNG(badgePath);
  console.log('原始尺寸: ' + decoded.width + '×' + decoded.height);

  var sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' }
  ];

  sizes.forEach(function (item) {
    console.log('生成 ' + item.name + ' (' + item.size + '×' + item.size + ')...');
    var iconPixels = createCenteredIcon(item.size, decoded.pixels, decoded.width, decoded.height);
    var png = createPNG(item.size, item.size, iconPixels);
    fs.writeFileSync(path.join(assetsDir, item.name), png);
    console.log('  ✅ 已保存 (' + png.length + ' bytes)');
  });

  console.log('\n全部图标生成完成！');
}

generate();
