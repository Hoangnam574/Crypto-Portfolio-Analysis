# AI Workflow

Tài liệu này ghi lại quá trình cộng tác giữa con người và AI Agent trong việc thiết kế, phát triển, kiểm thử và tối ưu hóa nền tảng **Crypto Portfolio Analytics**.


## Ví dụ 0 — Tạo Implementation Plan (Áp dụng Anthropic 4D Framework)

### 1. Mục tiêu và Ngữ cảnh

Giao cho AI Agent nhiệm vụ phân tích toàn bộ đề bài assessment và dữ liệu mẫu, sau đó tổng hợp thành một kế hoạch triển khai chi tiết (`IMPLEMENTATION_PLAN.md`) — bao gồm kiến trúc thư mục, phân chia module, tiêu chí hoàn thành, và chiến lược testing.

### 2. Prompt — Lượt 1 (Người dùng)

> Bạn là Full-Stack Web3 Engineer và đang làm bài `assessment.pdf` . Đề bài yêu cầu xây dựng một nền tảng Crypto Portfolio Analytics web app hiển thị KPI tổng quan, bảng holdings, biểu đồ allocation và P&L, transaction explorer có filter, sort, paginate, và hỗ trợ import file CSV giao dịch. 2 file dữ liệu mẫu: `trades.csv` gồm khoảng 200 giao dịch spot crypto BUY/SELL trên nhiều sàn, và `prices.csv` gồm các bảng giá tham chiếu tại một thời điểm cố định. Stack dùng: Next.js App Router với TypeScript strict, Tailwind + shadcn/ui, Recharts cho biểu đồ, Drizzle ORM + Postgres SQL Neon khi deploy, PGlite khi local, decimal với precision 40 cho mọi phép tính, sau đó dùng Vitest để test. Đọc kĩ đề bài và phân tích dữ liệu cho sẵn, sau đó tạo ra file `IMPLEMENTATION_PLAN.md` hoàn chỉnh để triển khai từ đầu đến khi deploy. Plan cần bao gồm:
> - Bảng tóm tắt các quyết định kiến trúc/thiết kế đã chốt
> - Cấu trúc thư mục với mô tả trách nhiệm của từng folder
> - Chia module rõ ràng, mỗi module có danh sách task dạng checkbox 
>
> Một số ràng buộc quan trọng:
> - Domain logic phải tách biệt 100% khỏi DB và framework thư mục domain không được import React, Drizzle, hay Next.js
> - Mọi phép tính phải dùng Decimal, không được dùng number hay float
> - Import CSV phải all or nothing. Tối đa 50 lỗi kèm dòng, cột, lý do, cách sửa
> - Viết Python oracle dùng Decimal precision 40 rồi so sánh kết quả với TypeScript
> Trước khi viết plan, nếu có điểm nào trong đề bài bạn thấy mơ hồ hoặc cần tôi xác nhận thì hỏi trước nhé.

### 2.1 Phản hồi của Agent

Claude không viết plan ngay mà đặt ra các câu hỏi để làm rõ những điểm mơ hồ trong đề bài:

> Cảm ơn bạn đã cung cấp đề bài và dữ liệu rất chi tiết. Mình đã đọc qua assessment.pdf và phân tích cả trades.csv lẫn prices.csv. Trước khi viết plan, mình cần xác nhận vài điểm:
>
> **1. Phạm vi tính position — gộp hay tách theo sàn?**
> Dữ liệu có giao dịch trên cả Binance và Coinbase. Ví dụ BTC có 20 giao dịch trên Binance và 20 trên Coinbase. Khi tính cost basis, average cost, và P&L cho BTC — bạn muốn gộp tất cả thành một position duy nhất hay theo dõi riêng từng sàn?
>
> **2. Tie-breaking khi timestamp trùng**
> Mình thấy có trường hợp 2 giao dịch khác sàn nhưng cùng timestamp chính xác. Thứ tự xử lý ảnh hưởng đến average cost → ảnh hưởng realized P&L. Bạn muốn dùng quy tắc tie-break nào? Gợi ý: dùng thứ tự dòng trong file CSV (seq) để đảm bảo kết quả deterministic.
>
> **3. Asset thiếu giá trong prices.csv**
> Nếu một asset có position mở nhưng không có giá trong prices.csv thì xử lý thế nào? Loại khỏi tổng value? Vẫn hiện trong bảng? Realized P&L có tính không?
>
> **4. Khi import file mới — thay thế hay bổ sung?**
> Người dùng upload CSV mới thì ghi đè toàn bộ dữ liệu cũ hay append thêm?
>
> **5. File seed — qua validation hay không?**
> Dữ liệu mẫu (trades.csv đi kèm) khi seed vào DB lần đầu có cần đi qua cùng pipeline validation với import thủ công không? Hay tạo đường tắt riêng?

### 2.2 Prompt — Lượt 2 (Người dùng trả lời)

> Trả lời từng câu:
>
> 1. **Gộp sàn.** 
>
> 2. **Dùng seq.** 
>
> 3. **Loại khỏi tổng value** 
>
> 4. **Thay thế toàn bộ.** 
>
> 5. **Phải qua validation.** 

### 3. Phản hồi của Agent — Tạo Implementation Plan

Sau khi được xác nhận, Claude sinh ra `IMPLEMENTATION_PLAN.md` hoàn chỉnh gồm:

- **Bảng quyết định đã chốt** (19 hạng mục): stack, số học, DB, phạm vi tính, import, explorer, thiếu giá, test, mobile, deploy — mỗi hạng mục phản ánh chính xác câu trả lời ở lượt 2.
- **Thống kê dữ liệu mẫu**: 200 giao dịch (128 BUY / 72 SELL), 5 asset × 40 giao dịch, chia đều Binance/Coinbase, quantity trải từ ~0.006 BTC đến ~1.79 triệu CKB.
- **Cấu trúc thư mục** phân tách rõ 4 lớp: `/src/domain` (thuần TS), `/src/import` (parse + validate), `/src/db` (persistence), `/src/app` (UI + API).
- **12 module (M0–M11)** từ khởi tạo project đến deploy và tài liệu, mỗi module có danh sách task checkbox và mốc **"Xong khi"** rõ ràng.
- **7 điểm dễ sai** cụ thể: fee BUY vs SELL, SELL không đổi avg, full close reset, `avgBefore` phải lấy trước khi bán, cấm `number`/float, tie-break timestamp, chia cho 0.

### 4. Đánh giá & Rà soát (Review) — Discernment & Diligence

Rà soát kế hoạch AI tạo ra đối chiếu với đề bài gốc:
- Mọi yêu cầu trong assessment (KPI, holdings, charts, explorer, import, deploy) đều được map vào ít nhất 1 module.
- Module M1 (Domain) được đánh trọng số cao nhất, phản ánh đúng rủi ro kỹ thuật lớn nhất của dự án.
- Edge case tài chính đều được liệt kê tường minh ở Section 3.
- Các câu trả lời xác nhận (gộp sàn, seq tie-break, thay thế toàn bộ, seed qua validation) đều được phản ánh đúng trong plan.

### 5. Kết quả

**Chấp nhận.** Kế hoạch triển khai được lưu tại `IMPLEMENTATION_PLAN.md` và trở thành tài liệu tham chiếu chính cho toàn bộ quá trình phát triển.

---

## Ví dụ 1 — Phân tích Yêu cầu 

### 1. Mục tiêu và Ngữ cảnh
Phân tích kỹ lưỡng đặc tả yêu cầu của dự án (`assessment.pdf`) và tập dữ liệu mẫu (`trades.csv`, `prices.csv`) để làm rõ các điểm mơ hồ về kiến trúc và các edge case tài chính trước khi viết code.

### 2. Prompt
> "Đọc kĩ file assessment.pdf và IMPLEMENTATION_PLAN.md. Phân tích dữ liệu trades.csv và prices.csv, liệt kê các edge case, bất nhất có thể có và đề xuất phương án giải quyết."

### 3. Phản hồi của Agent
Agent đã phân tích 200 giao dịch qua 5 tài sản và chỉ ra:
- Phí BUY được vốn hóa vào cost basis ($cost = \text{gross} + \text{fee}$), trong khi phí SELL làm giảm số tiền thu về ($\text{net} = \text{gross} - \text{fee}$).
- Các lệnh SELL phải được định giá theo giá vốn bình quân gia quyền (WAC) *trước* khi bán.
- Đóng toàn bộ position(full close) phải reset số lượng, cost basis và giá vốn trung bình về 0.
- Phát hiện điểm mơ hồ: position được theo dõi riêng theo từng sàn hay hợp nhất trên tất cả các sàn.
- Phát hiện sự cần thiết của quy tắc phân định thứ tự (tie-breaking) khi hai giao dịch có cùng timestamp chính xác ở các sàn khác nhau.

### 4. Đánh giá & Rà soát (Review)
- Đối chiếu đề bài: *"Process transactions in ascending timestamp order for each asset in the calculation scope."*
- Thống nhất rằng các giao dịch trên Binance và Coinbase cần được hợp nhất thành một position duy nhất cho mỗi asset.
- Xác nhận việc sắp xếp phải sử dụng cặp khóa `(timestamp, seq)` với `seq` là chỉ số dòng trong file CSV để đảm bảo kết quả có tính tất định (deterministic).

### 5. Kết quả
**Chấp nhận có ràng buộc.** Thiết lập phạm vi position hợp nhất theo asset và quy tắc tie-breaking trong `IMPLEMENTATION_PLAN.md`.

---

## Ví dụ 2 — Thiết lập Database: PGlite ở Local và Neon khi Deploy

### 1. Mục tiêu và Ngữ cảnh
Thiết kế kiến trúc cơ sở dữ liệu và lưu trữ sao cho:
1. Lập trình viên có thể chạy `npm run dev` và `npm test` ngay lập tức với zero setup (không cần Docker hay PostgreSQL cài ngoài).
2. Khi deploy production lên Vercel có thể kết nối với Neon Serverless Postgres và hỗ trợ đầy đủ transaction.
3. Logic nghiệp vụ (domain logic) hoàn toàn tách biệt 100% khỏi code database.

### 2. Prompt
> "Thiết kế kiến trúc DB: client.ts là nơi duy nhất chọn driver (PGlite local hoặc Neon production). repository.ts chỉ nhận đối tượng db của Drizzle, domain không biết gì về DB."

### 3. Phản hồi của Agent
Đề xuất:
- `src/db/schema.ts`: Drizzle schema sử dụng kiểu `NUMERIC(38,18)` cho toàn bộ dữ liệu tiền tệ.
- `src/db/client.ts`: Dual-driver factory kiểm tra `process.env.DATABASE_URL`. Nếu có, sử dụng Neon với WebSocket pool (qua `@neondatabase/serverless` và `ws`); nếu không có, sử dụng PGlite nhúng.
- `src/db/repository.ts`: Nhận đối tượng `Database`, bọc toàn bộ thao tác import trong `db.transaction(...)` với thao tác batch delete và batch insert.

### 4. Đánh giá & Rà soát (Review)
- Xác minh rằng driver `neon-http` **không** hỗ trợ interactive transaction, do đó bắt buộc phải dùng Neon WebSocket Pool (`Pool` + `neonConfig.webSocketConstructor`) để đảm bảo import atomic trên production.
- Xác minh rằng PGlite hỗ trợ đầy đủ SQL transaction thông qua engine PostgreSQL WASM của nó.

### 5. Kết quả
**Chấp nhận.** Đã triển khai hoàn chỉnh trong `src/db/client.ts` và `src/db/repository.ts`.

---

## Ví dụ 3 — Triển khai Financial Ledger

### 1. Mục tiêu và Ngữ cảnh
Triển khai thuật toán replay sổ cái cốt lõi trong `src/domain/ledger.ts` theo đúng chuẩn giá vốn bình quân gia quyền (WAC) và xử lý triệt để trường hợp đóng hoàn toàn position.

### 2. Prompt
> "Triển khai replay(trades: Trade[]): replay toàn bộ Trade[] theo thứ tự thời gian từ cũ đến mới. BUY: gross = qty * price, cost += gross + fee, avg = cost / qty. SELL: net = gross - fee, removed = avgBefore * qty, realized = net - removed, qty -= q, cost -= removed. Khi qty về đúng 0: cost = 0, avg = 0 tường minh. Nếu bán vượt số lượng: throw ShortPositionError."

### 3. Phản hồi của Agent
Triển khai hàm `replay()` trong `src/domain/ledger.ts` sử dụng thư viện `Decimal`. Lưu chính xác `avgBefore = pos.avgCost` trước khi cập nhật số lượng còn lại, và thêm nhánh kiểm tra về 0 tường minh:
```ts
if (pos.quantity.isZero()) {
  pos.cost = ZERO;
  pos.avgCost = ZERO;
} else {
  pos.avgCost = pos.cost.div(pos.quantity);
}
```

### 4. Đánh giá & Rà soát (Review)
- Kiểm tra edge case: Trường hợp position xuất hiện sai số dấu phẩy động cực nhỏ (floating dust như `0.0000000000000001`) do phép chia. Việc reset tường minh khi `isZero()` loại bỏ hoàn toàn hiện tượng này.
- Xác minh `ShortPositionError` thu thập đầy đủ `trade_id`, `symbol`, số lượng cố bán, số dư hiện có và số thứ tự dòng (`seq`).

### 5. Kết quả
**Chấp nhận.** Logic domain được xác thực với bộ unit test toàn diện trong `tests/domain.test.ts`.

---

## Ví dụ 4 — Viết Test So Sánh Kết Quả Bằng Python Oracle

### 1. Mục tiêu và Ngữ cảnh
Tạo một oracle tham chiếu độc lập bằng thư viện chuẩn `decimal` của Python (độ chính xác 50 chữ số) để kiểm chứng chéo các phép tính trong TypeScript tới độ chính xác $10^{-20}$.

### 2. Prompt
> "Viết scripts/oracle.py bằng Python Decimal tính toán toàn bộ 200 trades và prices.csv, xuất ra tests/fixtures/golden.json. Sau đó viết tests/golden.test.ts so sánh kết quả TypeScript với Python."

### 3. Phản hồi của Agent
- Viết `scripts/oracle.py` tính toán position, realized P&L lũy kế, tổng phí và snapshot từng giao dịch.
- Viết `tests/golden.test.ts` đọc file `golden.json` và assert kết quả từ `replay()` của TypeScript khớp với Python oracle với sai số tương đối dưới $10^{-20}$.

### 4. Đánh giá & Rà soát (Review)
- Thực thi `python scripts/oracle.py` để sinh dữ liệu `golden.json`.
- Chạy `npx vitest run tests/golden.test.ts`. Toàn bộ 4 bài test (position từng asset, tổng danh mục và toàn bộ 200 trade snapshots) đều khớp hoàn toàn với Python oracle, sai số bằng 0.

### 5. Kết quả
**Chấp nhận.** Mang lại sự tin cậy toán học tuyệt đối về tính chính xác của thuật toán tính toán.

---

## Ví dụ 5 — Sửa đổi Gợi ý của AI: Multi-Statement Prepared Query trong PGlite

### 1. Mục tiêu và Ngữ cảnh
Thực thi các lệnh DDL migration trong `src/db/client.ts` để đảm bảo các bảng và chỉ mục tồn tại khi PGlite nhúng khởi động.

### 2. Prompt
> "Tạo hàm runMigrations(db) để tạo bảng trades, indexes và bảng prices."

### 3. Phản hồi của Agent
Agent đã gộp tất cả các câu lệnh SQL vào một chuỗi template duy nhất:
```ts
await (db as any).execute(`
  CREATE TABLE IF NOT EXISTS trades (...);
  CREATE UNIQUE INDEX IF NOT EXISTS trades_trade_id_idx ON trades (trade_id);
  CREATE TABLE IF NOT EXISTS prices (...);
`);
```

### 4. Đánh giá & Rà soát (Review)
Khi chạy `tests/repository.test.ts`, toàn bộ 6 test đều thất bại với lỗi:
```
Caused by: error: cannot insert multiple commands into a prepared statement
  code: '42601'
```
**Chẩn đoán:** Theo giao thức extended query protocol của PostgreSQL (được Drizzle sử dụng với PGlite), một prepared statement không được phép chứa nhiều câu lệnh SQL ngăn cách bởi dấu chấm phẩy.

### 5. Kết quả
**Sửa lại cài đặt của AI.** Tách việc thực thi SQL thành 3 lệnh `await db.execute(...)` riêng biệt:
1. `CREATE TABLE IF NOT EXISTS trades (...)`
2. `CREATE UNIQUE INDEX IF NOT EXISTS trades_trade_id_idx ON trades (...)`
3. `CREATE TABLE IF NOT EXISTS prices (...)`
Chạy lại Vitest: toàn bộ 6 bài test về persistence và rollback đều pass 100%.

---

## Ví dụ 6 — Phản biện & Sửa code: Định dạng Giá Coin nhỏ (< $1) — Tránh lỗi hiển thị `$0.00`

### 1. Mục tiêu và Ngữ cảnh
Xây dựng hàm tiện ích `formatPrice()` trong [src/domain/money.ts](file:///c:/Users/Acer/OneDrive%20-%20actvn.edu.vn/Desktop/AC/NFT/src/domain/money.ts) để hiển thị giá tài sản trên Dashboard, đảm bảo số liệu trực quan cho cả coin giá trị lớn (BTC, ETH) lẫn coin giá trị nhỏ (< $1 USD).

### 2. Prompt
> "Viết hàm định dạng giá formatPrice(value: Decimal). Hàm nhận vào một đối tượng Decimal và trả về chuỗi định dạng giá tiền USD. Nếu giá trị $\ge 1$ USD, làm tròn 2 chữ số thập phân. Nếu giá trị $< 1$ USD, tuyệt đối KHÔNG làm tròn 2 số thập phân vì sẽ bị biến thành $0.00; thay vào đó phải giữ tối đa 8 chữ số có nghĩa. Xử lý trên kiểu `Decimal`, không làm tròn gây lệch số liệu gốc. Nhập 0.00452 phải hiển thị đúng 0.00452 (không được hiển thị 0.00). Nhập 65000.5 phải ra 65000.50."

### 3. Phản hồi của Agent
Agent ban đầu viết hàm làm tròn cố định 2 chữ số thập phân cho mọi trường hợp:
```ts
// Đề xuất ban đầu của AI:
export function formatPrice(value: Decimal): string {
  return value.toFixed(2);
}
```
**Hệ quả:** Các tài sản hoặc mức phí nhỏ hơn $0.01 (ví dụ token giá `$0.0045`) đều bị hiển thị thành `$0.00`, khiến người dùng tưởng giá tài sản bằng 0 hoặc giao dịch không tốn phí.

### 4. Đánh giá & Rà soát (Review)
Người dùng phát hiện lỗi hiển thị trên giao diện và yêu cầu sửa logic:
- Với giá trị $\ge 1$ USD: Hiển thị 2 số thập phân theo chuẩn tiền tệ thông thường.
- Với giá trị $< 1$ USD (rất phổ biến trong thị trường crypto): Ép về 2 chữ số thập phân là sai hoàn toàn về mặt hiển thị tài chính. Cần rẽ nhánh kiểm tra `value.abs().lt(1)` để giữ lại tối đa 8 chữ số có nghĩa.

### 5. Kết quả
**Người dùng chỉnh sửa code AI thành công.** Cập nhật hàm trong [src/domain/money.ts](file:///c:/Users/Acer/OneDrive%20-%20actvn.edu.vn/Desktop/AC/NFT/src/domain/money.ts):
```ts
export function formatPrice(value: Decimal): string {
  if (value.abs().lt(1)) {
    return value.toSignificantDigits(8).toFixed();
  }
  return value.toFixed(2);
}
```
Giao diện sau khi sửa hiển thị chính xác cả giá coin lớn (`$64,120.50`) lẫn coin nhỏ (`$0.00452100`), loại bỏ hoàn toàn hiện tượng hiển thị `$0.00` vô nghĩa.

---

## Ví dụ 7 — Phản biện & Sửa Code: Chuẩn hóa Quy tắc Màu sắc Biểu đồ P&L

### 1. Mục tiêu và Ngữ cảnh
Tối ưu hóa khả năng đọc hiểu và tính nhất quán thị giác của biểu đồ **P&L Distribution by Asset** trên Dashboard.

### 2. Prompt
> "Sửa code hiển thị trong component PnlBarChart:
> 1. Thanh bar: Cố định màu Realized là var(--profit), Unrealized là var(--cyan).
> 2. Con số hiển thị: Chuẩn hóa theo quy ước tài chính: lãi ($\ge 0$) là xanh lá, lỗ ($< 0$) là đỏ, loại bỏ cyan ở số. Giữ nguyên công thức tính tỷ lệ chiều dài thanh, không can thiệp vào logic tính toán ở domain."

### 3. Phản hồi của Agent
- Các thanh bar bị đổi màu động theo giá trị âm/dương: khi một tài sản vừa có Realized âm vừa có Unrealized âm, cả hai thanh bar đều biến thành màu đỏ (`var(--loss)`), làm phá vỡ hoàn toàn chú giải (legend) trên đầu biểu đồ vốn định nghĩa Realized màu xanh lá và Unrealized màu xanh cyan.
- Về phần hiển thị số: AI dùng màu xanh cyan (`var(--cyan)`) cho Unrealized dương và xanh lá (`var(--profit)`) cho Realized dương, khiến người dùng bối rối không biết ý nghĩa của các mã màu.

### 4. Đánh giá & Rà soát (Review)
- Người dùng trực tiếp phát hiện và chỉ ra sự bất hợp lý: biểu đồ không tuân theo một quy luật trực quan rõ ràng nào.
- Người dùng yêu cầu đơn giản hóa triệt để và chuẩn hóa theo quy ước tài chính phổ thông:
  1. Thanh bar phải giữ màu cố định theo loại (Realized luôn xanh lá, Unrealized luôn xanh cyan) để luôn khớp với legend.
  2. Toàn bộ con số tài chính chỉ tuân theo một quy tắc duy nhất: **Lãi = Xanh lá, Lỗ = Đỏ** (bỏ việc dùng màu cyan cho số lãi).

### 5. Kết quả
**Người dùng chỉnh sửa AI thành công.** Cập nhật hàm component `PnlBarChart` trong `src/app/page.tsx`:
```tsx
{/* Realized Bar — luôn giữ xanh lá khớp với legend */}
<div style={{ height: '100%', width: `${rPct}%`, background: 'var(--profit)', borderRadius: 3 }} />

{/* Unrealized Bar — luôn giữ xanh cyan khớp với legend */}
<div style={{ height: '100%', width: `${uPct}%`, background: 'var(--cyan)', borderRadius: 3 }} />

{/* Giá trị số — chuẩn hóa: Lãi = Xanh lá, Lỗ = Đỏ */}
<div style={{ color: rVal >= 0 ? 'var(--profit)' : 'var(--loss)' }}>{fmtUSD(rVal)}</div>
<div style={{ color: uVal >= 0 ? 'var(--profit)' : 'var(--loss)' }}>{fmtUSD(uVal)}</div>
```
Giao diện sau khi sửa trở nên mạch lạc, dễ hiểu ngay từ cái nhìn đầu tiên và loại bỏ hoàn toàn sự nhập nhằng thị giác.

---

