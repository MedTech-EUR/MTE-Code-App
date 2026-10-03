#!/usr/bin/env python3
"""
Build the final Cloudflare D1 historical-declarations seed from a local
Transparent MedTech Heroku/PostgreSQL custom-format dump.

SECURITY DESIGN
---------------
- Reads only these legacy tables via pg_restore:
    public.country
    public.currency
    public.company
    public.beneficiary
    public.declaration
- Never extracts public.user_account, public.user_company, or association.
- Does not connect to Heroku, Cloudflare, GitHub, or any network service.
- Keeps pg_restore output in local process memory only; no intermediate table dumps are written.
- Writes only the D1 seed SQL plus an aggregate validation JSON report.

MIGRATION RULES
---------------
Include:
  2023 + status=published
  2024 + status=published
  2025 + status=draft

Exclude:
  all other year/status combinations
  every declaration of a beneficiary in the --exclude-beneficiaries list
  (individual practitioners removed at MedTech Europe's request)

Safety:
- If an otherwise eligible declaration has archived=true, abort.
- If an eligible declaration is missing a beneficiary/company/currency,
  or a required beneficiary country, abort.
- If an unknown declaration nature is encountered, abort rather than
  silently inventing a label.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional

DEFAULT_PG_RESTORE = r"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"

SOURCE_TABLES = ("country", "currency", "company", "beneficiary", "declaration")

TARGET_RULES = {
    2023: "published",
    2024: "published",
    2025: "draft",
}

NATURE_LABELS = {
    "support_event": "Support to Educational Events",
    "other_grant": "Other Educational Grants",
}

COPY_RE = re.compile(
    r'^COPY\s+(?:(?:"?public"?)[.])?"?([A-Za-z_][A-Za-z0-9_]*)"?\s*'
    r'\((.*?)\)\s+FROM\s+stdin;$'
)

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


class MigrationError(RuntimeError):
    pass


def load_excluded_beneficiaries(path: Path) -> set:
    """Beneficiary IDs to leave out of the archive, such as individual practitioners:
    one per line, # starts a comment. scripts/archive-removal.mjs writes this file."""
    if not path.is_file():
        raise MigrationError(f"Exclusion list not found: {path}")
    ids = set()
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        value = line.split("#", 1)[0].strip()
        if not value:
            continue
        if not UUID_RE.match(value):
            raise MigrationError(f"{path.name} line {number} is not a beneficiary ID.")
        ids.add(value.lower())
    return ids


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run_pg_restore(pg_restore: Path, dump: Path, table: str) -> str:
    """Extract one table's data to process memory; do not write intermediate SQL files."""
    cmd = [
        str(pg_restore),
        "--data-only",
        "--no-owner",
        "--no-privileges",
        "--file=-",
        f"--table={table}",
        str(dump),
    ]
    result = subprocess.run(
        cmd,
        text=True,
        encoding="utf-8",
        errors="strict",
        capture_output=True,
    )
    if result.returncode != 0:
        msg = result.stderr.strip() or "unknown pg_restore error"
        raise MigrationError(f"pg_restore failed for public.{table}: {msg}")
    return result.stdout


def decode_copy_field(value: str) -> Optional[str]:
    """Decode PostgreSQL COPY text format for one field."""
    if value == r"\N":
        return None

    out: List[str] = []
    i = 0
    simple = {
        "b": "\b",
        "f": "\f",
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "v": "\v",
        "\\": "\\",
    }

    while i < len(value):
        ch = value[i]
        if ch != "\\":
            out.append(ch)
            i += 1
            continue

        i += 1
        if i >= len(value):
            out.append("\\")
            break

        nxt = value[i]

        if nxt in simple:
            out.append(simple[nxt])
            i += 1
            continue

        if nxt in "01234567":
            j = i
            while j < len(value) and j < i + 3 and value[j] in "01234567":
                j += 1
            out.append(chr(int(value[i:j], 8)))
            i = j
            continue

        if nxt == "x":
            j = i + 1
            start = j
            while j < len(value) and j < start + 2 and value[j] in "0123456789abcdefABCDEF":
                j += 1
            if j > start:
                out.append(chr(int(value[start:j], 16)))
                i = j
                continue

        out.append(nxt)
        i += 1

    return "".join(out)


def split_column_list(raw: str) -> List[str]:
    cols = []
    for part in raw.split(","):
        col = part.strip()
        if col.startswith('"') and col.endswith('"'):
            col = col[1:-1].replace('""', '"')
        cols.append(col)
    return cols


def parse_copy_text(text: str, expected_table: str) -> List[Dict[str, Optional[str]]]:
    rows: List[Dict[str, Optional[str]]] = []
    active_columns: Optional[List[str]] = None
    found_table = False

    # Split only on actual LF. str.splitlines() also treats Unicode characters
    # such as U+2028/U+2029 as line boundaries; those may legitimately appear
    # inside imported names/addresses and would corrupt a PostgreSQL COPY row.
    for raw_line in text.split("\n"):
        line = raw_line.rstrip("\r")

        if active_columns is None:
            m = COPY_RE.match(line)
            if not m:
                continue
            table = m.group(1)
            if table != expected_table:
                continue
            active_columns = split_column_list(m.group(2))
            found_table = True
            continue

        if line == r"\.":
            active_columns = None
            continue

        parts = line.split("\t")
        if len(parts) != len(active_columns):
            raise MigrationError(
                f"Malformed COPY row while reading {expected_table}: "
                f"expected {len(active_columns)} fields, got {len(parts)}."
            )

        decoded = [decode_copy_field(v) for v in parts]
        rows.append(dict(zip(active_columns, decoded)))

    if active_columns is not None:
        raise MigrationError(f"Unterminated COPY section for table {expected_table}.")
    if not found_table:
        raise MigrationError(
            f"No COPY data section found for public.{expected_table}. "
            "The dump may not contain the expected table or pg_restore output format changed."
        )
    return rows


def as_int(value: Optional[str], field: str) -> int:
    if value is None:
        raise MigrationError(f"Required numeric field {field} is NULL.")
    try:
        return int(value)
    except ValueError as exc:
        raise MigrationError(f"Invalid integer in {field}.") from exc


def as_float(value: Optional[str], field: str) -> float:
    if value is None:
        raise MigrationError(f"Required numeric field {field} is NULL.")
    try:
        n = float(value)
    except ValueError as exc:
        raise MigrationError(f"Invalid number in {field}.") from exc
    if not math.isfinite(n):
        raise MigrationError(f"Non-finite number in {field}.")
    return n


def as_bool(value: Optional[str], field: str) -> bool:
    if value is None:
        raise MigrationError(f"Required boolean field {field} is NULL.")
    norm = value.strip().lower()
    if norm in {"t", "true", "1", "yes", "y"}:
        return True
    if norm in {"f", "false", "0", "no", "n"}:
        return False
    raise MigrationError(f"Invalid boolean value in {field}.")


def required(value: Optional[str], field: str) -> str:
    if value is None or value == "":
        raise MigrationError(f"Required field {field} is NULL/empty.")
    return value


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise MigrationError("Attempted to write a non-finite number.")
        return repr(value)
    s = str(value)
    return "'" + s.replace("'", "''") + "'"


def insert_sql(table: str, columns: Iterable[str], row: Dict[str, object]) -> str:
    cols = list(columns)
    vals = ", ".join(sql_literal(row.get(c)) for c in cols)
    return f"INSERT OR IGNORE INTO {table} ({', '.join(cols)}) VALUES ({vals});"


def index_by_id(rows: List[Dict[str, Optional[str]]], table: str) -> Dict[str, Dict[str, Optional[str]]]:
    out: Dict[str, Dict[str, Optional[str]]] = {}
    for row in rows:
        row_id = required(row.get("id"), f"{table}.id")
        if row_id in out:
            raise MigrationError(f"Duplicate id detected in {table}.")
        out[row_id] = row
    return out


def normalized_status(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build final D1 seed.sql from a local Transparent MedTech PostgreSQL dump."
    )
    parser.add_argument("--dump", required=True, help="Path to FINAL.dump")
    parser.add_argument(
        "--out",
        default=str(Path("d1") / "historical-declarations" / "seed.sql"),
        help="Output seed.sql path (default: d1/historical-declarations/seed.sql)",
    )
    parser.add_argument(
        "--report",
        default=None,
        help="Aggregate validation report path (default: <out>.validation.json)",
    )
    parser.add_argument(
        "--pg-restore",
        default=DEFAULT_PG_RESTORE,
        help=f"Path to pg_restore.exe (default: {DEFAULT_PG_RESTORE})",
    )
    parser.add_argument(
        "--exclude-beneficiaries",
        required=True,
        help="File of beneficiary IDs to leave out, one per line "
        "(d1/historical-declarations/private/excluded-beneficiaries.txt, written by "
        "scripts/archive-removal.mjs). Required, so that a rebuild cannot republish "
        "removed beneficiaries; pass an empty file if there are none.",
    )
    args = parser.parse_args()
    excluded_beneficiaries = load_excluded_beneficiaries(
        Path(args.exclude_beneficiaries).expanduser().resolve()
    )

    dump = Path(args.dump).expanduser().resolve()
    out = Path(args.out).expanduser().resolve()
    report = (
        Path(args.report).expanduser().resolve()
        if args.report
        else Path(str(out) + ".validation.json")
    )
    pg_restore = Path(args.pg_restore).expanduser().resolve()

    if not dump.is_file():
        raise MigrationError(f"Dump not found: {dump}")
    if not pg_restore.is_file():
        raise MigrationError(f"pg_restore not found: {pg_restore}")

    out.parent.mkdir(parents=True, exist_ok=True)
    report.parent.mkdir(parents=True, exist_ok=True)

    print("Transparent MedTech -> D1 final migration")
    print(f"Source dump: {dump}")
    print(f"Output seed: {out}")
    print("Extracting only: country, currency, company, beneficiary, declaration")
    print("User/account tables will not be extracted.")

    data: Dict[str, List[Dict[str, Optional[str]]]] = {}

    for table in SOURCE_TABLES:
        print(f"  extracting public.{table} into local process memory ...")
        sql_text = run_pg_restore(pg_restore, dump, table)
        data[table] = parse_copy_text(sql_text, table)
        del sql_text
        print(f"    rows read: {len(data[table]):,}")

    countries = index_by_id(data["country"], "country")
    currencies = index_by_id(data["currency"], "currency")
    companies = index_by_id(data["company"], "company")
    beneficiaries = index_by_id(data["beneficiary"], "beneficiary")

    source_status_counts = Counter()
    eligible: List[Dict[str, Optional[str]]] = []
    eligible_archived = 0
    excluded_declarations = 0
    excluded_found = set()

    for d in data["declaration"]:
        year = as_int(d.get("year"), "declaration.year")
        status = normalized_status(d.get("status"))
        source_status_counts[(year, status)] += 1

        target_status = TARGET_RULES.get(year)
        if target_status is None or status != target_status:
            continue

        beneficiary_id = (d.get("beneficiary_id") or "").lower()
        if beneficiary_id in excluded_beneficiaries:
            excluded_declarations += 1
            excluded_found.add(beneficiary_id)
            continue

        if as_bool(d.get("archived"), "declaration.archived"):
            eligible_archived += 1
            continue

        eligible.append(d)

    print("\nSource declaration counts by year/status:")
    for (year, status), count in sorted(source_status_counts.items(), reverse=True):
        print(f"  {year} / {status or '<empty>'}: {count:,}")

    if eligible_archived:
        raise MigrationError(
            f"{eligible_archived:,} otherwise-eligible declarations have archived=true. "
            "Migration stopped so this is not silently guessed. Decide how archived records "
            "should be treated, then adjust the source or migration rule explicitly."
        )

    if not eligible:
        raise MigrationError("No declarations matched the migration rules.")

    print(f"\nEligible declarations after rules: {len(eligible):,}")
    print(
        f"Left out by the exclusion list: {excluded_declarations:,} declarations "
        f"of {len(excluded_found):,} beneficiaries"
    )
    if len(excluded_found) < len(excluded_beneficiaries):
        print(
            f"  WARNING: {len(excluded_beneficiaries) - len(excluded_found):,} listed beneficiaries "
            "have no eligible declarations in this dump. Check that the list belongs to it."
        )

    referenced_company_ids = set()
    referenced_beneficiary_ids = set()

    unknown_natures = Counter()
    nature_counts = Counter()
    year_counts = Counter()
    currency_counts = Counter()

    target_declarations: List[Dict[str, object]] = []

    missing_company = 0
    missing_beneficiary = 0
    missing_currency = 0
    missing_beneficiary_country = 0
    missing_company_country = 0
    missing_parent_company = 0

    for d in eligible:
        company_id = d.get("company_id")
        beneficiary_id = d.get("beneficiary_id")
        currency_id = d.get("currency_id")

        if not company_id or company_id not in companies:
            missing_company += 1
            continue
        if not beneficiary_id or beneficiary_id not in beneficiaries:
            missing_beneficiary += 1
            continue
        if not currency_id or currency_id not in currencies:
            missing_currency += 1
            continue

        company = companies[company_id]
        beneficiary = beneficiaries[beneficiary_id]
        currency = currencies[currency_id]

        beneficiary_country_id = beneficiary.get("country_id")
        if not beneficiary_country_id or beneficiary_country_id not in countries:
            missing_beneficiary_country += 1
            continue

        company_country_code = None
        company_country_id = company.get("country_id")
        if company_country_id:
            if company_country_id not in countries:
                missing_company_country += 1
                continue
            company_country_code = required(
                countries[company_country_id].get("iso_code"), "country.iso_code"
            )

        parent_id = company.get("parent_id")
        if parent_id and parent_id not in companies:
            missing_parent_company += 1
            continue

        nature = required(d.get("nature"), "declaration.nature")
        if nature not in NATURE_LABELS:
            unknown_natures[nature] += 1
            continue

        year = as_int(d.get("year"), "declaration.year")
        amount = as_float(d.get("amount"), "declaration.amount")
        currency_code = required(currency.get("code"), "currency.code")
        beneficiary_country_code = required(
            countries[beneficiary_country_id].get("iso_code"), "country.iso_code"
        )

        target_declarations.append(
            {
                "id": required(d.get("id"), "declaration.id"),
                "year": year,
                "amount": amount,
                "currency_code": currency_code,
                "nature": nature,
                "nature_label": NATURE_LABELS[nature],
                "description": d.get("description"),
                "company_id": company_id,
                "beneficiary_id": beneficiary_id,
                "company_name": required(company.get("name"), "company.name"),
                "beneficiary_name": required(beneficiary.get("name"), "beneficiary.name"),
                "beneficiary_country_code": beneficiary_country_code,
                "company_country_code": company_country_code,
            }
        )

        referenced_company_ids.add(company_id)
        referenced_beneficiary_ids.add(beneficiary_id)
        year_counts[year] += 1
        nature_counts[nature] += 1
        currency_counts[currency_code] += 1

    structural_errors = {
        "missing_company": missing_company,
        "missing_beneficiary": missing_beneficiary,
        "missing_currency": missing_currency,
        "missing_beneficiary_country": missing_beneficiary_country,
        "missing_company_country": missing_company_country,
        "missing_parent_company": missing_parent_company,
    }
    structural_errors = {k: v for k, v in structural_errors.items() if v}

    if structural_errors:
        details = ", ".join(f"{k}={v:,}" for k, v in structural_errors.items())
        raise MigrationError(
            "Structural validation failed for eligible declarations: " + details
        )

    if unknown_natures:
        details = ", ".join(
            f"{nature!r}={count:,}" for nature, count in sorted(unknown_natures.items())
        )
        raise MigrationError(
            "Unknown declaration nature value(s) encountered. "
            "No labels were guessed: " + details
        )

    if len(target_declarations) != len(eligible):
        raise MigrationError(
            f"Internal validation mismatch: eligible={len(eligible):,}, "
            f"output={len(target_declarations):,}."
        )

    # The current archive metadata endpoint reads all rows from countries/currencies,
    # so preserve all legacy reference values, not only those currently used.
    target_countries: List[Dict[str, object]] = []
    for row in data["country"]:
        target_countries.append(
            {
                "id": required(row.get("id"), "country.id"),
                "name": required(row.get("name"), "country.name"),
                "iso_code": required(row.get("iso_code"), "country.iso_code"),
            }
        )

    target_currencies: List[Dict[str, object]] = []
    for row in data["currency"]:
        target_currencies.append(
            {
                "id": required(row.get("id"), "currency.id"),
                "name": row.get("name") or "",
                "code": required(row.get("code"), "currency.code"),
            }
        )

    target_companies: List[Dict[str, object]] = []
    for company_id in sorted(referenced_company_ids):
        row = companies[company_id]

        country_code = None
        country_id = row.get("country_id")
        if country_id:
            if country_id not in countries:
                raise MigrationError("Referenced company points to a missing country.")
            country_code = required(countries[country_id].get("iso_code"), "country.iso_code")

        parent_name = None
        parent_id = row.get("parent_id")
        if parent_id:
            parent = companies.get(parent_id)
            if not parent:
                raise MigrationError("Referenced company points to a missing parent company.")
            parent_name = required(parent.get("name"), "company(parent).name")

        target_companies.append(
            {
                "id": company_id,
                "name": required(row.get("name"), "company.name"),
                "unique_identifier": row.get("unique_identifier"),
                "country_code": country_code,
                "postal_code": row.get("zip_code"),
                "parent_name": parent_name,
                "contact_url": row.get("contact_url"),
            }
        )

    target_beneficiaries: List[Dict[str, object]] = []
    for beneficiary_id in sorted(referenced_beneficiary_ids):
        row = beneficiaries[beneficiary_id]
        country_id = row.get("country_id")
        if not country_id or country_id not in countries:
            raise MigrationError("Referenced beneficiary points to a missing country.")

        target_beneficiaries.append(
            {
                "id": beneficiary_id,
                "name": required(row.get("name"), "beneficiary.name"),
                "unique_identifier": row.get("unique_identifier"),
                "address": row.get("address"),
                "postal_code": row.get("zip_code"),
                "city": row.get("city"),
                "country_code": required(countries[country_id].get("iso_code"), "country.iso_code"),
            }
        )

    target_countries.sort(key=lambda r: str(r["id"]))
    target_currencies.sort(key=lambda r: str(r["id"]))
    target_companies.sort(key=lambda r: str(r["id"]))
    target_beneficiaries.sort(key=lambda r: str(r["id"]))
    target_declarations.sort(key=lambda r: str(r["id"]))

    country_cols = ("id", "name", "iso_code")
    currency_cols = ("id", "name", "code")
    company_cols = (
        "id", "name", "unique_identifier", "country_code",
        "postal_code", "parent_name", "contact_url",
    )
    beneficiary_cols = (
        "id", "name", "unique_identifier", "address",
        "postal_code", "city", "country_code",
    )
    declaration_cols = (
        "id", "year", "amount", "currency_code", "nature", "nature_label",
        "description", "company_id", "beneficiary_id", "company_name",
        "beneficiary_name", "beneficiary_country_code", "company_country_code",
    )

    with out.open("w", encoding="utf-8", newline="\n") as f:
        f.write("-- FINAL Transparent MedTech historical declarations migration\n")
        f.write("-- Generated locally from a restricted PostgreSQL dump.\n")
        f.write("-- Contains public historical archive data only; no user/auth tables.\n")
        f.write("-- Migration rules: 2023 published; 2024 published; 2025 draft.\n")
        f.write(
            f"-- Left out at MedTech Europe's request: {len(excluded_found)} beneficiaries "
            f"({excluded_declarations} declarations).\n"
        )
        f.write("-- Do not commit this file to Git.\n\n")

        for table, cols, rows in (
            ("countries", country_cols, target_countries),
            ("currencies", currency_cols, target_currencies),
            ("companies", company_cols, target_companies),
            ("beneficiaries", beneficiary_cols, target_beneficiaries),
            ("declarations", declaration_cols, target_declarations),
        ):
            f.write(f"-- {table}: {len(rows)} rows\n")
            for row in rows:
                f.write(insert_sql(table, cols, row))
                f.write("\n")
            f.write("\n")

    dump_hash = sha256_file(dump)
    seed_hash = sha256_file(out)

    report_obj = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_dump_basename": dump.name,
        "source_dump_sha256": dump_hash,
        "migration_rules": {str(k): v for k, v in TARGET_RULES.items()},
        "source_declaration_counts_by_year_status": {
            f"{year}:{status}": count
            for (year, status), count in sorted(source_status_counts.items())
        },
        "eligible_archived_count": eligible_archived,
        "excluded_beneficiaries_listed": len(excluded_beneficiaries),
        "excluded_beneficiaries_found": len(excluded_found),
        "excluded_declarations": excluded_declarations,
        "output_counts": {
            "countries": len(target_countries),
            "currencies": len(target_currencies),
            "companies": len(target_companies),
            "beneficiaries": len(target_beneficiaries),
            "declarations": len(target_declarations),
        },
        "output_declarations_by_year": {
            str(year): count for year, count in sorted(year_counts.items())
        },
        "output_declarations_by_nature": dict(sorted(nature_counts.items())),
        "output_declarations_by_currency": dict(sorted(currency_counts.items())),
        "seed_sha256": seed_hash,
    }

    report.write_text(json.dumps(report_obj, indent=2) + "\n", encoding="utf-8")

    print("\nSUCCESS")
    print(f"  countries:     {len(target_countries):,}")
    print(f"  currencies:    {len(target_currencies):,}")
    print(f"  companies:     {len(target_companies):,}")
    print(f"  beneficiaries: {len(target_beneficiaries):,}")
    print(f"  declarations:  {len(target_declarations):,}")
    print("  declarations by year:")
    for year, count in sorted(year_counts.items()):
        print(f"    {year}: {count:,}")
    print(f"\nSeed written to: {out}")
    print(f"Validation report: {report}")
    print(f"Seed SHA-256: {seed_hash}")
    print("\nNo user/account tables were extracted.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MigrationError as exc:
        print(f"\nMIGRATION STOPPED: {exc}", file=sys.stderr)
        raise SystemExit(2)
