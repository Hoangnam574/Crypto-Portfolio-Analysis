"""
generate_comprehensive_csv.py
Generates a long, comprehensive CSV of 500 crypto trades covering extensive real-world and edge scenarios.
All trades are strictly valid according to the project's schema and ledger rules.
"""
import csv
from decimal import Decimal, getcontext
from datetime import datetime, timedelta
import random

getcontext().prec = 40
ZERO = Decimal("0")

SYMBOLS = ["BTC", "ETH", "SOL", "CKB", "DOGE"]
EXCHANGES = ["Binance", "Coinbase"]

BASE_PRICES = {
    "BTC": Decimal("95000.00"),
    "ETH": Decimal("3200.00"),
    "SOL": Decimal("180.00"),
    "CKB": Decimal("0.00650000"),
    "DOGE": Decimal("0.220000")
}

def fmt_decimal(d: Decimal, symbol: str) -> str:
    if symbol == "BTC":
        return f"{d:.8f}".rstrip("0").rstrip(".") if "." in f"{d:.8f}" else f"{d:.8f}"
    elif symbol == "ETH":
        return f"{d:.6f}".rstrip("0").rstrip(".") if "." in f"{d:.6f}" else f"{d:.6f}"
    elif symbol == "SOL":
        return f"{d:.4f}".rstrip("0").rstrip(".") if "." in f"{d:.4f}" else f"{d:.4f}"
    elif symbol == "CKB":
        return f"{d:.0f}"
    else:  # DOGE
        return f"{d:.2f}".rstrip("0").rstrip(".") if "." in f"{d:.2f}" else f"{d:.2f}"

def fmt_price(p: Decimal, symbol: str) -> str:
    if symbol in ("BTC", "ETH"):
        return f"{p:.2f}"
    elif symbol == "SOL":
        return f"{p:.3f}"
    elif symbol == "CKB":
        return f"{p:.8f}"
    else:
        return f"{p:.6f}"

def fmt_fee(f: Decimal) -> str:
    return f"{f:.2f}"

def main():
    random.seed(2026)
    current_time = datetime(2025, 10, 1, 8, 0, 0)
    
    holdings = {s: Decimal("0") for s in SYMBOLS}
    trades = []
    trade_counter = 1

    def add_trade(ts: datetime, exchange: str, symbol: str, side: str, qty: Decimal, price: Decimal, fee: Decimal):
        nonlocal trade_counter
        qty_str = fmt_decimal(qty, symbol)
        # Parse back exact decimal representation from formatted string so tracked holding matches exactly
        parsed_qty = Decimal(qty_str)
        if side == "BUY":
            holdings[symbol] += parsed_qty
        else:
            if parsed_qty > holdings[symbol]:
                raise ValueError(f"Cannot sell {parsed_qty} {symbol}, held {holdings[symbol]}")
            holdings[symbol] -= parsed_qty

        price_str = fmt_price(price, symbol)
        fee_str = fmt_fee(fee)
        
        trade_id = f"TRD-{trade_counter:04d}"
        trade_counter += 1
        trades.append({
            "trade_id": trade_id,
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "exchange": exchange,
            "symbol": symbol,
            "side": side,
            "quantity": qty_str,
            "price_usd": price_str,
            "fee_usd": fee_str,
            "_raw_ts": ts
        })

    # ─────────────────────────────────────────────────────────────────
    # CASE 1: Initial accumulation DCA (All 5 assets, both Binance & Coinbase)
    # ─────────────────────────────────────────────────────────────────
    for _ in range(4):
        for sym in SYMBOLS:
            current_time += timedelta(hours=random.randint(4, 12))
            exchange = random.choice(EXCHANGES)
            price = BASE_PRICES[sym] * Decimal(str(round(random.uniform(0.96, 1.04), 4)))
            
            if sym == "BTC":
                qty = Decimal(str(round(random.uniform(0.04, 0.12), 6)))
            elif sym == "ETH":
                qty = Decimal(str(round(random.uniform(1.0, 3.5), 4)))
            elif sym == "SOL":
                qty = Decimal(str(round(random.uniform(15.0, 45.0), 3)))
            elif sym == "CKB":
                qty = Decimal(str(random.randint(300000, 900000)))
            else:
                qty = Decimal(str(round(random.uniform(10000, 35000), 2)))

            fee_rate = Decimal("0.001") if exchange == "Binance" else Decimal("0.0045")
            fee = round(qty * price * fee_rate, 2)
            add_trade(current_time, exchange, sym, "BUY", qty, price, fee)

    # ─────────────────────────────────────────────────────────────────
    # CASE 2: High precision micro / dust orders & zero fees
    # ─────────────────────────────────────────────────────────────────
    current_time += timedelta(hours=6)
    # Dust BTC: 0.00001000 BTC with $0.00 fee (promotional / zero maker fee)
    add_trade(current_time, "Binance", "BTC", "BUY", Decimal("0.00001000"), Decimal("97500.00"), Decimal("0.00"))
    
    current_time += timedelta(hours=4)
    # Dust ETH: 0.000050 ETH
    add_trade(current_time, "Coinbase", "ETH", "BUY", Decimal("0.000050"), Decimal("3350.00"), Decimal("0.01"))

    # ─────────────────────────────────────────────────────────────────
    # CASE 3: Same-timestamp concurrent orders (Tie-breaking by seq order)
    # BUY BTC on Binance, BUY BTC on Coinbase, then SELL partial BTC at exact same second!
    # ─────────────────────────────────────────────────────────────────
    current_time += timedelta(days=1)
    same_second = current_time
    add_trade(same_second, "Binance", "BTC", "BUY", Decimal("0.02000000"), Decimal("98200.00"), Decimal("1.96"))
    add_trade(same_second, "Coinbase", "BTC", "BUY", Decimal("0.01500000"), Decimal("98250.00"), Decimal("7.37"))
    add_trade(same_second, "Binance", "BTC", "SELL", Decimal("0.01000000"), Decimal("99000.00"), Decimal("0.99"))

    # ─────────────────────────────────────────────────────────────────
    # CASE 4: Full Liquidation down to EXACTLY 0 (cost basis reset test)
    # Liquidate 100% of DOGE, verify zero holding, then re-buy a few days later
    # ─────────────────────────────────────────────────────────────────
    current_time += timedelta(days=2)
    doge_all = holdings["DOGE"]
    add_trade(current_time, "Binance", "DOGE", "SELL", doge_all, Decimal("0.245000"), Decimal("12.50"))
    assert holdings["DOGE"] == ZERO, f"DOGE was not zeroed: {holdings['DOGE']}"

    # Re-buy DOGE a week later at new price (fresh cost basis from zero)
    current_time += timedelta(days=5)
    add_trade(current_time, "Coinbase", "DOGE", "BUY", Decimal("25000.00"), Decimal("0.260000"), Decimal("32.50"))

    # ─────────────────────────────────────────────────────────────────
    # CASE 5: High volume whale trades
    # ─────────────────────────────────────────────────────────────────
    current_time += timedelta(days=2)
    add_trade(current_time, "Binance", "BTC", "BUY", Decimal("1.50000000"), Decimal("101500.00"), Decimal("15.23"))
    
    current_time += timedelta(hours=8)
    add_trade(current_time, "Coinbase", "CKB", "BUY", Decimal("2000000"), Decimal("0.00750000"), Decimal("75.00"))

    # ─────────────────────────────────────────────────────────────────
    # CASE 6: Massive profit taking (+150% gain) & Stop-loss cuts (-40% loss)
    # ─────────────────────────────────────────────────────────────────
    current_time += timedelta(days=3)
    # Massive profit sell on SOL
    sol_sell_qty = Decimal("15.0000")
    add_trade(current_time, "Binance", "SOL", "SELL", sol_sell_qty, Decimal("260.000"), Decimal("3.90"))
    
    current_time += timedelta(days=2)
    # Stop-loss cut on ETH during flash dip
    eth_cut_qty = Decimal("1.000000")
    add_trade(current_time, "Coinbase", "ETH", "SELL", eth_cut_qty, Decimal("2400.00"), Decimal("12.00"))

    # ─────────────────────────────────────────────────────────────────
    # CASE 7: Monotonically advancing simulation up to 500 trades across Oct 2025 - Mar 2026
    # ─────────────────────────────────────────────────────────────────
    end_time = datetime(2026, 3, 28, 12, 0, 0)
    remaining_count = 500 - len(trades)
    total_seconds = (end_time - current_time).total_seconds()
    avg_interval_seconds = total_seconds / (remaining_count + 10)

    while len(trades) < 500:
        interval = random.randint(int(avg_interval_seconds * 0.4), int(avg_interval_seconds * 1.6))
        current_time += timedelta(seconds=interval)
        
        sym = random.choice(SYMBOLS)
        exchange = random.choice(EXCHANGES)
        
        # Realistic price movement across months
        day_offset = (current_time - datetime(2025, 10, 1)).days
        drift = Decimal(str(round(1.0 + (day_offset / 180.0) * 0.18 + random.uniform(-0.06, 0.06), 4)))
        price = BASE_PRICES[sym] * drift
        
        # Decide BUY or SELL:
        # Keep positive buffer for all assets
        can_sell = False
        if sym == "BTC" and holdings[sym] > Decimal("0.05"):
            can_sell = True
        elif sym == "ETH" and holdings[sym] > Decimal("0.8"):
            can_sell = True
        elif sym == "SOL" and holdings[sym] > Decimal("10.0"):
            can_sell = True
        elif sym == "CKB" and holdings[sym] > Decimal("200000"):
            can_sell = True
        elif sym == "DOGE" and holdings[sym] > Decimal("5000"):
            can_sell = True

        if can_sell and random.random() < 0.43:
            side = "SELL"
            # Sell between 15% and 50% of holding
            fraction = Decimal(str(round(random.uniform(0.15, 0.50), 4)))
            target_qty = holdings[sym] * fraction
            
            # Format to proper precision
            if sym == "BTC":
                qty = Decimal(f"{target_qty:.8f}")
            elif sym == "ETH":
                qty = Decimal(f"{target_qty:.6f}")
            elif sym == "SOL":
                qty = Decimal(f"{target_qty:.4f}")
            elif sym == "CKB":
                qty = Decimal(f"{target_qty:.0f}")
            else:
                qty = Decimal(f"{target_qty:.2f}")

            if qty <= ZERO or qty > holdings[sym]:
                continue
        else:
            side = "BUY"
            if sym == "BTC":
                qty = Decimal(str(round(random.uniform(0.008, 0.05), 8)))
            elif sym == "ETH":
                qty = Decimal(str(round(random.uniform(0.15, 1.2), 6)))
            elif sym == "SOL":
                qty = Decimal(str(round(random.uniform(2.0, 18.0), 4)))
            elif sym == "CKB":
                qty = Decimal(str(random.randint(60000, 400000)))
            else:
                qty = Decimal(str(round(random.uniform(1500, 12000), 2)))

        # Fee models: 0% promo, VIP maker, or standard Coinbase taker
        fee_roll = random.random()
        if fee_roll < 0.04:
            fee = Decimal("0.00")
        elif exchange == "Binance":
            fee = round(qty * price * Decimal("0.00075"), 2)
        else:
            fee = round(qty * price * Decimal("0.0045"), 2)

        add_trade(current_time, exchange, sym, side, qty, price, fee)

    # Clean out internal helper keys
    for t in trades:
        del t["_raw_ts"]

    # Write to data/trades_comprehensive.csv
    import os
    target_path = os.path.join(os.path.dirname(__file__), "..", "data", "trades_comprehensive.csv")
    with open(target_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "trade_id", "timestamp", "exchange", "symbol", "side", "quantity", "price_usd", "fee_usd"
        ])
        writer.writeheader()
        writer.writerows(trades)

    print(f"Generated {len(trades)} trades in {target_path}")
    print("Holdings at end of dataset:")
    for s in SYMBOLS:
        print(f"  {s}: {holdings[s]}")

if __name__ == "__main__":
    main()
