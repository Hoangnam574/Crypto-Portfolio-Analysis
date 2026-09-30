# Implementation Plan — AI-Assisted Crypto Portfolio Analytics

Kế hoạch triển khai chi tiết theo từng module cho bài assessment Senior Full-Stack Engineer.

## 0. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Stack | Next.js (App Router) + TypeScript strict, Tailwind + shadcn/ui, Recharts |
| Số học | `decimal.js`, precision 40, chỉ làm tròn khi hiển thị, DB dùng `NUMERIC` |
| DB | Postgres (Neon) + Drizzle, import trong 1 transaction |
| Phạm vi tính | Gộp 2 sàn, một average cost cho mỗi asset |
| Import | Thay thế toàn bộ, gom tối đa 50 lỗi kèm số dòng, cột, lý do, cách sửa |
| Explorer | Filter/sort/paginate ở server, có cột "sau giao dịch" |
| Thiếu giá | Loại asset khỏi các tổng có giá trị hiện tại + banner cảnh báo |
| Test | Vitest (domain, import, API handler) + golden test từ script Python `Decimal` |
| Mobile | Bảng cuộn ngang, cột đầu sticky |
| Deploy | Vercel + Neon |

### Dữ liệu mẫu (đã kiểm tra)

- `trades.csv`: 200 giao dịch (128 BUY, 72 SELL), 5 asset × 40 giao dịch, chia đều Binance/Coinbase.
- File đã sắp theo timestamp, không có `trade_id` trùng, timestamp đều dạng `...Z`.
- Quantity trải từ ~0.006 (BTC) đến ~1.79 triệu (CKB), nên độ chính xác số học rất quan trọng.
- `prices.csv`: snapshot tại `2026-03-31T23:59:59Z` cho 5 asset.

## 1. Cấu trúc thư mục

```
/data                 trades.csv, prices.csv (seed)
/scripts/oracle.py    tính kết quả tham chiếu độc lập → /tests/fixtures/golden.json
/src/domain           thuần TS, không import React/DB/Next
  money.ts            cấu hình Decimal, parse, format helpers
  ledger.ts           replay giao dịch → position + snapshot từng trade
  portfolio.ts        valuation, allocation, totals
  types.ts            contracts (Trade, Position, PortfolioSummary...)
/src/import           csv-parse, schema (zod), validate.ts, errors.ts
/src/db               schema.ts, client.ts, repository.ts, seed.ts
/src/app/api          portfolio, trades, import, reset, health
/src/app              page.tsx + components (dashboard, holdings, charts, explorer, import dialog)
/tests                domain, import, api, golden
```

Quy tắc: `domain` và `import` không phụ thuộc DB hay framework. API route chỉ điều phối: đọc DB, gọi domain, trả JSON.

## 2. Các module và công việc

### M0. Khởi tạo

- [ ] Tạo Next.js, bật `strict`, cài Tailwind/shadcn, Vitest, Drizzle, decimal.js, zod, csv-parse, ESLint/Prettier.
- [ ] Thêm scripts `dev`, `build`, `test`, `db:push`, `db:seed`.
- [ ] Tạo `.env.example` (`DATABASE_URL`), đảm bảo `.env*` nằm trong `.gitignore`.

**Xong khi:** `npm run dev` và `npm test` (test rỗng) chạy được.

### M1. Domain: money và ledger (~1.5h) — trọng số cao nhất

- [ ] `money.ts`: `Decimal.set({ precision: 40 })`. Mọi số vào/ra domain là `Decimal`, JSON qua API là **string**.
- [ ] `ledger.ts`, hàm `replay(trades)` xử lý theo thứ tự `(timestamp, seq)`, `seq` là số dòng trong file:
  - BUY: `cost += qty*price + fee`, `qty += q`, `avg = cost/qty`.
  - SELL: `net = qty*price - fee`, `removed = avgTrước * q`, `realized = net - removed`, rồi trừ qty và cost.
  - Khi `qty` về đúng 0: gán `cost = 0`, `avg = 0` tường minh.
  - SELL vượt số lượng đang có: ném `ShortPositionError` (kèm trade_id, số lượng thiếu).
  - Trả về position cuối, tổng realized/phí theo asset, và snapshot sau mỗi giao dịch (qty, avg, realized của lệnh đó).
- [ ] `portfolio.ts`, hàm `buildPortfolio(positions, prices)`:
  - value, unrealized, total P&L, allocation, tổng phí.
  - Asset thiếu giá: `currentPrice = null`, không tính vào tổng value, cost basis dùng để định giá và unrealized. `warnings[]` liệt kê asset bị loại. Realized P&L vẫn được tính.
  - Asset đã đóng mà realized ≠ 0 vẫn hiện trong bảng.
  - Allocation trả 0 khi tổng value bằng 0 (không chia cho 0).

**Xong khi:** các test ở M9 pass và golden test khớp tới 1e-20.

### M2. Import và validation

Pipeline gồm 4 bước:

1. Đọc file (giới hạn 1 MB, xử lý BOM, dòng trống) và kiểm tra header đủ cột.
2. Kiểm tra từng dòng theo zod: timestamp ISO-8601 UTC hợp lệ, exchange/symbol/side thuộc tập hỗ trợ (so khớp chính xác), quantity/price > 0, fee ≥ 0, số phải là decimal thường (không NaN, không `1e-5`).
3. Kiểm tra `trade_id` trùng (báo cả dòng xuất hiện đầu tiên).
4. Chỉ khi bước 1-3 sạch: sắp xếp theo thứ tự và chạy `replay`. Lỗi short position thành lỗi có số dòng.

- [ ] Kết quả: `{ ok: true, trades } | { ok: false, errors: ImportError[], summary }`.
- [ ] Mỗi `ImportError` gồm `row`, `column`, `value`, `code`, `message`, `hint`. Giới hạn hiển thị 50 lỗi, kèm bảng tóm tắt số lỗi theo loại.

**Xong khi:** một file lỗi không ghi gì vào DB, và mọi loại lỗi có test.

### M3. Persistence

- [ ] Bảng `trades`: `seq int`, `trade_id text unique`, `ts timestamptz`, `exchange`, `symbol`, `side`, `quantity numeric(38,18)`, `price_usd`, `fee_usd`.
- [ ] Bảng `prices`: `symbol pk`, `price_usd`, `as_of`.
- [ ] `repository.replaceAllTrades(trades)`: delete + insert trong một transaction.
- [ ] `seedFromCsv()` dùng lại đúng pipeline M2 (không có đường tắt bỏ qua validation). Lần đầu chạy nếu DB rỗng thì tự seed (idempotent).

**Xong khi:** lỗi giữa chừng thì DB giữ nguyên dữ liệu cũ (có test rollback).

### M4. API

- [ ] `GET /api/portfolio`: summary, holdings, warnings, `pricesAsOf`.
- [ ] `GET /api/trades?page&pageSize&symbol&exchange&side&from&to&sort=asc|desc`: rows kèm gross value và snapshot sau giao dịch, cộng `total`. Tham số sai trả 400 với message rõ.
- [ ] `POST /api/import`: multipart, trả 200 hoặc 422 kèm danh sách lỗi.
- [ ] `POST /api/reset`: nạp lại sample. `GET /api/health`.
- [ ] Mọi lỗi bất ngờ trả `{ error: { code, message } }`, không lộ stack.

**Xong khi:** contract types (`types.ts`) dùng chung cho server và client.

### M5. UI khung và Dashboard

- [ ] Layout responsive; header có "Valued as of <as_of UTC>", nút Import và Reset.
- [ ] 6 thẻ KPI: value, cost basis, realized, unrealized, total P&L, total fees.
- [ ] Một hàm `formatPnl` duy nhất: dấu `+`/`−`, icon ▲/▼, kèm chữ cho screen reader, và cả màu.
- [ ] Formatting: USD 2 chữ số; giá dưới $1 hiển thị tới 8 chữ số có nghĩa; quantity tối đa 8 chữ số thập phân; % P&L tính trên cost basis, hiện "—" khi cost basis bằng 0.

**Xong khi:** các trạng thái loading, error, empty đều có UI.

### M6. Holdings table và Charts

- [ ] Bảng 9 cột theo đề (quantity, avg cost, current price, cost basis, value, realized, unrealized, total P&L, allocation), sort theo cột, hàng tổng ở footer.
- [ ] Chart 1: allocation theo value (ẩn asset value = 0 và ghi chú).
- [ ] Chart 2: grouped bar realized vs unrealized theo asset, có đường 0 rõ ràng.
- [ ] Chart dùng cùng dữ liệu với bảng (không tính lại ở client), có `aria-label` và bảng dữ liệu thay thế.

**Xong khi:** tổng chart = tổng bảng = KPI.

### M7. Transaction Explorer

- [ ] Bộ lọc: symbol, exchange, side, date range (UTC), nút clear. Sort theo timestamp. Phân trang server-side (mặc định 25 dòng).
- [ ] Hiển thị đủ 8 trường CSV + gross value + fee nổi bật + cột qty sau GD, avg cost sau GD, realized P&L (chỉ SELL).
- [ ] Trạng thái "không có kết quả" có nút xóa filter.
- [ ] Mobile: bảng cuộn ngang, cột đầu sticky.

**Xong khi:** đổi filter thì state cập nhật và tổng số dòng đúng.

### M8. Import UI và các trạng thái lỗi

- [ ] Dialog upload; lỗi hiển thị dạng bảng (dòng, cột, giá trị, lý do, cách sửa) + tóm tắt theo loại + ghi rõ "chưa có gì bị thay đổi".
- [ ] Banner thiếu giá, error boundary, retry khi API lỗi, xác nhận trước khi Reset.

**Xong khi:** thử thủ công các file lỗi mẫu (thiếu cột, trùng ID, SELL vượt, số âm) đều ra thông báo đúng.

### M9. Testing

- [ ] **Oracle:** `scripts/oracle.py` dùng `Decimal` tính position và P&L cho 200 giao dịch, xuất `golden.json`. Test TS so sánh từng asset.
- [ ] **Unit test với số cụ thể:**
  - Nhiều BUY khác giá
  - BUY fee vào average cost
  - Partial SELL
  - SELL fee trừ vào proceeds
  - Full close rồi BUY lại (avg cost mới không dính giá cũ)
  - SELL gây short bị từ chối
- [ ] **Import test:** thiếu cột, trùng ID, timestamp sai, symbol/side/exchange lạ, quantity/price ≤ 0, fee âm, file lỗi không đổi DB.
- [ ] **Bổ sung:** allocation khi tổng bằng 0, thiếu giá, tie-break cùng timestamp, độ chính xác với CKB lớn (1.79M) và BTC nhỏ.
- [ ] Một lệnh duy nhất: `npm test`.

### M10. Deploy

- [ ] Vercel + Neon; biến môi trường đặt trên dashboard (không commit).
- [ ] Kiểm tra: mở link ở cửa sổ ẩn danh, thấy dữ liệu ngay, Import và Reset chạy được.

### M11. Tài liệu

- [ ] `README.md`: setup + env, lệnh dev/test/build, kiến trúc + sơ đồ Mermaid, cách tính, precision/rounding, URL deploy, giả định/hạn chế/tradeoff, hướng cải tiến.
- [ ] `AI_WORKFLOW.md`: Prompt.

## 3. Các điểm dễ sai cần kiểm tra kỹ

1. Fee BUY vào cost basis, fee SELL trừ vào proceeds (không cộng vào cost).
2. SELL không đổi average cost của phần còn lại.
3. Sau full close, BUY kế tiếp phải bắt đầu từ 0.
4. `removed = avgTrước × q`: phải lấy avg **trước** khi bán.
5. Không dùng `number`/float ở bất kỳ đâu trong domain, không parse Decimal từ float.
6. Timestamp trùng nhau giữa hai sàn: dùng `seq` làm tie-break để kết quả ổn định.
7. Chia cho 0: allocation, % P&L, average cost của position đã đóng.
