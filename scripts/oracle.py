#!/usr/bin/env python3
"""
oracle.py — Independent reference calculation using Python's Decimal.

Reads trades.csv and prices.csv, computes positions and P&L using
the same average cost basis method described in the assessment.
Outputs golden.json for TS golden tests.

Usage: python scripts/oracle.py
"""
import csv
import json
from decimal import Decimal, getcontext
from pathlib import Path
from collections import defaultdict

# Set very high precision
getcontext().prec = 50

ZERO = Decimal("0")

def main():
    base = Path(__file__).parent.parent
    trades_path = base / "data" / "trades.csv"
    prices_path = base / "data" / "prices.csv"
    output_path = base / "tests" / "fixtures" / "golden.json"

    # Read trades
    with open(trades_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        raw_trades = list(reader)

    # Sort by (timestamp, row_number)
    for i, t in enumerate(raw_trades):
        t["_seq"] = i + 1  # 1-based row number (data row)

    raw_trades.sort(key=lambda t: (t["timestamp"], t["_seq"]))

    # Read prices
    prices = {}
    with open(prices_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            prices[row["symbol"]] = {
                "price_usd": Decimal(row["price_usd"]),
                "as_of": row["as_of"],
            }

    # Replay trades
    positions = defaultdict(lambda: {
        "quantity": ZERO,
        "cost": ZERO,
        "avg_cost": ZERO,
        "realized_pnl": ZERO,
        "total_fees": ZERO,
    })

    snapshots = []

    for trade in raw_trades:
        symbol = trade["symbol"]
        side = trade["side"]
        qty = Decimal(trade["quantity"])
        price = Decimal(trade["price_usd"])
        fee = Decimal(trade["fee_usd"])
        gross_value = qty * price

        pos = positions[symbol]
        pos["total_fees"] += fee

        snapshot_realized = ZERO

        if side == "BUY":
            pos["cost"] += gross_value + fee
            pos["quantity"] += qty
            if pos["quantity"] == ZERO:
                pos["avg_cost"] = ZERO
            else:
                pos["avg_cost"] = pos["cost"] / pos["quantity"]
        elif side == "SELL":
            if qty > pos["quantity"]:
                raise ValueError(
                    f"Short position: trying to sell {qty} {symbol} but only {pos['quantity']} held. "
                    f"Trade: {trade['trade_id']}"
                )

            avg_before = pos["avg_cost"]
            net_proceeds = gross_value - fee
            cost_removed = avg_before * qty
            snapshot_realized = net_proceeds - cost_removed
            pos["realized_pnl"] += snapshot_realized

            pos["quantity"] -= qty
            pos["cost"] -= cost_removed

            if pos["quantity"] == ZERO:
                pos["cost"] = ZERO
                pos["avg_cost"] = ZERO
            else:
                pos["avg_cost"] = pos["cost"] / pos["quantity"]

        snapshots.append({
            "trade_id": trade["trade_id"],
            "seq": trade["_seq"],
            "symbol": symbol,
            "side": side,
            "quantity": str(qty),
            "price_usd": str(price),
            "fee_usd": str(fee),
            "gross_value": str(gross_value),
            "position_qty": str(pos["quantity"]),
            "avg_cost": str(pos["avg_cost"]),
            "realized_pnl": str(snapshot_realized),
        })

    # Build portfolio summary
    total_value = ZERO
    total_cost_basis = ZERO
    total_realized = ZERO
    total_unrealized = ZERO
    total_fees = ZERO
    has_all_prices = True
    warnings = []

    holdings = []
    for symbol, pos in positions.items():
        total_realized += pos["realized_pnl"]
        total_fees += pos["total_fees"]
        cost_basis = pos["cost"]
        total_cost_basis += cost_basis

        price_data = prices.get(symbol)
        if price_data is None and pos["quantity"] != ZERO:
            has_all_prices = False
            warnings.append(f"Missing price for {symbol}")
            holdings.append({
                "symbol": symbol,
                "quantity": str(pos["quantity"]),
                "avg_cost": str(pos["avg_cost"]),
                "current_price": None,
                "cost_basis": str(cost_basis),
                "current_value": None,
                "unrealized_pnl": None,
                "realized_pnl": str(pos["realized_pnl"]),
                "total_pnl": None,
                "allocation_pct": None,
            })
            continue

        current_price = price_data["price_usd"] if price_data else ZERO
        current_value = pos["quantity"] * current_price
        unrealized = current_value - cost_basis

        total_value += current_value
        total_unrealized += unrealized

        holdings.append({
            "symbol": symbol,
            "quantity": str(pos["quantity"]),
            "avg_cost": str(pos["avg_cost"]),
            "current_price": str(current_price),
            "cost_basis": str(cost_basis),
            "current_value": str(current_value),
            "unrealized_pnl": str(unrealized),
            "realized_pnl": str(pos["realized_pnl"]),
            "total_pnl": str(pos["realized_pnl"] + unrealized),
            "allocation_pct": None,  # computed below
        })

    # Compute allocation
    if has_all_prices and total_value != ZERO:
        for h in holdings:
            if h["current_value"] is not None:
                val = Decimal(h["current_value"])
                h["allocation_pct"] = str(val / total_value * 100)

    result = {
        "positions": {
            symbol: {
                "quantity": str(pos["quantity"]),
                "avg_cost": str(pos["avg_cost"]),
                "total_cost": str(pos["cost"]),
                "realized_pnl": str(pos["realized_pnl"]),
                "total_fees": str(pos["total_fees"]),
            }
            for symbol, pos in positions.items()
        },
        "portfolio": {
            "total_value": str(total_value) if has_all_prices else None,
            "total_cost_basis": str(total_cost_basis),
            "total_realized_pnl": str(total_realized),
            "total_unrealized_pnl": str(total_unrealized) if has_all_prices else None,
            "total_pnl": str(total_realized + total_unrealized) if has_all_prices else None,
            "total_fees": str(total_fees),
        },
        "holdings": holdings,
        "snapshots": snapshots,
        "trade_count": len(raw_trades),
        "prices_as_of": prices.get("BTC", {}).get("as_of"),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    print(f"Golden output written to {output_path}")
    print(f"  Trades: {len(raw_trades)}")
    print(f"  Positions: {len(positions)}")
    for sym, pos in sorted(positions.items()):
        print(f"    {sym}: qty={pos['quantity']}, avg={pos['avg_cost']}, realized={pos['realized_pnl']}")
    print(f"  Total Value: {total_value}")
    print(f"  Total P&L: {total_realized + total_unrealized}")

if __name__ == "__main__":
    main()
