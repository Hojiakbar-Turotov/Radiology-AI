/**
 * Universal Pure JS QR Code SVG Generator (lib/qr.js)
 */

function generateQrSvg(text) {
  // GF(256) tables with primitive polynomial 0x11d (285)
  const expTable = new Uint8Array(512);
  const logTable = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    expTable[i] = x;
    expTable[i + 255] = x;
    logTable[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return expTable[logTable[a] + logTable[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const nextPoly = new Array(poly.length + 1).fill(0);
      const factor = expTable[i];
      for (let j = 0; j < poly.length; j++) {
        nextPoly[j] ^= poly[j];
        nextPoly[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = nextPoly;
    }
    return poly;
  }

  function rsComputeEC(dataCodewords, ecCount) {
    const genPoly = rsGeneratorPoly(ecCount);
    const remainder = new Array(ecCount).fill(0);
    for (let i = 0; i < dataCodewords.length; i++) {
      const factor = dataCodewords[i] ^ remainder[0];
      for (let j = 0; j < ecCount - 1; j++) {
        remainder[j] = remainder[j + 1] ^ gfMul(genPoly[j + 1], factor);
      }
      remainder[ecCount - 1] = gfMul(genPoly[ecCount], factor);
    }
    return remainder;
  }

  // Version 2, EC Level L:
  // Total codewords: 44, Data: 34, EC: 10
  const SIZE = 25;
  const DATA_CODEWORDS = 34;
  const EC_CODEWORDS = 10;
  const EC_LEVEL_BITS = 0b01; // L = 01

  const bitBuffer = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1);
    }
  }

  // Byte mode: 0100
  pushBits(0b0100, 4);
  pushBits(text.length, 8);
  for (let i = 0; i < text.length; i++) {
    pushBits(text.charCodeAt(i), 8);
  }

  // Terminator
  const bitCapacity = DATA_CODEWORDS * 8;
  const termLen = Math.min(4, bitCapacity - bitBuffer.length);
  pushBits(0, termLen);
  while (bitBuffer.length % 8 !== 0) bitBuffer.push(0);

  // Pad bytes
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bitBuffer.length < bitCapacity) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataCodewords = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bitBuffer[i + j];
    dataCodewords.push(b);
  }

  const ecCodewords = rsComputeEC(dataCodewords, EC_CODEWORDS);
  const allCodewords = [...dataCodewords, ...ecCodewords];

  const matrix = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
  const isReserved = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));

  function setModule(r, c, val) {
    matrix[r][c] = val;
    isReserved[r][c] = true;
  }

  function placeFinderPattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            setModule(nr, nc, 1);
          } else {
            setModule(nr, nc, 0);
          }
        } else {
          setModule(nr, nc, 0);
        }
      }
    }
  }

  placeFinderPattern(0, 0);
  placeFinderPattern(0, SIZE - 7);
  placeFinderPattern(SIZE - 7, 0);

  // Alignment pattern: center (18, 18)
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const val = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
      setModule(18 + r, 18 + c, val);
    }
  }

  // Timing patterns
  for (let i = 8; i < SIZE - 8; i++) {
    if (!isReserved[6][i]) setModule(6, i, i % 2 === 0 ? 1 : 0);
    if (!isReserved[i][6]) setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Dark module
  setModule(17, 8, 1);

  // Reserve format info
  for (let i = 0; i < 9; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
  }
  for (let i = SIZE - 8; i < SIZE; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
  }

  // Place bits
  let allBits = [];
  allCodewords.forEach(cw => {
    for (let b = 7; b >= 0; b--) allBits.push((cw >> b) & 1);
  });

  let bitIdx = 0;
  let upward = true;
  for (let rightCol = SIZE - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    const rows = upward 
      ? Array.from({length: SIZE}, (_, i) => SIZE - 1 - i) 
      : Array.from({length: SIZE}, (_, i) => i);
    for (const r of rows) {
      for (const c of [rightCol, rightCol - 1]) {
        if (!isReserved[r][c]) {
          matrix[r][c] = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }

  function isMask(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function getFormatBits(ecLevel, mask) {
    let data = (ecLevel << 3) | mask;
    let rem = data << 10;
    const G = 0b10100110111;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= (G << (i - 10));
    }
    return ((data << 10) | rem) ^ 0b101010000010010;
  }

  function evaluatePenalty(grid) {
    let penalty = 0;
    for (let r = 0; r < SIZE; r++) {
      let count = 1;
      for (let c = 1; c < SIZE; c++) {
        if (grid[r][c] === grid[r][c - 1]) count++;
        else { if (count >= 5) penalty += 3 + (count - 5); count = 1; }
      }
      if (count >= 5) penalty += 3 + (count - 5);
    }
    for (let c = 0; c < SIZE; c++) {
      let count = 1;
      for (let r = 1; r < SIZE; r++) {
        if (grid[r][c] === grid[r - 1][c]) count++;
        else { if (count >= 5) penalty += 3 + (count - 5); count = 1; }
      }
      if (count >= 5) penalty += 3 + (count - 5);
    }
    for (let r = 0; r < SIZE - 1; r++) {
      for (let c = 0; c < SIZE - 1; c++) {
        const v = grid[r][c];
        if (v === grid[r + 1][c] && v === grid[r][c + 1] && v === grid[r + 1][c + 1]) penalty += 3;
      }
    }
    return penalty;
  }

  let bestMask = 0;
  let minPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const testGrid = matrix.map((row, r) => row.map((val, c) => {
      if (isReserved[r][c]) return val;
      return val ^ (isMask(mask, r, c) ? 1 : 0);
    }));
    const penalty = evaluatePenalty(testGrid);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
    }
  }

  const finalGrid = matrix.map((row, r) => row.map((val, c) => {
    if (isReserved[r][c]) return val;
    return val ^ (isMask(bestMask, r, c) ? 1 : 0);
  }));

  const finalFormat = getFormatBits(EC_LEVEL_BITS, bestMask);
  const formatCoords1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    finalGrid[formatCoords1[i][0]][formatCoords1[i][1]] = (finalFormat >> (14 - i)) & 1;
  }
  for (let i = 0; i < 7; i++) {
    finalGrid[SIZE - 1 - i][8] = (finalFormat >> i) & 1;
  }
  for (let i = 0; i < 8; i++) {
    finalGrid[8][SIZE - 8 + i] = (finalFormat >> (7 + i)) & 1;
  }

  const moduleSize = 6;
  const margin = 4;
  const fullSize = (SIZE + margin * 2) * moduleSize;
  let paths = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (finalGrid[r][c] === 1) {
        const px = (c + margin) * moduleSize;
        const py = (r + margin) * moduleSize;
        paths.push(`M ${px},${py} l ${moduleSize},0 0,${moduleSize} -${moduleSize},0 z`);
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="100%" height="100%"><rect style="fill:#ffffff" x="0" y="0" width="${fullSize}" height="${fullSize}" rx="14" /><path style="fill:#0f172a" d="${paths.join(' ')}" /></svg>`;
  return svg;
}


module.exports = { generateQrSvg };
