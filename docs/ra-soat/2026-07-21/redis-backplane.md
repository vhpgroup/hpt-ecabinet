# Redis backplane — chạy App×2 sau cân bằng tải (đồng bộ realtime + rate-limit)

**Ngày:** 2026-07-21 · **Người thực hiện:** Khôi (Backend Architect) · **Repo:** `hpt-ecabinet`
**Phạm vi:** `server/` (Node), `server-dotnet/` (.NET), `docker-compose*.yml`, `README.md`, `docs/`, `nginx.conf` (ghi chú tối thiểu). **KHÔNG commit/push. KHÔNG đụng `.gitignore`/`package-lock.json`/`vite.config.ts`.**

---

## 1. Mục tiêu & bối cảnh

E-HSMT yêu cầu mô hình 4 cụm, có cân bằng tải ("Web-Server ×2", "App-Server ×2"). Trước đợt này, 2 cơ chế là **state per-process** (trong RAM 1 tiến trình) → vỡ khi chạy ≥2 instance sau LB:

1. **WebSocket realtime broadcast** (`ws.js` / `Ws.cs`): client nối instance A **không nhận** sự kiện phát từ ghi CRUD ở instance B.
2. **Rate-limit theo IP** (`ratelimit.js` / `RateLimit.cs`): đếm rời từng instance → lách được bằng cách để LB rải request sang nhiều instance.

**Lời giải:** Redis backplane — **Pub/Sub** cho realtime + **INCR/PEXPIRE** cho rate-limit chung. **Gated qua `REDIS_URL`**, tương thích ngược tuyệt đối, **không thêm dependency** (client RESP tự viết), parity Node ⇄ .NET, fallback an toàn.

---

## 2. Thiết kế

### 2.1. Client RESP tự viết (không thêm dependency)
Đúng triết lý dự án (đã tự viết JWT/SigV4/WS RFC6455): nói giao thức **RESP** (REdis Serialization Protocol) TRỰC TIẾP.
- **Node** (`server/src/redis.js`): TCP qua `node:net` (+ `node:tls` cho `rediss://`).
- **.NET** (`server-dotnet/ECabinet.Api/Store/RedisBackplane.cs`): `System.Net.Sockets.TcpClient` (+ `SslStream` cho `rediss://`).

Lệnh dùng: `PUBLISH`, `SUBSCRIBE`, `INCR`, `PEXPIRE`, `PTTL` (retryAfter chính xác), `PING` (keepalive), `AUTH` (nếu URL có password), `SELECT` (nếu URL có `/db`). Hỗ trợ `REDIS_URL=redis://[:password@]host:port[/db]` và `rediss://` (TLS). Dạng `user:pass@` (ACL Redis 6) cũng nhận.

**Encode lệnh** = mảng Bulk String (`encodeCommand`/`RespCodec.EncodeCommand`), độ dài tính theo **byte UTF-8**. **Parse reply** (`parseReply`/`RespCodec.ParseReply`) xử lý đủ 5 kiểu RESP v2: Simple `+`, Error `-` (trả object lỗi, KHÔNG throw ở tầng parse), Integer `:`, Bulk `$` (+ null `$-1`), Array `*` (+ null `*-1`); thiếu byte → trả `null`/`consumed=0` để chờ thêm dữ liệu (ghép frame theo stream TCP).

### 2.2. Hai kết nối tách vai
Mỗi instance mở **2 kết nối RESP**:
- **sub** — dành riêng `SUBSCRIBE ecabinet:changes` (blocking; message đẩy về `onPush`).
- **pub** — `PUBLISH` + lệnh rate-limit (`INCR`/`PEXPIRE`/`PTTL`) + `PING` keepalive.

Tách vai vì kết nối đã SUBSCRIBE của Redis không dùng cho lệnh thường được.

### 2.3. Realtime qua Pub/Sub — CHỐNG DOUBLE-SEND (điểm mấu chốt)
- Tách đường phát local thuần thành `fanoutLocal(event)` (`ws.js:31` / `Ws.cs` `FanoutLocal`) — gửi tới client WS **trên tiến trình này**. Giữ bí danh `broadcast = fanoutLocal` cho tương thích ngược.
- `notifyChange` (`index.js:56` / `Ws.cs` `NotifyChange`):
  - **Redis BẬT** → **CHỈ PUBLISH** sự kiện lên `ecabinet:changes`, **KHÔNG gọi `fanoutLocal` trực tiếp**.
  - **Redis TẮT / publish lỗi** → `fanoutLocal` như cũ.
- Handler `onPush` (`redis.js:332` `_onPush`) của **mọi instance** (kể cả instance vừa publish, vì nó cũng subscribe cùng kênh) parse message → gọi `fanoutLocal` **đúng 1 lần** cho client của mình.

→ Vì đường phát khi bật Redis **không** đi thẳng local mà quay vòng qua subscribe, mỗi client nhận **chính xác 1** bản: instance phát nhận lại đúng 1 lần cho client của nó, các instance khác nhận đúng 1 lần cho client của họ. **Không nhân đôi.** (Kiểm chứng bằng test — mục 4.)

### 2.4. Rate-limit chung
`rateHit(key)` (`redis.js:404` / `RedisBackplane.RateHitAsync`): `INCR key`; nếu là lần đầu (`==1`) thì `PEXPIRE key windowMs`; các lần sau đọc `PTTL` để tính `retryAfterSec` chính xác. So `count` với `max`. Trả **cùng shape** `{ ok, remaining, retryAfterSec }` như `hit()` cũ. Atomic đủ dùng (INCR nguyên tử; cửa sổ cố định theo key).

Điểm gọi: `index.js` `rateHit()` bọc chung (dòng 75) — login (dòng 300) + IP toàn cục (trong `http.createServer`); `.NET` `RateLimit.HitAsync` — `App.cs` login + IP toàn cục.

### 2.5. GATED — tương thích ngược tuyệt đối
- **Không `REDIS_URL`** → `redisConfigured()/FromEnv()` = false → `initBackplane` trả `null`, **KHÔNG mở kết nối**. `notifyChange`/`rateHit` đi đường cũ (local / Map in-RAM). Demo/dev/test/1-node **không đổi 1 byte hành vi**.
- **Có `REDIS_URL`** → khởi tạo backplane 1 lần lúc boot (`index.js` sau `initDb()`; `.NET` trong `App.BuildAsync`), wire `Realtime.SetBackplane` + `RateLimit.SetBackplane`.

### 2.6. Fallback an toàn (bắt buộc)
Redis đang bật mà **mất kết nối** (socket close / lỗi PUBLISH / lỗi INCR / PING fail):
- **(a) WS**: `_onDrop` đặt `up=false` → `notifyChange` tự quay về `fanoutLocal` local-only + **tự kết nối lại lũy tiến** (`_scheduleReconnect`, backoff `min(15s, 1500·1.7^retry)` — giống client WS FE), log cảnh báo.
- **(b) Rate-limit**: `rateHit` trả `null` → tầng trên **fail-open** (cho qua, KHÔNG chặn toàn hệ) + log.
- **PING keepalive** định kỳ (`REDIS_PING_MS`, mặc định 30s) phát hiện kết nối chết sớm.
- Lỗi Redis **không bao giờ** làm sập request nghiệp vụ (mọi lệnh bọc try/catch, không throw ra caller nghiệp vụ).

### 2.7. Parity Node ⇄ .NET
Cùng tên kênh `ecabinet:changes`; cùng format message JSON `{type:'change',collection,action,id,at}` (**GIỮ NGUYÊN** shape cũ — client FE không phải đổi gì); cùng key rate-limit (`ip:<ip>`, `login:<ip>:<user>`); cùng hành vi gated/fallback; cùng backoff reconnect. Đã đối chiếu byte encode/parse RESP giữa 2 bản (test-vector giống nhau).

---

## 3. File & dòng chạm

| Vai trò | Node | .NET |
|---|---|---|
| Backplane + RESP + fake | `server/src/redis.js` (mới, ~592 dòng) | `server-dotnet/ECabinet.Api/Store/RedisBackplane.cs` (mới, ~501 dòng) + `Store/FakeRedis.cs` (mới, ~152 dòng) |
| WS: tách `fanoutLocal` + phát qua backplane | `server/src/ws.js` (`fanoutLocal` d.31, `broadcast` bí danh d.41) | `Ws.cs` (`FanoutLocal`, `NotifyChange` publish-or-local, `SetBackplane`) |
| Rate-limit hợp nhất | `server/src/index.js` (`rateHit` d.75; login d.300; IP toàn cục trong `createServer`; `notifyChange` d.56; `initBackplane` sau `initDb`) | `RateLimit.cs` (`HitAsync` + `SetBackplane`); `App.cs` (2 call site `HitAsync`; init backplane trong `BuildAsync`) |
| Test | `server/test/smoke.mjs` (nhóm `12-REDIS-BACKPLANE`, +25 ca) | `server-dotnet/ECabinet.Tests/Program.cs` (nhóm `12-REDIS`, +25 ca) |
| Hạ tầng | `docker-compose.yml` (env `REDIS_URL` + service `redis` profile `scale`) | `docker-compose.dotnet.yml` (tương tự) |
| Tài liệu | `README.md` (mục "Giới hạn HA" → đã giải), `docs/HUONG-DAN-TRIEN-KHAI-VA-HSMT.md` (mục **A3.2** + bảng B2), `docs/ho-so/12` (mục 5.3 + bảng), `nginx.conf` (ghi chú sticky tối thiểu) | (chung) |

**Không đụng:** `.gitignore`, `package-lock.json`, `vite.config.ts`. Không commit/push.

---

## 4. Test (ghi số)

Sandbox **chặn socket + không có Redis** → không chạy Redis thật. Kiểm bằng: **test-vector RESP** (assert byte) + **fake Redis in-process** injectable (giả pub/sub + INCR/PEXPIRE/PTTL/PING/AUTH/SELECT; nhiều "instance" giả nối CÙNG 1 server giả → chia sẻ keyspace + bus).

**Ca mới: 25 (Node) + 25 (.NET)** — phủ:
- **RESP encode/parse test-vector**: PUBLISH/INCR (byte chính xác), UTF-8 theo byte, Integer/Bulk/null-Bulk/Array-message/Error, buffer thiếu byte → chờ, round-trip encode↔parse.
- **Parse `REDIS_URL`**: `:pass@`, mặc định 6379/db0, `rediss://`→tls, rỗng/sai scheme→null, `user:pass@` (ACL).
- **GATED**: `REDIS_URL` trống → không cấu hình (đường cũ).
- **WS backplane**: publish từ "instance A" → "instance B" fanout **đúng 1 lần** cho B; instance PHÁT (A) nhận lại **đúng 1 lần** (chống double-send); publish tới **cả** A và B.
- **Rate-limit**: INCR vượt max → chặn; **2 "instance" đếm CHUNG 1 key** (không lách được); PEXPIRE đặt TTL lần đầu.
- **Fallback**: lỗi PUBLISH → `publishChange=false` (caller local); lỗi INCR → `rateHit=null` (fail-open); chưa Up → false/null; (.NET) `RateLimit.HitAsync` Redis tắt → Map in-RAM, Redis rớt → fail-open.

**Kết quả 3 suite (0 FAIL):**
- `node scripts/build-cdn.mjs` → **PASS**.
- `node server/test/smoke.mjs` → **152/152 PASS** (127 cũ + 25 mới).
- `export PATH=$HOME/.dotnet:$PATH; dotnet run --project server-dotnet/ECabinet.Tests` → **202/202 PASS** (177 cũ + 25 mới).

---

## 5. Hạ tầng (compose)

Service `redis` (image `redis:7-alpine`, backplane thuần — tắt `save`/`appendonly`, không public cổng) **gated qua profile `scale`** trong cả `docker-compose.yml` và `docker-compose.dotnet.yml`. Env `REDIS_URL` cho service `api` mặc định **trống**. `api` **KHÔNG** `depends_on` redis (backplane tự nối lại) → `docker compose up` mặc định **không tạo redis, hành vi giữ nguyên**. Đã validate YAML.

**Giải trình lựa chọn "profile" (thay vì để service redis luôn chạy):** giữ đúng cam kết "không đổi hành vi mặc định" — người chạy demo/pilot `docker compose up` bình thường sẽ **không** thấy thêm container redis nào, `REDIS_URL` trống nên backend chạy y hệt 1-node. Chỉ khi chủ động `--profile scale` + đặt `REDIS_URL` mới bật toàn bộ đường backplane.

---

## 6. Hướng dẫn kiểm chứng THẬT với Redis (chủ dự án chạy)

### 6.1. Bật (lệnh compose)
```bash
# Node + PostgreSQL:
REDIS_URL=redis://redis:6379 docker compose --profile scale up -d --build

# .NET + SQL Server (đúng nền tảng HSMT):
REDIS_URL=redis://redis:6379 DB_PASSWORD='<mật-khẩu-SA-mạnh>' \
  docker compose -f docker-compose.dotnet.yml --profile scale up -d --build

# Chạy 2 instance API sau LB (nhanh nhất trong 1 host):
docker compose --profile scale up -d --build --scale api=2
# (nếu compose báo trùng container_name khi --scale: bỏ dòng container_name của service api,
#  hoặc triển khai 2 node riêng cùng trỏ 1 Redis, đặt nginx/HAProxy phía trước phân tải.)
```
Log mỗi instance lúc khởi động phải in: `[redis] backplane BẬT — pub/sub redis:6379 ... kênh=ecabinet:changes`.

### 6.2. Xác minh 2 instance đồng bộ REALTIME
1. Mở 2 tab, đăng nhập; xác định (qua log/LB) chúng nối **2 instance khác nhau**.
2. Tab 1: tạo/sửa 1 cuộc họp (ghi CRUD). Tab 2 phải **tự cập nhật** (nhận sự kiện `change`). *(Trước khi có backplane: tab nối instance khác KHÔNG cập nhật.)*
3. Tầng Redis: `docker exec -it ecabinet-redis redis-cli SUBSCRIBE ecabinet:changes` → mỗi ghi CRUD thấy **đúng 1** message JSON (không nhân đôi).

### 6.3. Xác minh RATE-LIMIT chung
1. Bắn vượt ngưỡng request rải qua LB (tổng > `RATE_LIMIT_MAX`, mặc định 300/60s/IP) → nhận **429** dù request rơi vào các instance khác nhau.
2. Kiểm khóa đếm: `docker exec -it ecabinet-redis redis-cli GET "ip:<IP-client>"` (tăng dần, **dùng chung**); `PTTL "ip:<IP>"` (cửa sổ còn lại).
3. Đăng nhập sai nhiều lần cùng IP+tài khoản qua 2 instance → khóa `login:<IP>:<user>` đếm chung, chặn đúng `LOGIN_RATE_MAX`.

### 6.4. Xác minh FALLBACK
- Dừng redis (`docker stop ecabinet-redis`) khi hệ đang chạy → API vẫn phục vụ (log `[redis] mất kết nối ...`), realtime về local-only, rate-limit fail-open, **không request nào bị sập**. Khởi động lại redis → backplane tự nối lại (log `[redis] backplane BẬT` lại), đồng bộ tiếp.

---

## 7. Rủi ro còn lại / lưu ý

- **Chưa chạy Redis thật ở môi trường dev** (sandbox chặn socket) — logic mạng (TCP handshake, AUTH/SELECT thật, TLS `rediss://`) kiểm chứng cuối cùng do chủ dự án chạy theo mục 6. Lớp giao thức RESP + logic backplane đã phủ test bằng fake.
- **TLS `rediss://`**: đã cài mã (`node:tls` / `SslStream`) nhưng chưa kiểm với Redis-TLS thật; nếu vấn đề, tạm dùng `redis://` trong mạng nội bộ tin cậy (sau LB/WAF của TTDL).
- **`--scale api=2` với `container_name` cố định**: compose báo trùng tên → cần bỏ `container_name` service `api` hoặc chạy 2 node riêng (đã ghi chú trong A3.2). Không ảnh hưởng cơ chế backplane.
- **Rate-limit cửa sổ cố định** (fixed window qua INCR+PEXPIRE): có hiệu ứng biên cửa sổ như bản in-RAM cũ — đủ cho mục tiêu chống brute-force; nếu cần sliding window chính xác hơn là hạng mục nâng cấp riêng.
- **HA cho chính Redis**: service mẫu là 1 node. Vận hành quy mô lớn nên cân nhắc Redis Sentinel/Cluster (không bắt buộc ở quy mô gói thầu; backplane sẽ tự nối lại khi Redis chuyển mạch).
- **Git**: chưa commit/push (theo ràng buộc). Làm việc trên cây làm việc có sẵn thay đổi của người khác — chỉ chỉnh trong phạm vi được giao.
