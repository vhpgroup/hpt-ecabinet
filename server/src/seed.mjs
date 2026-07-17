// src/services/sha256.ts
var K = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
function utf8Bytes(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) out.push(c);
    else if (c < 2048) {
      out.push(192 | c >> 6, 128 | c & 63);
    } else if (c >= 55296 && c <= 56319) {
      const c2 = str.charCodeAt(++i);
      c = 65536 + ((c & 1023) << 10) + (c2 & 1023);
      out.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
    } else {
      out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    }
  }
  return new Uint8Array(out);
}
var rotr = (x, n) => x >>> n | x << 32 - n;
function sha256Hex(input) {
  const msg = utf8Bytes(input);
  const bitLen = msg.length * 8;
  const withOne = msg.length + 1;
  const total = withOne + (56 - withOne % 64 + 64) % 64 + 8;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 128;
  const hi = Math.floor(bitLen / 4294967296);
  const lo = bitLen >>> 0;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, hi, false);
  dv.setUint32(total - 4, lo, false);
  let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
  let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = h + S1 + ch + K[i] + w[i] >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  const toHex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
}

// src/data/seed.ts
function buildSeed() {
  const now = /* @__PURE__ */ new Date();
  const iso = (d) => d.toISOString();
  const minAgo = (m) => new Date(now.getTime() - m * 6e4);
  const minFromNow = (m) => new Date(now.getTime() + m * 6e4);
  const dayAt = (offsetDays, h, mi = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(h, mi, 0, 0);
    return d;
  };
  const units = [
    { id: "un-vp", name: "V\u0103n ph\xF2ng UBND t\u1EC9nh", short: "VP UBND", order: 1 },
    { id: "un-khdt", name: "S\u1EDF K\u1EBF ho\u1EA1ch v\xE0 \u0110\u1EA7u t\u01B0", short: "S\u1EDF KH&\u0110T", order: 2 },
    { id: "un-tc", name: "S\u1EDF T\xE0i ch\xEDnh", short: "S\u1EDF TC", order: 3 },
    { id: "un-xd", name: "S\u1EDF X\xE2y d\u1EF1ng", short: "S\u1EDF XD", order: 4 },
    { id: "un-tnmt", name: "S\u1EDF T\xE0i nguy\xEAn v\xE0 M\xF4i tr\u01B0\u1EDDng", short: "S\u1EDF TN&MT", order: 5 },
    { id: "un-gtvt", name: "S\u1EDF Giao th\xF4ng v\u1EADn t\u1EA3i", short: "S\u1EDF GTVT", order: 6 },
    { id: "un-yt", name: "S\u1EDF Y t\u1EBF", short: "S\u1EDF YT", order: 7 },
    { id: "un-gd", name: "S\u1EDF Gi\xE1o d\u1EE5c v\xE0 \u0110\xE0o t\u1EA1o", short: "S\u1EDF GD&\u0110T", order: 8 },
    { id: "un-tt", name: "S\u1EDF Th\xF4ng tin v\xE0 Truy\u1EC1n th\xF4ng", short: "S\u1EDF TT&TT", order: 9 }
  ];
  const P = "123456";
  const users = [
    { id: "u-admin", username: "quantri", password: P, fullName: "\u0110\u1ED7 Quang Tr\u1ECB", title: "Chuy\xEAn vi\xEAn CNTT \u2014 Qu\u1EA3n tr\u1ECB h\u1EC7 th\u1ED1ng", unitId: "un-vp", role: "admin", email: "quantri@tinh.gov.vn", phone: "0912 000 001", avatarColor: "#334155", status: "active" },
    { id: "u-ct", username: "chutich", password: P, fullName: "Tr\u1EA7n \u0110\u1EA1i Ngh\u0129a", title: "Ch\u1EE7 t\u1ECBch UBND t\u1EC9nh", unitId: "un-vp", role: "chairman", email: "chutich@tinh.gov.vn", phone: "0912 000 002", avatarColor: "#0f4c92", status: "active", position: "Ch\u1EE7 t\u1ECBch" },
    { id: "u-pct", username: "phochutich", password: P, fullName: "L\xEA Minh Khu\xEA", title: "Ph\xF3 Ch\u1EE7 t\u1ECBch UBND t\u1EC9nh", unitId: "un-vp", role: "chairman", email: "phochutich@tinh.gov.vn", phone: "0912 000 003", avatarColor: "#0e7490", status: "active", position: "Ph\xF3 Ch\u1EE7 t\u1ECBch" },
    { id: "u-tk", username: "thuky", password: P, fullName: "Ph\u1EA1m V\u0103n Th\u01B0", title: "Ch\xE1nh V\u0103n ph\xF2ng UBND t\u1EC9nh", unitId: "un-vp", role: "secretary", email: "thuky@tinh.gov.vn", phone: "0912 000 004", avatarColor: "#7c3aed", status: "active", position: "Ch\xE1nh V\u0103n ph\xF2ng" },
    { id: "u-khdt", username: "sokhdt", password: P, fullName: "Nguy\u1EC5n Ho\xE0i An", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF K\u1EBF ho\u1EA1ch v\xE0 \u0110\u1EA7u t\u01B0", unitId: "un-khdt", role: "delegate", email: "an.nh@tinh.gov.vn", phone: "0912 000 005", avatarColor: "#1d9e5f", status: "active", position: "Gi\xE1m \u0111\u1ED1c S\u1EDF" },
    { id: "u-tc", username: "sotc", password: P, fullName: "V\u0169 Th\u1ECB H\u1ED3ng", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF T\xE0i ch\xEDnh", unitId: "un-tc", role: "delegate", email: "hong.vt@tinh.gov.vn", phone: "0912 000 006", avatarColor: "#d97706", status: "active" },
    { id: "u-xd", username: "soxd", password: P, fullName: "\u0110\u1EB7ng Qu\u1ED1c B\u1EA3o", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF X\xE2y d\u1EF1ng", unitId: "un-xd", role: "delegate", email: "bao.dq@tinh.gov.vn", phone: "0912 000 007", avatarColor: "#b45309", status: "active" },
    { id: "u-pxd", username: "phosoxd", password: P, fullName: "Tr\u1EA7n Th\u1ECB Lan Anh", title: "Ph\xF3 Gi\xE1m \u0111\u1ED1c S\u1EDF X\xE2y d\u1EF1ng", unitId: "un-xd", role: "delegate", email: "lananh.tt@tinh.gov.vn", phone: "0912 000 008", avatarColor: "#be185d", status: "active" },
    { id: "u-tnmt", username: "sotnmt", password: P, fullName: "Ho\xE0ng Thu Trang", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF T\xE0i nguy\xEAn v\xE0 M\xF4i tr\u01B0\u1EDDng", unitId: "un-tnmt", role: "delegate", email: "trang.ht@tinh.gov.vn", phone: "0912 000 009", avatarColor: "#0d9488", status: "active" },
    { id: "u-gtvt", username: "sogtvt", password: P, fullName: "B\xF9i \u0110\u1EE9c Long", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF Giao th\xF4ng v\u1EADn t\u1EA3i", unitId: "un-gtvt", role: "delegate", email: "long.bd@tinh.gov.vn", phone: "0912 000 010", avatarColor: "#4338ca", status: "active" },
    { id: "u-yt", username: "soyt", password: P, fullName: "L\u01B0\u01A1ng Th\u1ECB Mai", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF Y t\u1EBF", unitId: "un-yt", role: "delegate", email: "mai.lt@tinh.gov.vn", phone: "0912 000 011", avatarColor: "#d64545", status: "active" },
    { id: "u-gd", username: "sogddt", password: P, fullName: "Tr\u1ECBnh V\u0103n S\xE1ng", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF Gi\xE1o d\u1EE5c v\xE0 \u0110\xE0o t\u1EA1o", unitId: "un-gd", role: "delegate", email: "sang.tv@tinh.gov.vn", phone: "0912 000 012", avatarColor: "#65a30d", status: "active" },
    { id: "u-tt", username: "sotttt", password: P, fullName: "Ng\xF4 Gia Huy", title: "Gi\xE1m \u0111\u1ED1c S\u1EDF Th\xF4ng tin v\xE0 Truy\u1EC1n th\xF4ng", unitId: "un-tt", role: "delegate", email: "huy.ng@tinh.gov.vn", phone: "0912 000 013", avatarColor: "#0369a1", status: "active" },
    // Quản trị đơn vị (E-HSMT vai trò thứ 5) — quản lý người dùng trong Sở KH&ĐT (cùng đơn vị với sokhdt)
    { id: "u-qtdv", username: "qtdonvi", password: P, fullName: "Nguy\u1EC5n Qu\u1EA3n Tr\u1ECB", title: "Chuy\xEAn vi\xEAn \u2014 Qu\u1EA3n tr\u1ECB \u0111\u01A1n v\u1ECB S\u1EDF KH&\u0110T", unitId: "un-khdt", role: "unit_admin", email: "qtdv.khdt@tinh.gov.vn", phone: "0912 000 014", avatarColor: "#0d9488", status: "active" }
  ];
  const rooms = [
    // Sơ đồ phòng họp số 1: lưới 5 hàng x 6 cột; cột giữa (index 2,3) hàng 2,3 để trống làm lối đi
    { id: "r1", name: "Ph\xF2ng h\u1ECDp s\u1ED1 1", location: "T\u1EA7ng 3, Tr\u1EE5 s\u1EDF UBND t\u1EC9nh", capacity: 40, equipment: ['M\xE0n h\xECnh LED 85"', "\xC2m thanh h\u1ED9i ngh\u1ECB", "Camera PTZ", "M\xE1y qu\xE9t QR \u0111i\u1EC3m danh"], supportsOnline: true, status: "active", layout: { rows: 5, cols: 6, disabled: ["2-2", "2-3", "3-2", "3-3"] } },
    { id: "r2", name: "H\u1ED9i tr\u01B0\u1EDDng A", location: "T\u1EA7ng 1, Tr\u1EE5 s\u1EDF UBND t\u1EC9nh", capacity: 120, equipment: ["S\xE2n kh\u1EA5u", "M\xE1y chi\u1EBFu 4K", "H\u1EC7 th\u1ED1ng \xE2m thanh l\u1EDBn"], supportsOnline: false, status: "active" },
    { id: "r3", name: "Ph\xF2ng h\u1ECDp tr\u1EF1c tuy\u1EBFn", location: "T\u1EA7ng 5, Tr\u1EE5 s\u1EDF UBND t\u1EC9nh", capacity: 20, equipment: ["Thi\u1EBFt b\u1ECB h\u1ED9i ngh\u1ECB truy\u1EC1n h\xECnh", "Micro \u0111a h\u01B0\u1EDBng"], supportsOnline: true, status: "active" }
  ];
  const docText = {
    ktxh: `\u1EE6Y BAN NH\xC2N D\xC2N T\u1EC8NH

B\xC1O C\xC1O
T\xECnh h\xECnh kinh t\u1EBF \u2013 x\xE3 h\u1ED9i 6 th\xE1ng \u0111\u1EA7u n\u0103m 2026 v\xE0 nhi\u1EC7m v\u1EE5 tr\u1ECDng t\xE2m 6 th\xE1ng cu\u1ED1i n\u0103m

I. K\u1EBET QU\u1EA2 \u0110\u1EA0T \u0110\u01AF\u1EE2C
1. T\u0103ng tr\u01B0\u1EDFng kinh t\u1EBF (GRDP) 6 th\xE1ng \u0111\u1EA7u n\u0103m \u01B0\u1EDBc \u0111\u1EA1t 8,42%, cao h\u01A1n c\xF9ng k\u1EF3 n\u0103m 2025 (7,65%); trong \u0111\xF3 khu v\u1EF1c c\xF4ng nghi\u1EC7p \u2013 x\xE2y d\u1EF1ng t\u0103ng 10,3%, d\u1ECBch v\u1EE5 t\u0103ng 8,1%, n\xF4ng \u2013 l\xE2m \u2013 th\u1EE7y s\u1EA3n t\u0103ng 3,4%.
2. Thu ng\xE2n s\xE1ch nh\xE0 n\u01B0\u1EDBc tr\xEAn \u0111\u1ECBa b\xE0n \u0111\u1EA1t 9.860 t\u1EF7 \u0111\u1ED3ng, b\u1EB1ng 58,2% d\u1EF1 to\xE1n, t\u0103ng 12,4% so v\u1EDBi c\xF9ng k\u1EF3. Gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EA1t 41,6% k\u1EBF ho\u1EA1ch.
3. To\xE0n t\u1EC9nh thu h\xFAt 28 d\u1EF1 \xE1n \u0111\u1EA7u t\u01B0 m\u1EDBi v\u1EDBi t\u1ED5ng v\u1ED1n \u0111\u0103ng k\xFD 12.450 t\u1EF7 \u0111\u1ED3ng; th\xE0nh l\u1EADp m\u1EDBi 642 doanh nghi\u1EC7p, t\u0103ng 9,8%.
4. C\xE1c l\u0129nh v\u1EF1c v\u0103n h\xF3a \u2013 x\xE3 h\u1ED9i ti\u1EBFp t\u1EE5c \u0111\u01B0\u1EE3c quan t\xE2m; an sinh x\xE3 h\u1ED9i \u0111\u01B0\u1EE3c b\u1EA3o \u0111\u1EA3m; qu\u1ED1c ph\xF2ng \u2013 an ninh \u0111\u01B0\u1EE3c gi\u1EEF v\u1EEFng.

II. T\u1ED2N T\u1EA0I, H\u1EA0N CH\u1EBE
1. Ti\u1EBFn \u0111\u1ED9 gi\u1EA3i ph\xF3ng m\u1EB7t b\u1EB1ng m\u1ED9t s\u1ED1 d\u1EF1 \xE1n tr\u1ECDng \u0111i\u1EC3m c\xF2n ch\u1EADm, nh\u1EA5t l\xE0 D\u1EF1 \xE1n \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng.
2. Gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng tuy cao h\u01A1n b\xECnh qu\xE2n c\u1EA3 n\u01B0\u1EDBc nh\u01B0ng ch\u01B0a \u0111\u1EA1t k\u1ECBch b\u1EA3n \u0111\u1EC1 ra (45%).
3. T\xECnh tr\u1EA1ng thi\u1EBFu nh\xE2n l\u1EF1c y t\u1EBF c\u01A1 s\u1EDF, gi\xE1o vi\xEAn m\u1ED9t s\u1ED1 m\xF4n h\u1ECDc \u0111\u1EB7c th\xF9 ch\u01B0a \u0111\u01B0\u1EE3c kh\u1EAFc ph\u1EE5c tri\u1EC7t \u0111\u1EC3.

III. NHI\u1EC6M V\u1EE4 TR\u1ECCNG T\xC2M 6 TH\xC1NG CU\u1ED0I N\u0102M
1. T\u1EADp trung th\xE1o g\u1EE1 kh\xF3 kh\u0103n, ph\u1EA5n \u0111\u1EA5u gi\u1EA3i ng\xE2n 100% k\u1EBF ho\u1EA1ch v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026.
2. Ho\xE0n th\xE0nh ph\xEA duy\u1EC7t K\u1EBF ho\u1EA1ch chuy\u1EC3n \u0111\u1ED5i s\u1ED1 t\u1EC9nh giai \u0111o\u1EA1n 2026\u20132030.
3. \u0110\u1EA9y nhanh ti\u1EBFn \u0111\u1ED9 c\xE1c d\u1EF1 \xE1n h\u1EA1 t\u1EA7ng chi\u1EBFn l\u01B0\u1EE3c, c\xE1c khu \u2013 c\u1EE5m c\xF4ng nghi\u1EC7p.
4. Chu\u1EA9n b\u1ECB t\u1ED1t c\xE1c \u0111i\u1EC1u ki\u1EC7n cho n\u0103m h\u1ECDc m\u1EDBi 2026\u20132027 v\xE0 c\xF4ng t\xE1c ph\xF2ng, ch\u1ED1ng thi\xEAn tai.`,
    phuluc: `PH\u1EE4 L\u1EE4C S\u1ED0 LI\u1EC6U KINH T\u1EBE \u2013 X\xC3 H\u1ED8I 6 TH\xC1NG \u0110\u1EA6U N\u0102M 2026

Ch\u1EC9 ti\xEAu | K\u1EBF ho\u1EA1ch n\u0103m | Th\u1EF1c hi\u1EC7n 6 th\xE1ng | % KH
T\u0103ng tr\u01B0\u1EDFng GRDP | 8,5% | 8,42% | \u2014
Thu NSNN (t\u1EF7 \u0111\u1ED3ng) | 16.950 | 9.860 | 58,2%
Gi\u1EA3i ng\xE2n \u0110TC (t\u1EF7 \u0111\u1ED3ng) | 7.200 | 2.995 | 41,6%
Kim ng\u1EA1ch xu\u1EA5t kh\u1EA9u (tri\u1EC7u USD) | 2.400 | 1.310 | 54,6%
Kh\xE1ch du l\u1ECBch (tri\u1EC7u l\u01B0\u1EE3t) | 8,0 | 4,35 | 54,4%
Doanh nghi\u1EC7p th\xE0nh l\u1EADp m\u1EDBi | 1.200 | 642 | 53,5%
T\u1EF7 l\u1EC7 h\u1ED3 s\u01A1 TTHC tr\u1EF1c tuy\u1EBFn | 90% | 86,4% | \u2014
S\u1ED1 x\xE3 \u0111\u1EA1t chu\u1EA9n NTM n\xE2ng cao | 12 | 5 | 41,7%`,
    totrinh: `T\u1EDC TR\xCCNH
V\u1EC1 vi\u1EC7c ph\xE2n b\u1ED5 k\u1EBF ho\u1EA1ch v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EE3t 2 n\u0103m 2026

K\xEDnh g\u1EEDi: \u1EE6y ban nh\xE2n d\xE2n t\u1EC9nh

C\u0103n c\u1EE9 Lu\u1EADt \u0110\u1EA7u t\u01B0 c\xF4ng; c\u0103n c\u1EE9 Ngh\u1ECB quy\u1EBFt c\u1EE7a H\u0110ND t\u1EC9nh v\u1EC1 k\u1EBF ho\u1EA1ch \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026;
S\u1EDF T\xE0i ch\xEDnh tr\xECnh UBND t\u1EC9nh ph\u01B0\u01A1ng \xE1n ph\xE2n b\u1ED5 850 t\u1EF7 \u0111\u1ED3ng k\u1EBF ho\u1EA1ch v\u1ED1n \u0111\u1EE3t 2 n\u0103m 2026 nh\u01B0 sau:

1. L\u0129nh v\u1EF1c giao th\xF4ng: 380 t\u1EF7 \u0111\u1ED3ng (44,7%) \u2014 \u01B0u ti\xEAn D\u1EF1 \xE1n \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng v\xE0 03 tuy\u1EBFn \u0111\u01B0\u1EDDng li\xEAn huy\u1EC7n.
2. L\u0129nh v\u1EF1c y t\u1EBF \u2013 gi\xE1o d\u1EE5c: 240 t\u1EF7 \u0111\u1ED3ng (28,2%) \u2014 n\xE2ng c\u1EA5p 02 b\u1EC7nh vi\u1EC7n tuy\u1EBFn huy\u1EC7n, x\xE2y m\u1EDBi 12 ph\xF2ng h\u1ECDc b\u1ED9 m\xF4n.
3. H\u1EA1 t\u1EA7ng s\u1ED1 v\xE0 chuy\u1EC3n \u0111\u1ED5i s\u1ED1: 130 t\u1EF7 \u0111\u1ED3ng (15,3%) \u2014 trung t\xE2m d\u1EEF li\u1EC7u t\u1EC9nh, h\u1EC7 th\u1ED1ng h\u1ECDp kh\xF4ng gi\u1EA5y giai \u0111o\u1EA1n 2.
4. N\xF4ng nghi\u1EC7p \u2013 th\u1EE7y l\u1EE3i: 100 t\u1EF7 \u0111\u1ED3ng (11,8%) \u2014 ki\xEAn c\u1ED1 h\xF3a k\xEAnh m\u01B0\u01A1ng, h\u1ED3 ch\u1EE9a.

S\u1EDF T\xE0i ch\xEDnh k\xEDnh tr\xECnh UBND t\u1EC9nh xem x\xE9t, quy\u1EBFt ngh\u1ECB./.`,
    vanhdai: `B\xC1O C\xC1O
Ti\u1EBFn \u0111\u1ED9 th\u1EF1c hi\u1EC7n D\u1EF1 \xE1n \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng

1. Kh\u1ED1i l\u01B0\u1EE3ng thi c\xF4ng: \u0111\u1EA1t 62,5% gi\xE1 tr\u1ECB h\u1EE3p \u0111\u1ED3ng, ch\u1EADm 4,2% so v\u1EDBi k\u1EBF ho\u1EA1ch.
2. Gi\u1EA3i ph\xF3ng m\u1EB7t b\u1EB1ng: \u0111\xE3 b\xE0n giao 91,3% di\u1EC7n t\xEDch; c\xF2n 27 h\u1ED9 d\xE2n t\u1EA1i x\xE3 \u0110\xF4ng Ph\xFA ch\u01B0a nh\u1EADn ti\u1EC1n b\u1ED3i th\u01B0\u1EDDng.
3. V\u01B0\u1EDBng m\u1EAFc ch\xEDnh: (i) gi\xE1 v\u1EADt li\u1EC7u \u0111\u1EAFp n\u1EC1n t\u0103ng 18%; (ii) 1,2 km \u0111o\u1EA1n qua khu d\xE2n c\u01B0 ch\u01B0a ho\xE0n th\xE0nh t\xE1i \u0111\u1ECBnh c\u01B0.
4. Ki\u1EBFn ngh\u1ECB: UBND t\u1EC9nh ch\u1EC9 \u0111\u1EA1o S\u1EDF TN&MT v\xE0 UBND huy\u1EC7n \u0110\xF4ng H\u1EA3i ho\xE0n th\xE0nh GPMB tr\u01B0\u1EDBc 15/8/2026; cho ph\xE9p \u0111i\u1EC1u ch\u1EC9nh ngu\u1ED3n v\u1EADt li\u1EC7u t\u1EA1i m\u1ECF \u0110\xF4ng S\u01A1n.`,
    nghiquyet: `D\u1EF0 TH\u1EA2O
NGH\u1ECA QUY\u1EBET PHI\xCAN H\u1ECCP TH\u01AF\u1EDCNG K\u1EF2 UBND T\u1EC8NH TH\xC1NG 7/2026

\u0110i\u1EC1u 1. Th\xF4ng qua B\xE1o c\xE1o t\xECnh h\xECnh kinh t\u1EBF \u2013 x\xE3 h\u1ED9i 6 th\xE1ng \u0111\u1EA7u n\u0103m 2026; th\u1ED1ng nh\u1EA5t 04 nh\xF3m nhi\u1EC7m v\u1EE5 tr\u1ECDng t\xE2m 6 th\xE1ng cu\u1ED1i n\u0103m.
\u0110i\u1EC1u 2. Th\u1ED1ng nh\u1EA5t ch\u1EE7 tr\u01B0\u01A1ng ph\xE2n b\u1ED5 850 t\u1EF7 \u0111\u1ED3ng k\u1EBF ho\u1EA1ch v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EE3t 2 n\u0103m 2026 theo T\u1EDD tr\xECnh c\u1EE7a S\u1EDF T\xE0i ch\xEDnh.
\u0110i\u1EC1u 3. Giao S\u1EDF TN&MT ch\u1EE7 tr\xEC, ph\u1ED1i h\u1EE3p UBND huy\u1EC7n \u0110\xF4ng H\u1EA3i ho\xE0n th\xE0nh gi\u1EA3i ph\xF3ng m\u1EB7t b\u1EB1ng D\u1EF1 \xE1n \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng tr\u01B0\u1EDBc ng\xE0y 15/8/2026.
\u0110i\u1EC1u 4. V\u0103n ph\xF2ng UBND t\u1EC9nh theo d\xF5i, \u0111\xF4n \u0111\u1ED1c vi\u1EC7c th\u1EF1c hi\u1EC7n Ngh\u1ECB quy\u1EBFt n\xE0y./.`,
    quyche: `QUY CH\u1EBE L\xC0M VI\u1EC6C C\u1EE6A \u1EE6Y BAN NH\xC2N D\xC2N T\u1EC8NH
(Tr\xEDch)

\u0110i\u1EC1u 12. Phi\xEAn h\u1ECDp UBND t\u1EC9nh
1. UBND t\u1EC9nh h\u1ECDp th\u01B0\u1EDDng k\u1EF3 m\u1ED7i th\xE1ng m\u1ED9t l\u1EA7n v\xE0o tu\u1EA7n cu\u1ED1i c\u1EE7a th\xE1ng.
2. T\xE0i li\u1EC7u phi\xEAn h\u1ECDp \u0111\u01B0\u1EE3c g\u1EEDi \u0111\u1EBFn c\xE1c th\xE0nh vi\xEAn ch\u1EADm nh\u1EA5t 03 ng\xE0y l\xE0m vi\u1EC7c tr\u01B0\u1EDBc ng\xE0y h\u1ECDp qua H\u1EC7 th\u1ED1ng ph\xF2ng h\u1ECDp kh\xF4ng gi\u1EA5y.
3. Th\xE0nh vi\xEAn UBND t\u1EC9nh c\xF3 tr\xE1ch nhi\u1EC7m nghi\xEAn c\u1EE9u t\xE0i li\u1EC7u, cho \xFD ki\u1EBFn v\xE0 bi\u1EC3u quy\u1EBFt c\xE1c n\u1ED9i dung thu\u1ED9c th\u1EA9m quy\u1EC1n.
\u0110i\u1EC1u 13. Bi\u1EC3u quy\u1EBFt
1. Ngh\u1ECB quy\u1EBFt c\u1EE7a UBND t\u1EC9nh \u0111\u01B0\u1EE3c th\xF4ng qua khi c\xF3 qu\xE1 n\u1EEDa t\u1ED5ng s\u1ED1 th\xE0nh vi\xEAn bi\u1EC3u quy\u1EBFt t\xE1n th\xE0nh.
2. K\u1EBFt qu\u1EA3 bi\u1EC3u quy\u1EBFt \u0111\u01B0\u1EE3c ghi nh\u1EADn v\xE0o bi\xEAn b\u1EA3n phi\xEAn h\u1ECDp v\xE0 l\u01B0u tr\u1EEF \u0111i\u1EC7n t\u1EED.`,
    chithi: `CH\u1EC8 TH\u1ECA S\u1ED0 05/CT-TTg
V\u1EC1 vi\u1EC7c \u0111\u1EA9y m\u1EA1nh gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026
(T\xE0i li\u1EC7u tham kh\u1EA3o \u2014 l\u01B0u h\xE0nh n\u1ED9i b\u1ED9)

Th\u1EE7 t\u01B0\u1EDBng Ch\xEDnh ph\u1EE7 y\xEAu c\u1EA7u c\xE1c b\u1ED9, ng\xE0nh, \u0111\u1ECBa ph\u01B0\u01A1ng:
1. Ph\u1EA5n \u0111\u1EA5u gi\u1EA3i ng\xE2n tr\xEAn 95% k\u1EBF ho\u1EA1ch \u0111\u01B0\u1EE3c giao; g\u1EAFn tr\xE1ch nhi\u1EC7m ng\u01B0\u1EDDi \u0111\u1EE9ng \u0111\u1EA7u.
2. R\xFAt ng\u1EAFn t\u1ED1i thi\u1EC3u 30% th\u1EDDi gian th\u1EA9m \u0111\u1ECBnh d\u1EF1 \xE1n; x\u1EED l\xFD nghi\xEAm h\xE0nh vi nh\u0169ng nhi\u1EC5u.
3. B\xE1o c\xE1o \u0111\u1ECBnh k\u1EF3 h\u1EB1ng th\xE1ng v\u1EC1 B\u1ED9 K\u1EBF ho\u1EA1ch v\xE0 \u0110\u1EA7u t\u01B0.`,
    giaingan: `B\xC1O C\xC1O CHUY\xCAN \u0110\u1EC0
T\xECnh h\xECnh gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026

1. T\u1ED5ng k\u1EBF ho\u1EA1ch v\u1ED1n: 7.200 t\u1EF7 \u0111\u1ED3ng; \u0111\xE3 gi\u1EA3i ng\xE2n 2.995 t\u1EF7 \u0111\u1ED3ng (41,6%).
2. 05 ch\u1EE7 \u0111\u1EA7u t\u01B0 gi\u1EA3i ng\xE2n d\u01B0\u1EDBi 25%: \u0111\u1EC1 ngh\u1ECB ki\u1EC3m \u0111i\u1EC3m, l\xE0m r\xF5 tr\xE1ch nhi\u1EC7m.
3. \u0110\u1EC1 xu\u1EA5t \u0111i\u1EC1u chuy\u1EC3n 120 t\u1EF7 \u0111\u1ED3ng t\u1EEB c\xE1c d\u1EF1 \xE1n ch\u1EADm ti\u1EBFn \u0111\u1ED9 sang c\xE1c d\u1EF1 \xE1n c\xF3 kh\u1EA3 n\u0103ng h\u1EA5p th\u1EE5 v\u1ED1n t\u1ED1t.`,
    cds: `D\u1EF0 TH\u1EA2O
K\u1EBE HO\u1EA0CH CHUY\u1EC2N \u0110\u1ED4I S\u1ED0 T\u1EC8NH GIAI \u0110O\u1EA0N 2026\u20132030

M\u1EE5c ti\xEAu \u0111\u1EBFn n\u0103m 2030:
- 100% th\u1EE7 t\u1EE5c h\xE0nh ch\xEDnh \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n cung c\u1EA5p tr\u1EF1c tuy\u1EBFn to\xE0n tr\xECnh.
- 100% cu\u1ED9c h\u1ECDp c\u1EE7a UBND t\u1EC9nh v\xE0 c\xE1c s\u1EDF, ng\xE0nh th\u1EF1c hi\u1EC7n tr\xEAn h\u1EC7 th\u1ED1ng ph\xF2ng h\u1ECDp kh\xF4ng gi\u1EA5y.
- Kinh t\u1EBF s\u1ED1 chi\u1EBFm 25% GRDP; 90% ng\u01B0\u1EDDi d\xE2n tr\u01B0\u1EDFng th\xE0nh c\xF3 danh t\xEDnh s\u1ED1.
- Ho\xE0n th\xE0nh Trung t\xE2m d\u1EEF li\u1EC7u t\u1EC9nh \u0111\u1EA1t chu\u1EA9n Tier III v\xE0 n\u1EC1n t\u1EA3ng t\xEDch h\u1EE3p, chia s\u1EBB d\u1EEF li\u1EC7u (LGSP) th\u1EBF h\u1EC7 m\u1EDBi.

Nhi\u1EC7m v\u1EE5 tr\u1ECDng t\xE2m: ph\xE1t tri\u1EC3n h\u1EA1 t\u1EA7ng s\u1ED1, d\u1EEF li\u1EC7u s\u1ED1, nh\xE2n l\u1EF1c s\u1ED1; b\u1EA3o \u0111\u1EA3m an to\xE0n th\xF4ng tin theo c\u1EA5p \u0111\u1ED9; b\u1ED1 tr\xED t\u1ED1i thi\u1EC3u 1,5% chi ng\xE2n s\xE1ch h\u1EB1ng n\u0103m cho chuy\u1EC3n \u0111\u1ED5i s\u1ED1.`,
    kt6: `B\xC1O C\xC1O
T\xECnh h\xECnh kinh t\u1EBF \u2013 x\xE3 h\u1ED9i th\xE1ng 6 v\xE0 nhi\u1EC7m v\u1EE5 th\xE1ng 7 n\u0103m 2026

1. Ch\u1EC9 s\u1ED1 s\u1EA3n xu\u1EA5t c\xF4ng nghi\u1EC7p (IIP) th\xE1ng 6 t\u0103ng 11,2% so v\u1EDBi c\xF9ng k\u1EF3.
2. T\u1ED5ng m\u1EE9c b\xE1n l\u1EBB h\xE0ng h\xF3a v\xE0 doanh thu d\u1ECBch v\u1EE5 \u0111\u1EA1t 8.420 t\u1EF7 \u0111\u1ED3ng, t\u0103ng 10,5%.
3. Nhi\u1EC7m v\u1EE5 th\xE1ng 7: ho\xE0n th\xE0nh b\xE1o c\xE1o s\u01A1 k\u1EBFt 6 th\xE1ng; chu\u1EA9n b\u1ECB k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh gi\u1EEFa n\u0103m.`,
    tsc: `D\u1EF0 TH\u1EA2O
QUY CH\u1EBE QU\u1EA2N L\xDD, S\u1EEC D\u1EE4NG T\xC0I S\u1EA2N C\xD4NG T\u1EA0I C\xC1C C\u01A0 QUAN, \u0110\u01A0N V\u1ECA

Ch\u01B0\u01A1ng I. Quy \u0111\u1ECBnh chung: ph\u1EA1m vi, \u0111\u1ED1i t\u01B0\u1EE3ng \xE1p d\u1EE5ng, nguy\xEAn t\u1EAFc qu\u1EA3n l\xFD.
Ch\u01B0\u01A1ng II. Ti\xEAu chu\u1EA9n, \u0111\u1ECBnh m\u1EE9c s\u1EED d\u1EE5ng tr\u1EE5 s\u1EDF l\xE0m vi\u1EC7c, xe \xF4 t\xF4 c\xF4ng, m\xE1y m\xF3c thi\u1EBFt b\u1ECB.
Ch\u01B0\u01A1ng III. Tr\xECnh t\u1EF1 mua s\u1EAFm, thu\xEA, thu h\u1ED3i, \u0111i\u1EC1u chuy\u1EC3n, thanh l\xFD t\xE0i s\u1EA3n c\xF4ng.
Ch\u01B0\u01A1ng IV. Tr\xE1ch nhi\u1EC7m c\u1EE7a th\u1EE7 tr\u01B0\u1EDFng c\u01A1 quan, \u0111\u01A1n v\u1ECB v\xE0 ch\u1EBF \u0111\u1ED9 b\xE1o c\xE1o, c\xF4ng khai.`,
    ghichu: `GHI CH\xDA CHU\u1EA8N B\u1ECA \xDD KI\u1EBEN CH\u1EC8 \u0110\u1EA0O \u2014 PHI\xCAN H\u1ECCP TH\xC1NG 7

1. Bi\u1EC3u d\u01B0\u01A1ng S\u1EDF KH&\u0110T v\u1EC1 k\u1EBFt qu\u1EA3 thu h\xFAt \u0111\u1EA7u t\u01B0 (12.450 t\u1EF7 \u0111\u1ED3ng).
2. Nh\u1EAFc nh\u1EDF ti\u1EBFn \u0111\u1ED9 GPMB \u0111\u01B0\u1EDDng v\xE0nh \u0111ai \u2014 y\xEAu c\u1EA7u cam k\u1EBFt m\u1ED1c 15/8.
3. L\u01B0u \xFD c\xE2n \u0111\u1ED1i v\u1ED1n \u0111\u1EE3t 2: \u01B0u ti\xEAn y t\u1EBF c\u01A1 s\u1EDF theo ki\u1EBFn ngh\u1ECB c\u1EE7a S\u1EDF Y t\u1EBF.
4. Giao VP UBND t\u1EC9nh d\u1EF1 th\u1EA3o Ch\u1EC9 th\u1ECB v\u1EC1 t\u0103ng c\u01B0\u1EDDng k\u1EF7 lu\u1EADt, k\u1EF7 c\u01B0\u01A1ng h\xE0nh ch\xEDnh.`,
    dscv: `DANH S\xC1CH C\xD4NG VI\u1EC6C CHU\u1EA8N B\u1ECA PHI\xCAN H\u1ECCP TH\xC1NG 7

[x] G\u1EEDi gi\u1EA5y m\u1EDDi + t\xE0i li\u1EC7u tr\u01B0\u1EDBc 03 ng\xE0y l\xE0m vi\u1EC7c
[x] Ki\u1EC3m tra thi\u1EBFt b\u1ECB ph\xF2ng h\u1ECDp s\u1ED1 1, h\u1EC7 th\u1ED1ng \u0111i\u1EC3m danh QR
[x] N\u1EA1p t\xE0i li\u1EC7u 04 n\u1ED9i dung l\xEAn h\u1EC7 th\u1ED1ng
[ ] Chu\u1EA9n b\u1ECB d\u1EF1 th\u1EA3o Ngh\u1ECB quy\u1EBFt, bi\u1EC3u quy\u1EBFt \u0111i\u1EC7n t\u1EED
[ ] D\u1EF1 th\u1EA3o bi\xEAn b\u1EA3n, tr\xECnh k\xFD s\u1ED1 ngay sau phi\xEAn h\u1ECDp`
  };
  const D = (id, name, kind, ownerId, content, opts = {}) => ({
    id,
    name,
    kind,
    ownerId,
    content,
    meetingId: null,
    agendaItemId: null,
    sharedWith: [],
    dataUrl: void 0,
    size: content.length * 2,
    mime: "application/pdf",
    uploadedAt: iso(minAgo(60 * 24 * 3)),
    secret: false,
    version: 1,
    ...opts
  });
  const documents = [
    D("d1", "B\xE1o c\xE1o KT-XH 6 th\xE1ng \u0111\u1EA7u n\u0103m 2026.pdf", "main", "u-khdt", docText.ktxh, { meetingId: "m1", agendaItemId: "a1", issuingBody: "S\u1EDF K\u1EBF ho\u1EA1ch v\xE0 \u0110\u1EA7u t\u01B0" }),
    D("d2", "Ph\u1EE5 l\u1EE5c s\u1ED1 li\u1EC7u KT-XH.pdf", "main", "u-khdt", docText.phuluc, { meetingId: "m1", agendaItemId: "a1", issuingBody: "S\u1EDF K\u1EBF ho\u1EA1ch v\xE0 \u0110\u1EA7u t\u01B0" }),
    D("d3", "T\u1EDD tr\xECnh ph\xE2n b\u1ED5 v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EE3t 2.pdf", "main", "u-tc", docText.totrinh, { meetingId: "m1", agendaItemId: "a2", issuingBody: "S\u1EDF T\xE0i ch\xEDnh" }),
    D("d4", "B\xE1o c\xE1o ti\u1EBFn \u0111\u1ED9 \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng.pdf", "main", "u-gtvt", docText.vanhdai, { meetingId: "m1", agendaItemId: "a3" }),
    D("d5", "D\u1EF1 th\u1EA3o Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp th\xE1ng 7.pdf", "main", "u-tk", docText.nghiquyet, { meetingId: "m1", agendaItemId: "a4", version: 2, issuingBody: "V\u0103n ph\xF2ng UBND" }),
    D("d-ref1", "Quy ch\u1EBF l\xE0m vi\u1EC7c c\u1EE7a UBND t\u1EC9nh.pdf", "reference", "u-tk", docText.quyche, { meetingId: "m1" }),
    D("d-ref2", "Ch\u1EC9 th\u1ECB 05/CT-TTg v\u1EC1 gi\u1EA3i ng\xE2n \u0110TC.pdf", "reference", "u-tk", docText.chithi, { meetingId: "m1", secret: true }),
    D("d6", "B\xE1o c\xE1o gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng.pdf", "main", "u-khdt", docText.giaingan, { meetingId: "m2", agendaItemId: "a2-1" }),
    D("d7", "D\u1EF1 th\u1EA3o K\u1EBF ho\u1EA1ch chuy\u1EC3n \u0111\u1ED5i s\u1ED1 2026-2030.pdf", "main", "u-tt", docText.cds, { meetingId: "m3", agendaItemId: "a3-1" }),
    D("d8", "B\xE1o c\xE1o KT-XH th\xE1ng 6.2026.pdf", "main", "u-khdt", docText.kt6, { meetingId: "m4", agendaItemId: "a4-1" }),
    D("d9", "D\u1EF1 th\u1EA3o Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp th\xE1ng 6.pdf", "main", "u-tk", docText.nghiquyet.replace(/THÁNG 7/g, "TH\xC1NG 6"), { meetingId: "m4", agendaItemId: "a4-3" }),
    D("d10", "D\u1EF1 th\u1EA3o Quy ch\u1EBF qu\u1EA3n l\xFD t\xE0i s\u1EA3n c\xF4ng.pdf", "reference", "u-tc", docText.tsc, {}),
    // E-HSMT mục 24 — demo quy trình trình–duyệt tài liệu (trong phiên m2 sắp diễn ra):
    // 1 tài liệu ĐANG CHỜ DUYỆT do Sở Tài chính trình lên
    D("d11", "T\u1EDD tr\xECnh ph\u01B0\u01A1ng \xE1n \u0111i\u1EC1u chuy\u1EC3n 120 t\u1EF7 v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng.pdf", "main", "u-tc", docText.totrinh, { meetingId: "m2", agendaItemId: "a2-2", reviewStatus: "pending" }),
    // 1 tài liệu BỊ TỪ CHỐI (yêu cầu làm lại) — kèm lý do
    D("d12", "B\xE1o c\xE1o b\u1ED5 sung ti\u1EBFn \u0111\u1ED9 gi\u1EA3i ng\xE2n (b\u1EA3n 1).pdf", "main", "u-gtvt", docText.giaingan, { meetingId: "m2", agendaItemId: "a2-1", reviewStatus: "rejected", reviewNote: "Thi\u1EBFu s\u1ED1 li\u1EC7u gi\u1EA3i ng\xE2n chi ti\u1EBFt theo t\u1EEBng ch\u1EE7 \u0111\u1EA7u t\u01B0; \u0111\u1EC1 ngh\u1ECB b\u1ED5 sung ph\u1EE5 l\u1EE5c v\xE0 tr\xECnh l\u1EA1i.", reviewedById: "u-tk", reviewedAt: iso(minAgo(60 * 3)) }),
    D("d-p1", "Ghi ch\xFA chu\u1EA9n b\u1ECB \xFD ki\u1EBFn ch\u1EC9 \u0111\u1EA1o.docx", "personal", "u-ct", docText.ghichu, { sharedWith: ["u-tk"], mime: "application/msword", folder: "Ch\u1EC9 \u0111\u1EA1o \u0111i\u1EC1u h\xE0nh" }),
    D("d-p2", "Danh s\xE1ch c\xF4ng vi\u1EC7c chu\u1EA9n b\u1ECB phi\xEAn h\u1ECDp.docx", "personal", "u-tk", docText.dscv, { mime: "application/msword", folder: "Chu\u1EA9n b\u1ECB h\u1ECDp" })
  ];
  const pAccepted = (userId, meetingRole, seat, checkedIn = true) => ({
    userId,
    meetingRole,
    attendStatus: "accepted",
    checkedInAt: checkedIn ? iso(minAgo(25 + Math.floor(Math.random() * 10))) : null,
    seat
  });
  const meetings = [
    {
      id: "m1",
      code: "PH-2026/07-01",
      title: "Phi\xEAn h\u1ECDp th\u01B0\u1EDDng k\u1EF3 UBND t\u1EC9nh th\xE1ng 7/2026",
      description: "\u0110\xE1nh gi\xE1 t\xECnh h\xECnh KT-XH 6 th\xE1ng \u0111\u1EA7u n\u0103m 2026; ph\xE2n b\u1ED5 v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EE3t 2; ti\u1EBFn \u0111\u1ED9 d\u1EF1 \xE1n tr\u1ECDng \u0111i\u1EC3m; th\xF4ng qua Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp.",
      meetingType: "H\u1ECDp th\u01B0\u1EDDng k\u1EF3",
      startTime: iso(minAgo(30)),
      endTime: iso(minFromNow(90)),
      roomId: "r1",
      isOnline: true,
      status: "live",
      chairId: "u-ct",
      secretaryId: "u-tk",
      participants: [
        pAccepted("u-ct", "chair", "Ch\u1EE7 t\u1ECDa"),
        pAccepted("u-tk", "secretary", "B\xE0n th\u01B0 k\xFD"),
        pAccepted("u-pct", "member", "A1"),
        pAccepted("u-khdt", "member", "A2"),
        pAccepted("u-tc", "member", "A3"),
        { userId: "u-xd", meetingRole: "member", attendStatus: "delegated", delegateToId: "u-pxd", checkedInAt: null, seat: "A4" },
        pAccepted("u-pxd", "guest", "A4"),
        pAccepted("u-tnmt", "member", "B1"),
        pAccepted("u-gtvt", "member", "B2"),
        pAccepted("u-yt", "member", "B3", false),
        pAccepted("u-gd", "member", "B4", false),
        pAccepted("u-tt", "member", "B5")
      ],
      // Gán sẵn vị trí đại biểu trên sơ đồ (khóa "hàng-cột" 0-based; tránh ô lối đi)
      seatAssignments: {
        "u-ct": "0-2",
        "u-tk": "0-3",
        "u-pct": "1-0",
        "u-khdt": "1-1",
        "u-tc": "1-4",
        "u-tnmt": "3-0",
        "u-gtvt": "3-1"
      },
      agenda: [
        { id: "a1", order: 1, title: "B\xE1o c\xE1o t\xECnh h\xECnh kinh t\u1EBF \u2013 x\xE3 h\u1ED9i 6 th\xE1ng \u0111\u1EA7u n\u0103m 2026, nhi\u1EC7m v\u1EE5 tr\u1ECDng t\xE2m 6 th\xE1ng cu\u1ED1i n\u0103m", presenterId: "u-khdt", durationMinutes: 45, documentIds: ["d1", "d2"] },
        { id: "a2", order: 2, title: "T\u1EDD tr\xECnh ph\xE2n b\u1ED5 k\u1EBF ho\u1EA1ch v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EE3t 2 n\u0103m 2026", presenterId: "u-tc", durationMinutes: 30, documentIds: ["d3"] },
        { id: "a3", order: 3, title: "B\xE1o c\xE1o ti\u1EBFn \u0111\u1ED9 D\u1EF1 \xE1n \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng", presenterId: "u-gtvt", durationMinutes: 30, documentIds: ["d4"] },
        { id: "a4", order: 4, title: "Th\u1EA3o lu\u1EADn, bi\u1EC3u quy\u1EBFt th\xF4ng qua d\u1EF1 th\u1EA3o Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp", presenterId: "u-tk", durationMinutes: 15, documentIds: ["d5"] }
      ],
      currentAgendaItemId: "a2",
      // Mốc bắt đầu mục a2 (E-HSMT mục 27): 10 phút trước -> đếm ngược còn ~20 phút / 30 phút
      currentItemStartedAt: iso(minAgo(10)),
      // Phiên chất vấn đang mở để demo nghiệp vụ (E-HSMT mục 34/45/46)
      questionSession: "open",
      conclusions: [
        { id: "c1", content: "Th\xF4ng qua B\xE1o c\xE1o KT-XH 6 th\xE1ng \u0111\u1EA7u n\u0103m 2026. Giao S\u1EDF KH&\u0110T ho\xE0n thi\u1EC7n, tr\xECnh H\u0110ND t\u1EC9nh t\u1EA1i k\u1EF3 h\u1ECDp gi\u1EEFa n\u0103m. Bi\u1EC3u d\u01B0\u01A1ng k\u1EBFt qu\u1EA3 thu h\xFAt \u0111\u1EA7u t\u01B0 12.450 t\u1EF7 \u0111\u1ED3ng.", agendaItemId: "a1", createdAt: iso(minAgo(10)) }
      ],
      minutes: null,
      createdBy: "u-tk",
      createdAt: iso(minAgo(60 * 24 * 5)),
      invitedAt: iso(minAgo(60 * 24 * 4))
    },
    {
      id: "m2",
      code: "PH-2026/07-02",
      title: "H\u1ECDp chuy\xEAn \u0111\u1EC1 v\u1EC1 gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026",
      description: "R\xE0 so\xE1t ti\u1EBFn \u0111\u1ED9 gi\u1EA3i ng\xE2n c\u1EE7a c\xE1c ch\u1EE7 \u0111\u1EA7u t\u01B0; ph\u01B0\u01A1ng \xE1n \u0111i\u1EC1u chuy\u1EC3n v\u1ED1n c\xE1c d\u1EF1 \xE1n ch\u1EADm ti\u1EBFn \u0111\u1ED9.",
      meetingType: "H\u1ECDp chuy\xEAn \u0111\u1EC1",
      startTime: iso(dayAt(2, 8, 0)),
      endTime: iso(dayAt(2, 11, 30)),
      roomId: "r1",
      isOnline: true,
      status: "invited",
      chairId: "u-pct",
      secretaryId: "u-tk",
      participants: [
        { userId: "u-pct", meetingRole: "chair", attendStatus: "accepted", checkedInAt: null },
        { userId: "u-tk", meetingRole: "secretary", attendStatus: "accepted", checkedInAt: null },
        { userId: "u-ct", meetingRole: "member", attendStatus: "pending", checkedInAt: null },
        { userId: "u-khdt", meetingRole: "member", attendStatus: "accepted", checkedInAt: null },
        { userId: "u-tc", meetingRole: "member", attendStatus: "accepted", checkedInAt: null },
        { userId: "u-xd", meetingRole: "member", attendStatus: "pending", checkedInAt: null },
        { userId: "u-gtvt", meetingRole: "member", attendStatus: "pending", checkedInAt: null }
      ],
      agenda: [
        { id: "a2-1", order: 1, title: "B\xE1o c\xE1o t\u1ED5ng h\u1EE3p t\xECnh h\xECnh gi\u1EA3i ng\xE2n c\u1EE7a c\xE1c ch\u1EE7 \u0111\u1EA7u t\u01B0", presenterId: "u-khdt", durationMinutes: 40, documentIds: ["d6"] },
        { id: "a2-2", order: 2, title: "Th\u1EA3o lu\u1EADn ph\u01B0\u01A1ng \xE1n \u0111i\u1EC1u chuy\u1EC3n 120 t\u1EF7 \u0111\u1ED3ng v\u1ED1n c\xE1c d\u1EF1 \xE1n ch\u1EADm ti\u1EBFn \u0111\u1ED9", presenterId: "u-tc", durationMinutes: 50, documentIds: [] }
      ],
      currentAgendaItemId: null,
      conclusions: [],
      minutes: null,
      createdBy: "u-tk",
      createdAt: iso(minAgo(60 * 24 * 2)),
      invitedAt: iso(minAgo(60 * 22))
    },
    {
      id: "m3",
      code: "PH-2026/07-03",
      title: "H\u1ECDp Ban Ch\u1EC9 \u0111\u1EA1o chuy\u1EC3n \u0111\u1ED5i s\u1ED1 t\u1EC9nh qu\xFD III/2026",
      description: "Cho \xFD ki\u1EBFn d\u1EF1 th\u1EA3o K\u1EBF ho\u1EA1ch chuy\u1EC3n \u0111\u1ED5i s\u1ED1 giai \u0111o\u1EA1n 2026\u20132030; s\u01A1 k\u1EBFt ho\u1EA1t \u0111\u1ED9ng qu\xFD II.",
      startTime: iso(dayAt(7, 14, 0)),
      endTime: iso(dayAt(7, 16, 30)),
      roomId: "r3",
      isOnline: true,
      status: "draft",
      chairId: "u-ct",
      secretaryId: "u-tk",
      participants: [
        { userId: "u-ct", meetingRole: "chair", attendStatus: "pending", checkedInAt: null },
        { userId: "u-tk", meetingRole: "secretary", attendStatus: "pending", checkedInAt: null },
        { userId: "u-tt", meetingRole: "member", attendStatus: "pending", checkedInAt: null },
        { userId: "u-gd", meetingRole: "member", attendStatus: "pending", checkedInAt: null },
        { userId: "u-yt", meetingRole: "member", attendStatus: "pending", checkedInAt: null },
        { userId: "u-khdt", meetingRole: "member", attendStatus: "pending", checkedInAt: null }
      ],
      agenda: [
        { id: "a3-1", order: 1, title: "D\u1EF1 th\u1EA3o K\u1EBF ho\u1EA1ch chuy\u1EC3n \u0111\u1ED5i s\u1ED1 t\u1EC9nh giai \u0111o\u1EA1n 2026\u20132030", presenterId: "u-tt", durationMinutes: 60, documentIds: ["d7"] },
        { id: "a3-2", order: 2, title: "S\u01A1 k\u1EBFt ho\u1EA1t \u0111\u1ED9ng Ban Ch\u1EC9 \u0111\u1EA1o qu\xFD II/2026", presenterId: "u-tk", durationMinutes: 30, documentIds: [] }
      ],
      currentAgendaItemId: null,
      conclusions: [],
      minutes: null,
      createdBy: "u-tk",
      createdAt: iso(minAgo(60 * 10))
    },
    {
      id: "m4",
      code: "PH-2026/06-01",
      title: "Phi\xEAn h\u1ECDp th\u01B0\u1EDDng k\u1EF3 UBND t\u1EC9nh th\xE1ng 6/2026",
      description: "\u0110\xE1nh gi\xE1 t\xECnh h\xECnh KT-XH th\xE1ng 6; chu\u1EA9n b\u1ECB k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh gi\u1EEFa n\u0103m 2026.",
      startTime: iso(dayAt(-18, 8, 0)),
      endTime: iso(dayAt(-18, 11, 30)),
      roomId: "r1",
      isOnline: false,
      status: "finished",
      documentNumber: "S\u1ED1: 06/BB-UBND",
      documentLocation: "\u2026\u2026\u2026",
      chairId: "u-ct",
      secretaryId: "u-tk",
      participants: [
        { userId: "u-ct", meetingRole: "chair", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 45)), seat: "Ch\u1EE7 t\u1ECDa" },
        { userId: "u-tk", meetingRole: "secretary", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 40)), seat: "B\xE0n th\u01B0 k\xFD" },
        { userId: "u-pct", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 50)), seat: "A1" },
        { userId: "u-khdt", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 52)), seat: "A2" },
        { userId: "u-tc", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 55)), seat: "A3" },
        { userId: "u-tnmt", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 58)), seat: "B1" },
        { userId: "u-gtvt", meetingRole: "member", attendStatus: "declined", declineReason: "Tham gia \u0111o\xE0n c\xF4ng t\xE1c c\u1EE7a B\u1ED9 GTVT", checkedInAt: null, seat: "B2" },
        { userId: "u-yt", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 8, 2)), seat: "B3" },
        { userId: "u-gd", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 57)), seat: "B4" },
        { userId: "u-tt", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-18, 7, 59)), seat: "B5" }
      ],
      agenda: [
        { id: "a4-1", order: 1, title: "B\xE1o c\xE1o t\xECnh h\xECnh KT-XH th\xE1ng 6, nhi\u1EC7m v\u1EE5 th\xE1ng 7/2026", presenterId: "u-khdt", durationMinutes: 40, documentIds: ["d8"] },
        { id: "a4-2", order: 2, title: "C\xF4ng t\xE1c chu\u1EA9n b\u1ECB k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh gi\u1EEFa n\u0103m 2026", presenterId: "u-tk", durationMinutes: 30, documentIds: [] },
        { id: "a4-3", order: 3, title: "Th\xF4ng qua Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp", presenterId: "u-tk", durationMinutes: 15, documentIds: ["d9"] }
      ],
      currentAgendaItemId: null,
      conclusions: [
        { id: "c4-1", content: "Th\xF4ng qua B\xE1o c\xE1o KT-XH th\xE1ng 6/2026. Y\xEAu c\u1EA7u c\xE1c s\u1EDF, ng\xE0nh ho\xE0n th\xE0nh b\xE1o c\xE1o s\u01A1 k\u1EBFt 6 th\xE1ng tr\u01B0\u1EDBc ng\xE0y 05/7/2026.", agendaItemId: "a4-1", createdAt: iso(dayAt(-18, 9, 30)) },
        { id: "c4-2", content: "Giao V\u0103n ph\xF2ng UBND t\u1EC9nh ph\u1ED1i h\u1EE3p V\u0103n ph\xF2ng H\u0110ND t\u1EC9nh chu\u1EA9n b\u1ECB chu \u0111\xE1o n\u1ED9i dung, t\xE0i li\u1EC7u k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh gi\u1EEFa n\u0103m.", agendaItemId: "a4-2", createdAt: iso(dayAt(-18, 10, 15)) },
        { id: "c4-3", content: "Th\u1ED1ng nh\u1EA5t th\xF4ng qua Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp v\u1EDBi 9/9 th\xE0nh vi\xEAn d\u1EF1 h\u1ECDp t\xE1n th\xE0nh.", agendaItemId: "a4-3", createdAt: iso(dayAt(-18, 11, 10)) }
      ],
      minutes: {
        content: `BI\xCAN B\u1EA2N PHI\xCAN H\u1ECCP TH\u01AF\u1EDCNG K\u1EF2 UBND T\u1EC8NH TH\xC1NG 6/2026

Th\u1EDDi gian: 08h00 \u2013 11h30
\u0110\u1ECBa \u0111i\u1EC3m: Ph\xF2ng h\u1ECDp s\u1ED1 1, Tr\u1EE5 s\u1EDF UBND t\u1EC9nh
Ch\u1EE7 tr\xEC: \u0110/c Tr\u1EA7n \u0110\u1EA1i Ngh\u0129a \u2014 Ch\u1EE7 t\u1ECBch UBND t\u1EC9nh
Th\u01B0 k\xFD: \u0110/c Ph\u1EA1m V\u0103n Th\u01B0 \u2014 Ch\xE1nh V\u0103n ph\xF2ng UBND t\u1EC9nh
Th\xE0nh ph\u1EA7n: 09/10 th\xE0nh vi\xEAn d\u1EF1 h\u1ECDp (v\u1EAFng: \u0110/c B\xF9i \u0110\u1EE9c Long \u2014 c\xF3 l\xFD do)

I. N\u1ED8I DUNG
1. S\u1EDF KH&\u0110T b\xE1o c\xE1o t\xECnh h\xECnh KT-XH th\xE1ng 6: IIP t\u0103ng 11,2%; t\u1ED5ng m\u1EE9c b\xE1n l\u1EBB t\u0103ng 10,5%.
2. V\u0103n ph\xF2ng UBND t\u1EC9nh b\xE1o c\xE1o c\xF4ng t\xE1c chu\u1EA9n b\u1ECB k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh gi\u1EEFa n\u0103m 2026.
3. Phi\xEAn h\u1ECDp \u0111\xE3 bi\u1EC3u quy\u1EBFt th\xF4ng qua Ngh\u1ECB quy\u1EBFt v\u1EDBi 9/9 th\xE0nh vi\xEAn d\u1EF1 h\u1ECDp t\xE1n th\xE0nh.

II. K\u1EBET LU\u1EACN C\u1EE6A CH\u1EE6 T\u1ECCA
(1) Th\xF4ng qua B\xE1o c\xE1o KT-XH th\xE1ng 6/2026; c\xE1c s\u1EDF, ng\xE0nh ho\xE0n th\xE0nh b\xE1o c\xE1o s\u01A1 k\u1EBFt 6 th\xE1ng tr\u01B0\u1EDBc 05/7/2026.
(2) Giao V\u0103n ph\xF2ng UBND t\u1EC9nh chu\u1EA9n b\u1ECB n\u1ED9i dung k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh.
(3) Th\xF4ng qua Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp.

Bi\xEAn b\u1EA3n \u0111\u01B0\u1EE3c l\u1EADp v\xE0 k\xFD s\u1ED1 tr\xEAn H\u1EC7 th\u1ED1ng ph\xF2ng h\u1ECDp kh\xF4ng gi\u1EA5y eCabinet.`,
        updatedAt: iso(dayAt(-18, 11, 25)),
        signatures: [
          { signerId: "u-tk", signerName: "Ph\u1EA1m V\u0103n Th\u01B0", signerTitle: "Ch\xE1nh V\u0103n ph\xF2ng UBND t\u1EC9nh \u2014 Th\u01B0 k\xFD", signedAt: iso(dayAt(-18, 11, 26)), serial: "VN-DEMO-CA:5401:2f8e19", hash: "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7" },
          { signerId: "u-ct", signerName: "Tr\u1EA7n \u0110\u1EA1i Ngh\u0129a", signerTitle: "Ch\u1EE7 t\u1ECBch UBND t\u1EC9nh \u2014 Ch\u1EE7 tr\xEC", signedAt: iso(dayAt(-18, 11, 28)), serial: "VN-DEMO-CA:5402:8ac310", hash: "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7" }
        ],
        locked: true
      },
      createdBy: "u-tk",
      createdAt: iso(dayAt(-25, 9, 0)),
      invitedAt: iso(dayAt(-22, 9, 0))
    },
    {
      id: "m5",
      code: "GB-2026/06-02",
      title: "H\u1ECDp giao ban c\xF4ng t\xE1c c\u1EA3i c\xE1ch h\xE0nh ch\xEDnh",
      description: "\u0110\xE1nh gi\xE1 k\u1EBFt qu\u1EA3 Ch\u1EC9 s\u1ED1 PAR INDEX; gi\u1EA3i ph\xE1p n\xE2ng cao t\u1EF7 l\u1EC7 h\u1ED3 s\u01A1 tr\u1EF1c tuy\u1EBFn to\xE0n tr\xECnh.",
      startTime: iso(dayAt(-35, 14, 0)),
      endTime: iso(dayAt(-35, 16, 0)),
      roomId: "r3",
      isOnline: true,
      status: "finished",
      chairId: "u-pct",
      secretaryId: "u-tk",
      participants: [
        { userId: "u-pct", meetingRole: "chair", attendStatus: "accepted", checkedInAt: iso(dayAt(-35, 13, 50)) },
        { userId: "u-tk", meetingRole: "secretary", attendStatus: "accepted", checkedInAt: iso(dayAt(-35, 13, 48)) },
        { userId: "u-tt", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-35, 13, 55)) },
        { userId: "u-gd", meetingRole: "member", attendStatus: "accepted", checkedInAt: iso(dayAt(-35, 13, 57)) }
      ],
      agenda: [
        { id: "a5-1", order: 1, title: "K\u1EBFt qu\u1EA3 Ch\u1EC9 s\u1ED1 c\u1EA3i c\xE1ch h\xE0nh ch\xEDnh n\u0103m 2025 v\xE0 gi\u1EA3i ph\xE1p", presenterId: "u-tt", durationMinutes: 45, documentIds: [] }
      ],
      currentAgendaItemId: null,
      conclusions: [
        { id: "c5-1", content: "C\xE1c s\u1EDF, ng\xE0nh x\xE2y d\u1EF1ng k\u1EBF ho\u1EA1ch kh\u1EAFc ph\u1EE5c c\xE1c ti\xEAu ch\xED th\xE0nh ph\u1EA7n \u0111\u1EA1t th\u1EA5p; ho\xE0n th\xE0nh tr\u01B0\u1EDBc 30/7/2026.", agendaItemId: "a5-1", createdAt: iso(dayAt(-35, 15, 40)) }
      ],
      minutes: {
        content: "BI\xCAN B\u1EA2N H\u1ECCP GIAO BAN C\xD4NG T\xC1C C\u1EA2I C\xC1CH H\xC0NH CH\xCDNH\n\nH\u1ED9i ngh\u1ECB th\u1ED1ng nh\u1EA5t c\xE1c gi\u1EA3i ph\xE1p n\xE2ng cao Ch\u1EC9 s\u1ED1 PAR INDEX; giao S\u1EDF TT&TT theo d\xF5i, \u0111\xF4n \u0111\u1ED1c.",
        updatedAt: iso(dayAt(-35, 16, 5)),
        signatures: [],
        locked: false
      },
      createdBy: "u-tk",
      createdAt: iso(dayAt(-40, 9, 0)),
      invitedAt: iso(dayAt(-38, 9, 0))
    }
  ];
  const OPT3 = [
    { id: "o1", label: "\u0110\u1ED3ng \xFD" },
    { id: "o2", label: "Kh\xF4ng \u0111\u1ED3ng \xFD" },
    { id: "o3", label: "\xDD ki\u1EBFn kh\xE1c" }
  ];
  const OPT_POLL = [
    { id: "p1", label: "Nh\u1EA5t tr\xED" },
    { id: "p2", label: "Nh\u1EA5t tr\xED, c\xF3 ch\u1EC9nh s\u1EEDa b\u1ED5 sung" },
    { id: "p3", label: "Kh\xF4ng nh\u1EA5t tr\xED" }
  ];
  const memberIds = ["u-ct", "u-pct", "u-khdt", "u-tc", "u-tnmt", "u-gtvt", "u-yt", "u-gd", "u-tt", "u-pxd"];
  const votes = [
    {
      id: "v1",
      kind: "vote",
      meetingId: "m1",
      agendaItemId: "a1",
      title: "Th\xF4ng qua B\xE1o c\xE1o t\xECnh h\xECnh KT-XH 6 th\xE1ng \u0111\u1EA7u n\u0103m 2026",
      description: "Bi\u1EC3u quy\u1EBFt th\xF4ng qua n\u1ED9i dung B\xE1o c\xE1o do S\u1EDF KH&\u0110T tr\xECnh b\xE0y.",
      options: OPT3,
      secret: false,
      status: "closed",
      documentIds: ["d1"],
      passThreshold: "majority",
      approveOptionId: "o1",
      abstainOptionId: "o3",
      eligibleIds: memberIds,
      ballots: [
        { userId: "u-ct", optionId: "o1", castAt: iso(minAgo(18)) },
        { userId: "u-pct", optionId: "o1", castAt: iso(minAgo(18)) },
        { userId: "u-khdt", optionId: "o1", castAt: iso(minAgo(17)) },
        { userId: "u-tc", optionId: "o1", castAt: iso(minAgo(17)) },
        { userId: "u-tnmt", optionId: "o1", castAt: iso(minAgo(17)) },
        { userId: "u-gtvt", optionId: "o1", castAt: iso(minAgo(16)) },
        { userId: "u-gd", optionId: "o3", comment: "\u0110\u1EC1 ngh\u1ECB b\u1ED5 sung s\u1ED1 li\u1EC7u v\u1EC1 gi\xE1o d\u1EE5c ngh\u1EC1 nghi\u1EC7p.", castAt: iso(minAgo(16)) },
        { userId: "u-tt", optionId: "o1", castAt: iso(minAgo(15)) },
        { userId: "u-pxd", optionId: "o1", castAt: iso(minAgo(15)) }
      ],
      createdBy: "u-tk",
      createdAt: iso(minAgo(60 * 24)),
      openedAt: iso(minAgo(19)),
      closedAt: iso(minAgo(13))
    },
    {
      id: "v2",
      kind: "vote",
      meetingId: "m1",
      agendaItemId: "a2",
      title: "Th\xF4ng qua ch\u1EE7 tr\u01B0\u01A1ng ph\xE2n b\u1ED5 850 t\u1EF7 \u0111\u1ED3ng v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EE3t 2 n\u0103m 2026",
      description: "Theo ph\u01B0\u01A1ng \xE1n t\u1EA1i T\u1EDD tr\xECnh c\u1EE7a S\u1EDF T\xE0i ch\xEDnh.",
      options: OPT3,
      secret: false,
      status: "open",
      documentIds: ["d3"],
      passThreshold: "majority",
      approveOptionId: "o1",
      abstainOptionId: "o3",
      eligibleIds: memberIds,
      ballots: [
        { userId: "u-pct", optionId: "o1", castAt: iso(minAgo(2)) },
        { userId: "u-khdt", optionId: "o1", castAt: iso(minAgo(2)) },
        { userId: "u-tc", optionId: "o1", castAt: iso(minAgo(1)) },
        { userId: "u-tnmt", optionId: "o3", comment: "\u0110\u1EC1 ngh\u1ECB t\u0103ng v\u1ED1n cho x\u1EED l\xFD r\xE1c th\u1EA3i sinh ho\u1EA1t.", castAt: iso(minAgo(1)) }
      ],
      createdBy: "u-tk",
      createdAt: iso(minAgo(60 * 24)),
      openedAt: iso(minAgo(3))
    },
    {
      id: "v3",
      kind: "vote",
      meetingId: "m1",
      agendaItemId: "a4",
      title: "Th\xF4ng qua d\u1EF1 th\u1EA3o Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp th\u01B0\u1EDDng k\u1EF3 th\xE1ng 7/2026",
      description: "Bi\u1EC3u quy\u1EBFt th\xF4ng qua to\xE0n v\u0103n d\u1EF1 th\u1EA3o Ngh\u1ECB quy\u1EBFt.",
      options: OPT3,
      secret: false,
      status: "pending",
      documentIds: ["d5"],
      passThreshold: "majority",
      approveOptionId: "o1",
      abstainOptionId: "o3",
      eligibleIds: memberIds,
      ballots: [],
      createdBy: "u-tk",
      createdAt: iso(minAgo(60 * 24))
    },
    {
      id: "v4",
      kind: "vote",
      meetingId: "m4",
      agendaItemId: "a4-3",
      title: "Th\xF4ng qua Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp th\u01B0\u1EDDng k\u1EF3 th\xE1ng 6/2026",
      options: OPT3,
      secret: false,
      status: "closed",
      documentIds: ["d9"],
      passThreshold: "majority",
      approveOptionId: "o1",
      abstainOptionId: "o3",
      eligibleIds: memberIds.filter((x) => x !== "u-gtvt" && x !== "u-pxd"),
      ballots: ["u-ct", "u-pct", "u-khdt", "u-tc", "u-tnmt", "u-yt", "u-gd", "u-tt"].map((uidX, i) => ({ userId: uidX, optionId: "o1", castAt: iso(dayAt(-18, 11, i)) })),
      createdBy: "u-tk",
      createdAt: iso(dayAt(-19, 9, 0)),
      openedAt: iso(dayAt(-18, 11, 0)),
      closedAt: iso(dayAt(-18, 11, 9))
    },
    {
      id: "p-cds",
      kind: "poll",
      meetingId: null,
      agendaItemId: null,
      title: "L\u1EA5y \xFD ki\u1EBFn d\u1EF1 th\u1EA3o K\u1EBF ho\u1EA1ch chuy\u1EC3n \u0111\u1ED5i s\u1ED1 t\u1EC9nh giai \u0111o\u1EA1n 2026\u20132030",
      description: "\u0110\u1EC1 ngh\u1ECB c\xE1c \u0111\u1ED3ng ch\xED th\xE0nh vi\xEAn UBND t\u1EC9nh nghi\xEAn c\u1EE9u, cho \xFD ki\u1EBFn tr\u01B0\u1EDBc khi tr\xECnh phi\xEAn h\u1ECDp Ban Ch\u1EC9 \u0111\u1EA1o.",
      options: OPT_POLL,
      secret: false,
      status: "open",
      deadline: iso(dayAt(3, 17, 0)),
      documentIds: ["d7"],
      passThreshold: "majority",
      approveOptionId: "p1",
      eligibleIds: memberIds.filter((x) => x !== "u-pxd"),
      ballots: [
        { userId: "u-tt", optionId: "p1", comment: "C\u01A1 quan so\u1EA1n th\u1EA3o \u0111\xE3 ti\u1EBFp thu \xFD ki\u1EBFn c\xE1c ng\xE0nh.", castAt: iso(minAgo(60 * 20)) },
        { userId: "u-khdt", optionId: "p2", comment: "B\u1ED5 sung danh m\u1EE5c d\u1EF1 \xE1n \u01B0u ti\xEAn k\xE8m kh\xE1i to\xE1n v\u1ED1n.", castAt: iso(minAgo(60 * 15)) },
        { userId: "u-gd", optionId: "p1", castAt: iso(minAgo(60 * 12)) },
        { userId: "u-yt", optionId: "p2", comment: "L\xE0m r\xF5 l\u1ED9 tr\xECnh b\u1EC7nh \xE1n \u0111i\u1EC7n t\u1EED t\u1EA1i c\xE1c b\u1EC7nh vi\u1EC7n tuy\u1EBFn huy\u1EC7n.", castAt: iso(minAgo(60 * 8)) },
        { userId: "u-tc", optionId: "p1", castAt: iso(minAgo(60 * 5)) }
      ],
      createdBy: "u-tk",
      createdAt: iso(minAgo(60 * 26)),
      openedAt: iso(minAgo(60 * 26))
    },
    {
      id: "p-tsc",
      kind: "poll",
      meetingId: null,
      agendaItemId: null,
      title: "L\u1EA5y \xFD ki\u1EBFn d\u1EF1 th\u1EA3o Quy ch\u1EBF qu\u1EA3n l\xFD, s\u1EED d\u1EE5ng t\xE0i s\u1EA3n c\xF4ng",
      description: "Xin \xFD ki\u1EBFn tr\u01B0\u1EDBc khi ban h\xE0nh Quy\u1EBFt \u0111\u1ECBnh c\u1EE7a UBND t\u1EC9nh.",
      options: OPT_POLL,
      secret: false,
      status: "closed",
      deadline: iso(dayAt(-5, 17, 0)),
      documentIds: ["d10"],
      passThreshold: "majority",
      approveOptionId: "p1",
      eligibleIds: memberIds.filter((x) => x !== "u-pxd"),
      ballots: [
        { userId: "u-ct", optionId: "p1", castAt: iso(dayAt(-7, 9, 0)) },
        { userId: "u-pct", optionId: "p1", castAt: iso(dayAt(-7, 10, 0)) },
        { userId: "u-khdt", optionId: "p1", castAt: iso(dayAt(-6, 14, 0)) },
        { userId: "u-tc", optionId: "p1", castAt: iso(dayAt(-6, 15, 0)) },
        { userId: "u-tnmt", optionId: "p2", comment: "B\u1ED5 sung \u0111\u1ECBnh m\u1EE9c thi\u1EBFt b\u1ECB quan tr\u1EAFc m\xF4i tr\u01B0\u1EDDng.", castAt: iso(dayAt(-6, 16, 0)) },
        { userId: "u-gtvt", optionId: "p1", castAt: iso(dayAt(-5, 9, 0)) },
        { userId: "u-yt", optionId: "p1", castAt: iso(dayAt(-5, 10, 0)) },
        { userId: "u-gd", optionId: "p1", castAt: iso(dayAt(-5, 11, 0)) },
        { userId: "u-tt", optionId: "p1", castAt: iso(dayAt(-5, 14, 0)) }
      ],
      createdBy: "u-tc",
      createdAt: iso(dayAt(-12, 9, 0)),
      openedAt: iso(dayAt(-12, 9, 0)),
      closedAt: iso(dayAt(-5, 17, 0))
    }
  ];
  const speakRequests = [
    { id: "sr0", meetingId: "m1", userId: "u-khdt", topic: "Tr\xECnh b\xE0y B\xE1o c\xE1o KT-XH", status: "done", requestedAt: iso(minAgo(28)), startedAt: iso(minAgo(27)), endedAt: iso(minAgo(14)) },
    { id: "sr1", meetingId: "m1", userId: "u-tc", topic: "Gi\u1EA3i tr\xECnh c\u01A1 c\u1EA5u ngu\u1ED3n v\u1ED1n \u0111\u1EE3t 2", status: "speaking", requestedAt: iso(minAgo(6)), startedAt: iso(minAgo(3)) },
    { id: "sr2", meetingId: "m1", userId: "u-tnmt", topic: "Ki\u1EBFn ngh\u1ECB b\u1ED5 sung v\u1ED1n x\u1EED l\xFD r\xE1c th\u1EA3i", status: "waiting", requestedAt: iso(minAgo(4)) },
    { id: "sr3", meetingId: "m1", userId: "u-gtvt", topic: "Ti\u1EBFn \u0111\u1ED9 GPMB \u0111\u01B0\u1EDDng v\xE0nh \u0111ai", status: "waiting", requestedAt: iso(minAgo(2)) }
  ];
  const questions = [
    // 1 lượt đã chất vấn xong (đã gọi)
    { id: "q0", meetingId: "m1", userId: "u-tnmt", targetName: "S\u1EDF Giao th\xF4ng v\u1EADn t\u1EA3i", topic: "Tr\xE1ch nhi\u1EC7m ch\u1EADm gi\u1EA3i ph\xF3ng m\u1EB7t b\u1EB1ng \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng", content: "\u0110\u1EC1 ngh\u1ECB S\u1EDF GTVT l\xE0m r\xF5 nguy\xEAn nh\xE2n ch\u1EADm GPMB v\xE0 cam k\u1EBFt m\u1ED1c ho\xE0n th\xE0nh c\u1EE5 th\u1EC3.", status: "done", order: 1, createdAt: iso(minAgo(20)), calledAt: iso(minAgo(18)), endedAt: iso(minAgo(12)) },
    // 1 lượt đang chờ gọi (chưa gọi)
    { id: "q1", meetingId: "m1", userId: "u-yt", targetName: "S\u1EDF T\xE0i ch\xEDnh", topic: "B\u1ED1 tr\xED v\u1ED1n cho y t\u1EBF c\u01A1 s\u1EDF trong ph\u01B0\u01A1ng \xE1n ph\xE2n b\u1ED5 \u0111\u1EE3t 2", content: "V\xEC sao t\u1EF7 tr\u1ECDng v\u1ED1n cho y t\u1EBF tuy\u1EBFn huy\u1EC7n c\xF2n th\u1EA5p so v\u1EDBi nhu c\u1EA7u th\u1EF1c t\u1EBF?", status: "pending", order: 2, createdAt: iso(minAgo(5)) },
    // 1 lượt đang chờ gọi thứ hai
    { id: "q2", meetingId: "m1", userId: "u-gd", targetName: "S\u1EDF K\u1EBF ho\u1EA1ch v\xE0 \u0110\u1EA7u t\u01B0", topic: "Ti\u1EBFn \u0111\u1ED9 gi\u1EA3i ng\xE2n v\u1ED1n cho c\xE1c d\u1EF1 \xE1n tr\u01B0\u1EDDng h\u1ECDc", status: "pending", order: 3, createdAt: iso(minAgo(3)) }
  ];
  const messages = [
    { id: "msg1", meetingId: "m1", fromId: "u-tk", toId: null, content: "K\xEDnh g\u1EEDi c\xE1c \u0111\u1EA1i bi\u1EC3u: t\xE0i li\u1EC7u m\u1EE5c 2 (T\u1EDD tr\xECnh ph\xE2n b\u1ED5 v\u1ED1n) \u0111\xE3 \u0111\u01B0\u1EE3c c\u1EADp nh\u1EADt phi\xEAn b\u1EA3n m\u1EDBi.", sentAt: iso(minAgo(12)) },
    { id: "msg2", meetingId: "m1", fromId: "u-khdt", toId: null, content: "\u0110\u1EC1 ngh\u1ECB S\u1EDF T\xE0i ch\xEDnh l\xE0m r\xF5 th\xEAm c\u01A1 c\u1EA5u ngu\u1ED3n v\u1ED1n \u0111\u1ED1i \u1EE9ng c\u1EE7a c\xE1c d\u1EF1 \xE1n y t\u1EBF.", sentAt: iso(minAgo(9)) },
    { id: "msg3", meetingId: "m1", fromId: "u-tc", toId: null, content: "T\xF4i s\u1EBD gi\u1EA3i tr\xECnh n\u1ED9i dung n\xE0y trong ph\u1EA7n ph\xE1t bi\u1EC3u ti\u1EBFp theo.", sentAt: iso(minAgo(8)) },
    { id: "msg4", meetingId: "m1", fromId: "u-ct", toId: "u-tk", content: "\u0110\u1ED3ng ch\xED chu\u1EA9n b\u1ECB d\u1EF1 th\u1EA3o k\u1EBFt lu\u1EADn m\u1EE5c 2 theo h\u01B0\u1EDBng th\u1ED1ng nh\u1EA5t ph\u01B0\u01A1ng \xE1n, l\u01B0u \xFD ki\u1EBFn ngh\u1ECB c\u1EE7a S\u1EDF TN&MT.", sentAt: iso(minAgo(5)) },
    { id: "msg5", meetingId: "m1", fromId: "u-tk", toId: "u-ct", content: "D\u1EA1 v\xE2ng, em \u0111\xE3 d\u1EF1 th\u1EA3o v\xE0 chia s\u1EBB v\xE0o t\xE0i li\u1EC7u c\xE1 nh\xE2n c\u1EE7a \u0111\u1ED3ng ch\xED.", sentAt: iso(minAgo(4)) }
  ];
  const tasks = [
    { id: "t1", meetingId: "m4", title: "Ho\xE0n thi\u1EC7n b\xE1o c\xE1o s\u01A1 k\u1EBFt 6 th\xE1ng c\u1EE7a c\xE1c s\u1EDF, ng\xE0nh", description: "Theo K\u1EBFt lu\u1EADn s\u1ED1 1 phi\xEAn h\u1ECDp th\xE1ng 6/2026.", assigneeId: "u-khdt", deadline: iso(dayAt(-9, 17, 0)), status: "done", progress: 100, createdAt: iso(dayAt(-18, 12, 0)), updatedAt: iso(dayAt(-10, 9, 0)) },
    { id: "t2", meetingId: "m4", title: "Chu\u1EA9n b\u1ECB n\u1ED9i dung, t\xE0i li\u1EC7u k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh gi\u1EEFa n\u0103m", description: "Ph\u1ED1i h\u1EE3p V\u0103n ph\xF2ng H\u0110ND t\u1EC9nh; ho\xE0n th\xE0nh tr\u01B0\u1EDBc khai m\u1EA1c 07 ng\xE0y.", assigneeId: "u-tk", deadline: iso(dayAt(6, 17, 0)), status: "doing", progress: 70, createdAt: iso(dayAt(-18, 12, 0)), updatedAt: iso(minAgo(60 * 30)) },
    { id: "t3", meetingId: "m1", title: "Ho\xE0n th\xE0nh GPMB D\u1EF1 \xE1n \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng", description: "B\xE0n giao 100% m\u1EB7t b\u1EB1ng tr\u01B0\u1EDBc 15/8/2026 theo k\u1EBFt lu\u1EADn ch\u1EE7 t\u1ECDa.", assigneeId: "u-tnmt", deadline: iso(dayAt(32, 17, 0)), status: "doing", progress: 35, createdAt: iso(minAgo(9)), updatedAt: iso(minAgo(9)) },
    { id: "t4", meetingId: "m5", title: "K\u1EBF ho\u1EA1ch kh\u1EAFc ph\u1EE5c ti\xEAu ch\xED PAR INDEX \u0111\u1EA1t th\u1EA5p", description: "C\xE1c s\u1EDF, ng\xE0nh g\u1EEDi k\u1EBF ho\u1EA1ch v\u1EC1 S\u1EDF TT&TT t\u1ED5ng h\u1EE3p.", assigneeId: "u-tt", deadline: iso(dayAt(16, 17, 0)), status: "open", progress: 0, createdAt: iso(dayAt(-35, 16, 0)), updatedAt: iso(dayAt(-35, 16, 0)) },
    { id: "t5", meetingId: null, title: "D\u1EF1 th\u1EA3o Ch\u1EC9 th\u1ECB v\u1EC1 k\u1EF7 lu\u1EADt, k\u1EF7 c\u01B0\u01A1ng h\xE0nh ch\xEDnh", description: "Theo ch\u1EC9 \u0111\u1EA1o c\u1EE7a Ch\u1EE7 t\u1ECBch UBND t\u1EC9nh.", assigneeId: "u-tk", deadline: iso(dayAt(10, 17, 0)), status: "open", progress: 10, createdAt: iso(minAgo(60 * 24)), updatedAt: iso(minAgo(60 * 24)) }
  ];
  const notifications = [
    { id: "n1", userId: "u-ct", title: "Gi\u1EA5y m\u1EDDi h\u1ECDp", body: 'B\u1EA1n \u0111\u01B0\u1EE3c m\u1EDDi d\u1EF1 "H\u1ECDp chuy\xEAn \u0111\u1EC1 v\u1EC1 gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026". Vui l\xF2ng x\xE1c nh\u1EADn tham d\u1EF1.', type: "meeting", read: false, createdAt: iso(minAgo(60 * 22)), link: "#/meetings/m2" },
    { id: "n2", userId: "u-ct", title: "Bi\u1EC3u quy\u1EBFt \u0111ang m\u1EDF", body: 'Bi\u1EC3u quy\u1EBFt "Th\xF4ng qua ch\u1EE7 tr\u01B0\u01A1ng ph\xE2n b\u1ED5 850 t\u1EF7 \u0111\u1ED3ng..." \u0111ang ch\u1EDD \xFD ki\u1EBFn c\u1EE7a b\u1EA1n.', type: "vote", read: false, createdAt: iso(minAgo(3)), link: "#/meetings/m1/live" },
    { id: "n3", userId: "u-ct", title: "Phi\u1EBFu l\u1EA5y \xFD ki\u1EBFn", body: "\u0110\u1EC1 ngh\u1ECB cho \xFD ki\u1EBFn d\u1EF1 th\u1EA3o K\u1EBF ho\u1EA1ch chuy\u1EC3n \u0111\u1ED5i s\u1ED1 2026\u20132030 tr\u01B0\u1EDBc 17h00 " + dayAt(3, 17).toLocaleDateString("vi-VN") + ".", type: "poll", read: false, createdAt: iso(minAgo(60 * 26)), link: "#/polls" },
    { id: "n4", userId: "u-ct", title: "T\xE0i li\u1EC7u \u0111\u01B0\u1EE3c chia s\u1EBB", body: "\u0110/c Ph\u1EA1m V\u0103n Th\u01B0 \u0111\xE3 chia s\u1EBB d\u1EF1 th\u1EA3o k\u1EBFt lu\u1EADn v\xE0o t\xE0i li\u1EC7u c\xE1 nh\xE2n c\u1EE7a b\u1EA1n.", type: "doc", read: true, createdAt: iso(minAgo(4)), link: "#/documents" },
    { id: "n5", userId: "u-tk", title: "Nhi\u1EC7m v\u1EE5 s\u1EAFp \u0111\u1EBFn h\u1EA1n", body: 'Nhi\u1EC7m v\u1EE5 "Chu\u1EA9n b\u1ECB n\u1ED9i dung, t\xE0i li\u1EC7u k\u1EF3 h\u1ECDp H\u0110ND t\u1EC9nh gi\u1EEFa n\u0103m" \u0111\u1EBFn h\u1EA1n trong 6 ng\xE0y.', type: "task", read: false, createdAt: iso(minAgo(60 * 5)), link: "#/tasks" },
    { id: "n6", userId: "u-khdt", title: "Gi\u1EA5y m\u1EDDi h\u1ECDp", body: 'B\u1EA1n \u0111\u01B0\u1EE3c m\u1EDDi d\u1EF1 "H\u1ECDp chuy\xEAn \u0111\u1EC1 v\u1EC1 gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026".', type: "meeting", read: true, createdAt: iso(minAgo(60 * 22)), link: "#/meetings/m2" },
    { id: "n7", userId: "u-tnmt", title: "Nhi\u1EC7m v\u1EE5 m\u1EDBi", body: 'B\u1EA1n \u0111\u01B0\u1EE3c giao nhi\u1EC7m v\u1EE5 "Ho\xE0n th\xE0nh GPMB D\u1EF1 \xE1n \u0111\u01B0\u1EDDng v\xE0nh \u0111ai ph\xEDa \u0110\xF4ng" \u2014 h\u1EA1n 15/8/2026.', type: "task", read: false, createdAt: iso(minAgo(9)), link: "#/tasks" }
  ];
  const audit = [
    { id: "au1", userId: "u-tk", userName: "Ph\u1EA1m V\u0103n Th\u01B0", action: "T\u1EA1o phi\xEAn h\u1ECDp", detail: 'T\u1EA1o phi\xEAn h\u1ECDp "H\u1ECDp chuy\xEAn \u0111\u1EC1 v\u1EC1 gi\u1EA3i ng\xE2n v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng n\u0103m 2026" (PH-2026/07-02)', at: iso(minAgo(60 * 24 * 2)) },
    { id: "au2", userId: "u-tk", userName: "Ph\u1EA1m V\u0103n Th\u01B0", action: "G\u1EEDi gi\u1EA5y m\u1EDDi", detail: "G\u1EEDi gi\u1EA5y m\u1EDDi phi\xEAn h\u1ECDp PH-2026/07-02 \u0111\u1EBFn 7 \u0111\u1EA1i bi\u1EC3u (email + SMS)", at: iso(minAgo(60 * 22)) },
    { id: "au3", userId: "u-tk", userName: "Ph\u1EA1m V\u0103n Th\u01B0", action: "C\u1EADp nh\u1EADt t\xE0i li\u1EC7u", detail: 'C\u1EADp nh\u1EADt phi\xEAn b\u1EA3n 2 t\xE0i li\u1EC7u "D\u1EF1 th\u1EA3o Ngh\u1ECB quy\u1EBFt phi\xEAn h\u1ECDp th\xE1ng 7.pdf"', at: iso(minAgo(60 * 3)) },
    { id: "au4", userId: "u-ct", userName: "Tr\u1EA7n \u0110\u1EA1i Ngh\u0129a", action: "B\u1EAFt \u0111\u1EA7u phi\xEAn h\u1ECDp", detail: "Khai m\u1EA1c phi\xEAn h\u1ECDp th\u01B0\u1EDDng k\u1EF3 UBND t\u1EC9nh th\xE1ng 7/2026", at: iso(minAgo(30)) },
    { id: "au5", userId: "u-tk", userName: "Ph\u1EA1m V\u0103n Th\u01B0", action: "M\u1EDF bi\u1EC3u quy\u1EBFt", detail: 'M\u1EDF bi\u1EC3u quy\u1EBFt "Th\xF4ng qua ch\u1EE7 tr\u01B0\u01A1ng ph\xE2n b\u1ED5 850 t\u1EF7 \u0111\u1ED3ng v\u1ED1n \u0111\u1EA7u t\u01B0 c\xF4ng \u0111\u1EE3t 2"', at: iso(minAgo(3)) },
    { id: "au6", userId: "u-ct", userName: "Tr\u1EA7n \u0110\u1EA1i Ngh\u0129a", action: "K\xFD s\u1ED1 bi\xEAn b\u1EA3n", detail: "K\xFD s\u1ED1 bi\xEAn b\u1EA3n phi\xEAn h\u1ECDp th\xE1ng 6/2026 (serial VN-DEMO-CA:5402)", at: iso(dayAt(-18, 11, 28)) },
    { id: "au7", userId: "u-admin", userName: "\u0110\u1ED7 Quang Tr\u1ECB", action: "\u0110\u0103ng nh\u1EADp", detail: "\u0110\u0103ng nh\u1EADp h\u1EC7 th\u1ED1ng t\u1EEB \u0111\u1ECBa ch\u1EC9 10.0.12.5", at: iso(minAgo(60 * 2)) }
  ];
  const cat = (id, type, name, order, description = "") => ({
    id,
    type,
    name,
    order,
    active: true,
    description,
    createdAt: iso(minAgo(60 * 24 * 20))
  });
  const catalogs = [
    // Chức vụ (mục 6)
    cat("cat-pos-1", "position", "Ch\u1EE7 t\u1ECBch", 1),
    cat("cat-pos-2", "position", "Ph\xF3 Ch\u1EE7 t\u1ECBch", 2),
    cat("cat-pos-3", "position", "Ch\xE1nh V\u0103n ph\xF2ng", 3),
    cat("cat-pos-4", "position", "Gi\xE1m \u0111\u1ED1c S\u1EDF", 4),
    cat("cat-pos-5", "position", "Chuy\xEAn vi\xEAn", 5),
    // Loại phiên họp (mục 7)
    cat("cat-mt-1", "meetingType", "H\u1ECDp th\u01B0\u1EDDng k\u1EF3", 1),
    cat("cat-mt-2", "meetingType", "H\u1ECDp chuy\xEAn \u0111\u1EC1", 2),
    cat("cat-mt-3", "meetingType", "H\u1ECDp \u0111\u1ED9t xu\u1EA5t", 3),
    cat("cat-mt-4", "meetingType", "H\u1ECDp tr\u1EF1c tuy\u1EBFn", 4),
    // Cơ quan ban hành (mục 10)
    cat("cat-ib-1", "issuingBody", "UBND t\u1EC9nh", 1),
    cat("cat-ib-2", "issuingBody", "V\u0103n ph\xF2ng UBND", 2),
    cat("cat-ib-3", "issuingBody", "S\u1EDF K\u1EBF ho\u1EA1ch v\xE0 \u0110\u1EA7u t\u01B0", 3),
    cat("cat-ib-4", "issuingBody", "S\u1EDF T\xE0i ch\xEDnh", 4)
  ];
  const guides = [
    {
      id: "g1",
      title: "HDSD d\xE0nh cho \u0110\u1EA1i bi\u1EC3u",
      content: 'H\u01AF\u1EDANG D\u1EAAN S\u1EEC D\u1EE4NG D\xC0NH CHO \u0110\u1EA0I BI\u1EC2U D\u1EF0 H\u1ECCP\n\n1. \u0110\u0103ng nh\u1EADp h\u1EC7 th\u1ED1ng b\u1EB1ng t\xE0i kho\u1EA3n \u0111\u01B0\u1EE3c c\u1EA5p; \u0111\u1ED5i m\u1EADt kh\u1EA9u l\u1EA7n \u0111\u1EA7u.\n2. Xem gi\u1EA5y m\u1EDDi v\xE0 x\xE1c nh\u1EADn tham d\u1EF1 / b\xE1o v\u1EAFng / \u1EE7y quy\u1EC1n t\u1EA1i m\u1EE5c "Phi\xEAn h\u1ECDp".\n3. Nghi\xEAn c\u1EE9u t\xE0i li\u1EC7u trong ph\u1EA7n "T\xE0i li\u1EC7u"; c\xF3 th\u1EC3 ghi ch\xFA c\xE1 nh\xE2n ho\u1EB7c g\u1EEDi g\xF3p \xFD c\xF4ng khai.\n4. Khi v\xE0o ph\xF2ng h\u1ECDp: \u0111i\u1EC3m danh (b\u1EA5m n\xFAt ho\u1EB7c qu\xE9t m\xE3 QR), theo d\xF5i ch\u01B0\u01A1ng tr\xECnh v\xE0 th\u1EDDi gian c\xF2n l\u1EA1i c\u1EE7a m\u1EE5c \u0111ang h\u1ECDp.\n5. \u0110\u0103ng k\xFD ph\xE1t bi\u1EC3u / ch\u1EA5t v\u1EA5n khi \u0111\u01B0\u1EE3c ch\u1EE7 t\u1ECDa cho ph\xE9p; th\u1EF1c hi\u1EC7n bi\u1EC3u quy\u1EBFt c\xE1c n\u1ED9i dung.\n6. Cho \xFD ki\u1EBFn c\xE1c v\u0103n b\u1EA3n l\u1EA5y \xFD ki\u1EBFn t\u1EA1i m\u1EE5c "L\u1EA5y \xFD ki\u1EBFn".',
      roleScope: ["delegate"],
      createdAt: iso(minAgo(60 * 24 * 18)),
      updatedAt: iso(minAgo(60 * 24 * 4))
    },
    {
      id: "g2",
      title: "HDSD Ch\u1EE7 t\u1ECDa & Th\u01B0 k\xFD",
      content: "H\u01AF\u1EDANG D\u1EAAN S\u1EEC D\u1EE4NG D\xC0NH CHO CH\u1EE6 T\u1ECCA V\xC0 TH\u01AF K\xDD\n\n1. T\u1EA1o/ch\u1EC9nh s\u1EEDa phi\xEAn h\u1ECDp: nh\u1EADp th\xF4ng tin, th\xE0nh ph\u1EA7n, ch\u01B0\u01A1ng tr\xECnh; g\u1EEDi gi\u1EA5y m\u1EDDi.\n2. Chu\u1EA9n b\u1ECB v\xE0 duy\u1EC7t t\xE0i li\u1EC7u h\u1ECDp (duy\u1EC7t/kh\xF4ng duy\u1EC7t t\xE0i li\u1EC7u do \u0111\u01A1n v\u1ECB tr\xECnh).\n3. \u0110i\u1EC1u h\xE0nh phi\xEAn h\u1ECDp: khai m\u1EA1c, chuy\u1EC3n m\u1EE5c ch\u01B0\u01A1ng tr\xECnh (\u0111\u1EBFm ng\u01B0\u1EE3c th\u1EDDi l\u01B0\u1EE3ng), \u0111i\u1EC1u h\xE0nh ph\xE1t bi\u1EC3u/ch\u1EA5t v\u1EA5n.\n4. M\u1EDF/\u0111\xF3ng bi\u1EC3u quy\u1EBFt; theo d\xF5i \u0111\u1EA1i bi\u1EC3u \u0111\xE3/ch\u01B0a bi\u1EC3u quy\u1EBFt (tr\u1EA1ng th\xE1i s\u1EB5n s\xE0ng).\n5. Ghi k\u1EBFt lu\u1EADn; l\u1EADp bi\xEAn b\u1EA3n theo Ngh\u1ECB \u0111\u1ECBnh 30/2020 v\xE0 k\xFD s\u1ED1.\n6. Xu\u1EA5t danh s\xE1ch \u0111i\u1EC3m danh, xu\u1EA5t \xFD ki\u1EBFn t\xE0i li\u1EC7u ph\u1EE5c v\u1EE5 t\u1ED5ng h\u1EE3p.",
      roleScope: ["chairman", "secretary"],
      createdAt: iso(minAgo(60 * 24 * 18)),
      updatedAt: iso(minAgo(60 * 24 * 6))
    },
    {
      id: "g3",
      title: "Gi\u1EDBi thi\u1EC7u chung h\u1EC7 th\u1ED1ng eCabinet",
      content: "GI\u1EDAI THI\u1EC6U H\u1EC6 TH\u1ED0NG PH\xD2NG H\u1ECCP KH\xD4NG GI\u1EA4Y (eCabinet)\n\nH\u1EC7 th\u1ED1ng h\u1ED7 tr\u1EE3 t\u1ED5 ch\u1EE9c cu\u1ED9c h\u1ECDp kh\xF4ng gi\u1EA5y t\u1EDD: qu\u1EA3n l\xFD cu\u1ED9c h\u1ECDp, t\xE0i li\u1EC7u, bi\u1EC3u quy\u1EBFt \u0111i\u1EC7n t\u1EED, ch\u1EA5t v\u1EA5n, bi\xEAn b\u1EA3n v\xE0 k\xFD s\u1ED1. T\xE0i li\u1EC7u h\u01B0\u1EDBng d\u1EABn chi ti\u1EBFt theo t\u1EEBng vai tr\xF2 \u0111\u01B0\u1EE3c cung c\u1EA5p trong m\u1EE5c n\xE0y. M\u1ECDi th\u1EAFc m\u1EAFc li\xEAn h\u1EC7 Qu\u1EA3n tr\u1ECB h\u1EC7 th\u1ED1ng.",
      roleScope: [],
      createdAt: iso(minAgo(60 * 24 * 18)),
      updatedAt: iso(minAgo(60 * 24 * 18))
    }
  ];
  const DEMO_API_KEY_RAW = "ecab_demo_qlvb_2026";
  const apiKeys = [
    {
      id: "apk-demo-qlvb",
      name: "H\u1EC7 th\u1ED1ng QLVB (demo)",
      prefix: DEMO_API_KEY_RAW.slice(0, 8),
      keyHash: sha256Hex(DEMO_API_KEY_RAW),
      scopes: ["meetings", "documents"],
      active: true,
      createdAt: iso(minAgo(60 * 24 * 10)),
      createdById: "u-admin",
      callCount: 0,
      note: 'CH\u1EC8 D\xD9NG DEMO \u2014 key th\xF4 c\u1ED1 \u0111\u1ECBnh "ecab_demo_qlvb_2026". T\u1EA1o kh\xF3a m\u1EDBi khi tri\u1EC3n khai th\u1EADt.'
    }
  ];
  return {
    users,
    units,
    rooms,
    meetings,
    documents,
    catalogs,
    guides,
    apiKeys,
    annotations: [
      { id: "an1", docId: "d3", userId: "u-ct", content: "L\u01B0u \xFD: c\xE2n nh\u1EAFc t\u0103ng t\u1EF7 tr\u1ECDng cho y t\u1EBF c\u01A1 s\u1EDF theo ki\u1EBFn ngh\u1ECB S\u1EDF Y t\u1EBF.", createdAt: iso(minAgo(7)) },
      { id: "an2", docId: "d1", userId: "u-ct", content: "S\u1ED1 li\u1EC7u thu h\xFAt \u0111\u1EA7u t\u01B0 t\u1ED1t \u2014 bi\u1EC3u d\u01B0\u01A1ng t\u1EA1i ph\u1EA7n k\u1EBFt lu\u1EADn.", createdAt: iso(minAgo(20)) },
      { id: "an3", docId: "d3", userId: "u-khdt", content: "\u0110\u1EC1 ngh\u1ECB b\u1ED5 sung ph\u1EE5 l\u1EE5c chi ti\u1EBFt danh m\u1EE5c d\u1EF1 \xE1n k\xE8m m\u1EE9c v\u1ED1n c\u1EE7a t\u1EEBng d\u1EF1 \xE1n.", isPublic: true, createdAt: iso(minAgo(11)) },
      { id: "an4", docId: "d3", userId: "u-yt", content: "Th\u1ED1ng nh\u1EA5t ph\u01B0\u01A1ng \xE1n; \u0111\u1EC1 ngh\u1ECB \u01B0u ti\xEAn gi\u1EA3i ng\xE2n s\u1EDBm cho 02 b\u1EC7nh vi\u1EC7n tuy\u1EBFn huy\u1EC7n.", isPublic: true, createdAt: iso(minAgo(6)) },
      { id: "an5", docId: "d1", userId: "u-gd", content: "\u0110\u1EC1 ngh\u1ECB b\u1ED5 sung s\u1ED1 li\u1EC7u v\u1EC1 gi\xE1o d\u1EE5c ngh\u1EC1 nghi\u1EC7p v\xE0o m\u1EE5c I.4.", isPublic: true, createdAt: iso(minAgo(16)) }
    ],
    votes,
    speakRequests,
    questions,
    messages,
    tasks,
    notifications,
    audit
  };
}
export {
  buildSeed
};
