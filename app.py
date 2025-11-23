from __future__ import annotations

import csv
import datetime as dt
from pathlib import Path
from typing import Dict, Tuple

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.csv"
FIELDNAMES = ["type", "date", "status", "total_workdays", "total_income"]
SALARY_PER_DAY = 150

app = Flask(__name__)

STATUS_OPTIONS = {
    "normal": {"label": "正常", "color": "#4caf50"},
    "leave": {"label": "请假", "color": "#ff9800"},
    "rest": {"label": "休息", "color": "#9e9e9e"},
}


def ensure_data_file() -> None:
    if not DATA_FILE.exists():
        _write_full_csv({})
        return

    with DATA_FILE.open("r", encoding="utf-8", newline="") as fp:
        header = fp.readline().strip()

    if header == ",".join(FIELDNAMES):
        return

    if header == "date,status":
        records: Dict[str, str] = {}
        with DATA_FILE.open("r", encoding="utf-8", newline="") as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                date = row.get("date")
                status = row.get("status")
                if date and status:
                    records[date] = status
        _write_full_csv(records)
        return

    # Unknown format: rewrite to new structure without data loss if possible
    _write_full_csv({})


def load_records() -> Tuple[Dict[str, str], Dict[str, int]]:
    ensure_data_file()
    records: Dict[str, str] = {}
    totals = {"total_workdays": 0, "total_income": 0}

    with DATA_FILE.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            row_type = (row.get("type") or "").strip() or "day"
            if row_type == "summary":
                totals = {
                    "total_workdays": int(row.get("total_workdays") or 0),
                    "total_income": int(row.get("total_income") or 0),
                }
                continue

            date = row.get("date")
            status = row.get("status")
            if date and status:
                records[date] = status

    computed_totals = compute_totals(records)
    if computed_totals != totals:
        totals = computed_totals
        _write_full_csv(records)

    return records, totals


def save_record(date_str: str, status: str) -> None:
    records, _ = load_records()
    if status == "unset":
        # 删除记录
        records.pop(date_str, None)
    else:
        records[date_str] = status
    _write_full_csv(records)


@app.route("/", methods=["GET"])
def index():
    ensure_data_file()
    return render_template(
        "index.html",
        status_options=STATUS_OPTIONS,
        today=dt.date.today().isoformat(),
    )


@app.route("/test", methods=["GET"])
def test():
    return render_template("test.html")


@app.route("/api/text", methods=["GET"])
def get_text():
    text_file = BASE_DIR / "text.txt"
    if text_file.exists():
        with text_file.open("r", encoding="utf-8") as fp:
            content = fp.read()
        return jsonify({"text": content})
    return jsonify({"text": ""})


@app.route("/api/records", methods=["GET"])
def get_records():
    records, totals = load_records()
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)

    if year and month:
        filtered = {
            date: status
            for date, status in records.items()
            if _match_year_month(date, year, month)
        }
    else:
        filtered = records

    return jsonify({"records": filtered, "totals": totals})


@app.route("/api/records", methods=["POST"])
def update_record():
    payload = request.get_json(silent=True) or {}
    date_str = payload.get("date")
    status = payload.get("status")

    if not date_str:
        return jsonify({"error": "日期不能为空"}), 400

    # 允许 unset 状态用于删除记录
    if status not in STATUS_OPTIONS and status != "unset":
        return jsonify({"error": "状态参数无效"}), 400

    try:
        dt.date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "日期格式错误"}), 400

    save_record(date_str, status)
    _, totals = load_records()
    
    message = "删除成功" if status == "unset" else "保存成功"
    return jsonify({"message": message, "totals": totals})


def _match_year_month(date_str: str, year: int, month: int) -> bool:
    try:
        date = dt.date.fromisoformat(date_str)
    except ValueError:
        return False
    return date.year == year and date.month == month


def compute_totals(records: Dict[str, str]) -> Dict[str, int]:
    total_workdays = sum(1 for status in records.values() if status == "normal")
    total_income = total_workdays * SALARY_PER_DAY
    return {"total_workdays": total_workdays, "total_income": total_income}


def _write_full_csv(records: Dict[str, str]) -> None:
    totals = compute_totals(records)
    with DATA_FILE.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=FIELDNAMES)
        writer.writeheader()
        for key in sorted(records.keys()):
            writer.writerow(
                {
                    "type": "day",
                    "date": key,
                    "status": records[key],
                    "total_workdays": "",
                    "total_income": "",
                }
            )
        writer.writerow(
            {
                "type": "summary",
                "date": "",
                "status": "",
                "total_workdays": totals["total_workdays"],
                "total_income": totals["total_income"],
            }
        )


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5555)
