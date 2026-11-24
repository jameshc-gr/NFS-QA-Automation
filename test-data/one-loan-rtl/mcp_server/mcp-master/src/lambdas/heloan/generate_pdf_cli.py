#!/usr/bin/env python3
"""Local dev utility: generate a HELOAN decision PDF from a Prajna response JSON file.

Usage:
    venv-mcp/bin/python -m src.lambdas.heloan.generate_pdf_cli <input.json> [input2.json ...]
    venv-mcp/bin/python -m src.lambdas.heloan.generate_pdf_cli --output-dir decision-pdfs <input.json>
"""

import argparse
import json
import re
import sys
from pathlib import Path

from .pdf_generator import generate_decision_pdf


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_json", nargs="+", help="One or more Prajna HELOAN response JSON files")
    parser.add_argument(
        "--output-dir",
        default="heloan_decision_pdfs",
        help="Folder for generated PDFs (default: ./heloan_decision_pdfs)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for input_path in args.input_json:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            parser.error(f"{input_path}: expected a JSON object")

        loan_number = str(data.get("loan_number") or "").strip()
        safe_loan_number = re.sub(r"[^A-Za-z0-9._-]+", "_", loan_number).strip("._-")
        if not safe_loan_number:
            parser.error(f"{input_path}: missing a usable loan_number")

        output_path = output_dir / f"{safe_loan_number}_decision.pdf"
        pdf_bytes = generate_decision_pdf(data)
        output_path.write_bytes(pdf_bytes)
        print(f"Wrote {len(pdf_bytes)} bytes to {output_path}")


if __name__ == "__main__":
    sys.exit(main())
