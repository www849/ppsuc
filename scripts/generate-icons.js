/**
 * 警校考研助手 — PWA 图标生成器
 * 纯 Node.js 实现，零依赖，生成合法 PNG 文件
 * 用法: node scripts/generate-icons.js
 */

'use strict';

var zlib = require('zlib');
var fs   = require('fs');
var path = require('path');

/* ===== 颜色定义 ===== */
var BG_COLOR   = { r: 10, g: 36, b: 66, a: 255 };   // #0A2442 深警务藏青
var GOLD_COLOR = { r: 197, g: 165, b: 90, a: 255 };  // #C5A55A 哑光鎏金

/* ===== CRC32 查找表 ===== */
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

/* ===== PNG 组装 ===== */

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
  // PNG 签名
  var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  var ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8]  = 8;   // bit depth
  ihdrData[9]  = 6;   // color type: RGBA
  ihdrData[10] = 0;   // compression
  ihdrData[11] = 0;   // filter
  ihdrData[12] = 0;   // interlace

  var ihdr = createPNGChunk('IHDR', ihdrData);

  // 原始图像数据（每行：1 字节 filter + 4*width 字节 RGBA）
  var rawData = Buffer.alloc(height * (1 + 4 * width));
  for (var y = 0; y < height; y++) {
    var rowOffset = y * (1 + 4 * width);
    rawData[rowOffset] = 0; // filter: None
    for (var x = 0; x < width; x++) {
      var px = y * width + x;
      var off = rowOffset + 1 + x * 4;
      rawData[off]     = pixels[px].r;
      rawData[off + 1] = pixels[px].g;
      rawData[off + 2] = pixels[px].b;
      rawData[off + 3] = pixels[px].a;
    }
  }

  // Zlib 压缩
  var compressed = zlib.deflateSync(rawData, { level: 9 });

  var idat = createPNGChunk('IDAT', compressed);
  var iend = createPNGChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/* ===== 图像绘制 ===== */

function drawCircle(cx, cy, r, color, width, height, pixels) {
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var dx = x - cx;
      var dy = (y - cy) * 0.85; // 略扁，适应盾形
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        var alpha = Math.min(1, (r - dist) / 2);
        blendPixel(y * width + x, color, alpha, pixels);
      }
    }
  }
}

function drawShieldShape(cx, cy, sz, color, width, height, pixels) {
  // 盾形：上圆角矩形 + 下部尖角
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var dx = Math.abs(x - cx);
      var dy = y - (cy - sz * 0.5);

      var inside = false;
      var shTop = cy - sz * 0.6;
      var shBot = cy + sz * 0.8;

      if (y >= shTop && y <= shBot) {
        var halfWidth;
        if (y <= cy) {
          // 上半部分：半圆顶 + 矩形
          var relY = y - shTop;
          var arcHalf = Math.sqrt(Math.max(0, sz * sz * 0.25 - relY * relY));
          halfWidth = Math.max(sz * 0.3, arcHalf);
        } else {
          // 下半部分：三角形收窄
          var frac = (y - cy) / (shBot - cy);
          halfWidth = sz * 0.3 + (sz * 0.15) * (1 - frac);
        }
        inside = dx <= halfWidth;
      }

      if (inside) {
        // 边缘抗锯齿
        var edgeDist = Math.abs(dx - (y <= cy ?
          Math.max(sz * 0.3, Math.sqrt(Math.max(0, sz * sz * 0.25 - (y - shTop) * (y - shTop)))) :
          (sz * 0.3 + sz * 0.15 * (1 - (y - cy) / (shBot - cy)))));
        var alpha = Math.min(1, edgeDist / 1.5);
        blendPixel(y * width + x, color, color.a === 255 ? alpha : color.a / 255 * alpha, pixels);
      }
    }
  }
}

function drawStar(cx, cy, r, color, width, height, pixels) {
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var dx = Math.abs(x - cx);
      var dy = Math.abs(y - cy);
      var dist = Math.sqrt(dx * dx + dy * dy);

      // 简单星形判断
      var angle = Math.atan2(dy, dx);
      var spikes = 5;
      var outerR = r;
      var innerR = r * 0.4;

      var sectorAngle = (2 * Math.PI) / spikes;
      var sectorIndex = Math.floor(angle / sectorAngle);
      var sectorAngleOffset = angle - sectorIndex * sectorAngle;
      var halfSector = sectorAngle / 2;

      var maxR;
      if (sectorAngleOffset <= halfSector) {
        var t = sectorAngleOffset / halfSector;
        maxR = outerR * (1 - t) + innerR * t;
      } else {
        var t = (sectorAngleOffset - halfSector) / halfSector;
        maxR = innerR * (1 - t) + outerR * t;
      }

      if (dist <= maxR) {
        var alpha = Math.min(1, (maxR - dist) / 2);
        blendPixel(y * width + x, color, alpha, pixels);
      }
    }
  }
}

function blendPixel(idx, color, alpha, pixels) {
  if (alpha <= 0) return;
  if (alpha >= 1) {
    pixels[idx] = { r: color.r, g: color.g, b: color.b, a: color.a };
    return;
  }
  var bg = pixels[idx];
  var invA = 1 - alpha;
  pixels[idx] = {
    r: Math.round(color.r * alpha + bg.r * invA),
    g: Math.round(color.g * alpha + bg.g * invA),
    b: Math.round(color.b * alpha + bg.b * invA),
    a: Math.max(bg.a, Math.round(color.a * alpha))
  };
}

function createIconPixels(size) {
  var pixels = [];
  // 填充藏青底色
  for (var i = 0; i < size * size; i++) {
    pixels.push({ r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b, a: 255 });
  }

  var cx = size / 2;
  var cy = size / 2;
  var scale = size / 192;

  // 外层鎏金圆环
  var outerR = size * 0.32;
  drawCircle(cx, cy, outerR, GOLD_COLOR, size, size, pixels);

  // 内层藏青圆（产生镂空圆环效果）
  var innerR = size * 0.28;
  drawCircle(cx, cy, innerR, BG_COLOR, size, size, pixels);

  // 中心星形
  var starR = size * 0.2;
  drawStar(cx, cy, starR, GOLD_COLOR, size, size, pixels);

  // 顶部小星
  var topY = cy - outerR * 0.65;
  var smallStarR = size * 0.05;
  drawStar(cx, topY, smallStarR, GOLD_COLOR, size, size, pixels);

  return pixels;
}

/* ===== 主流程 ===== */

function generate() {
  var assetsDir = path.join(__dirname, '..', 'assets');

  var sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' }
  ];

  sizes.forEach(function (item) {
    console.log('生成 ' + item.name + ' (' + item.size + '×' + item.size + ')...');
    var pixels = createIconPixels(item.size);
    var png = createPNG(item.size, item.size, pixels);
    fs.writeFileSync(path.join(assetsDir, item.name), png);
    console.log('  ✅ 已保存 ' + item.name + ' (' + png.length + ' bytes)');
  });

  console.log('\n全部图标生成完成！');
}

generate();
