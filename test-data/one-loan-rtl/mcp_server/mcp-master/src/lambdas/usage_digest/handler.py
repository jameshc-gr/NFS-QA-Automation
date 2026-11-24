import asyncio
import base64
import csv
import html
import io
import json
import logging
import os
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import boto3

from src.tools.email_tools import SendEmailTool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = "us-east-1"
CENTRAL = ZoneInfo("America/Chicago")

# Only reports on mcp repo Lambdas in this digest's own environment (e.g. mcp-*-dev).
# Read at import so a same-named key in the app secret can't override it.
FUNCTION_PREFIX = "mcp-"
FUNCTION_SUFFIX = f"-{os.getenv('ENVIRONMENT', 'prod')}"

# Must match the namespace/metric emitted by src/tools/base.py
TOOL_METRICS_NAMESPACE = "MCP/Lambda"
TOOL_CALLS_METRIC = "ToolCalls"

# "Typical" = average of the same weekday over this many previous weeks.
BASELINE_WEEKS = 4


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def _report_dates(now_utc: datetime) -> tuple[date, list[date]]:
    """Yesterday's Central date, plus the same weekday for each of the previous BASELINE_WEEKS weeks"""
    report_day = now_utc.astimezone(CENTRAL).date() - timedelta(days=1)
    baseline_days = [report_day - timedelta(weeks=week) for week in range(1, BASELINE_WEEKS + 1)]
    return report_day, baseline_days


def _central_day_bounds_utc(first_day: date, last_day: date) -> tuple[datetime, datetime]:
    """UTC start/end covering Central midnight of first_day through Central midnight after last_day"""
    start = datetime.combine(first_day, time.min, tzinfo=CENTRAL).astimezone(timezone.utc)
    end = datetime.combine(last_day + timedelta(days=1), time.min, tzinfo=CENTRAL).astimezone(timezone.utc)
    return start, end


def _bucket_central(timestamp_utc: datetime) -> tuple[date, int]:
    """Map an hourly UTC timestamp to its (Central date, Central hour)"""
    local = timestamp_utc.astimezone(CENTRAL)
    return local.date(), local.hour

def _list_env_metrics(cloudwatch, namespace: str, metric_name: str, dimension_names: list[str]) -> list[dict]:
    """Find metrics whose dimensions are exactly dimension_names and whose FunctionName is an mcp- Lambda in this environment

    ListMetrics only returns metrics with data in roughly the last two weeks
    """
    metrics = []
    paginator = cloudwatch.get_paginator("list_metrics")
    for page in paginator.paginate(
        Namespace=namespace,
        MetricName=metric_name,
        Dimensions=[{"Name": name} for name in dimension_names],
    ):
        for metric in page["Metrics"]:
            dimensions = {d["Name"]: d["Value"] for d in metric["Dimensions"]}
            if set(dimensions) != set(dimension_names):
                continue
            function_name = dimensions["FunctionName"]
            if function_name.startswith(FUNCTION_PREFIX) and function_name.endswith(FUNCTION_SUFFIX):
                metrics.append(metric)
    return metrics

def _get_hourly_sums(cloudwatch, metrics: list[dict], start: datetime, end: datetime) -> list[dict]:
    """Hourly Sum for each metric between start and end, bucketed by Central (date, hour)

    Returns one {(date, hour): value} dict per metric, in the same order as metrics
    """
    results = [{} for _ in metrics]
    # GetMetricData accepts at most 500 queries per call.
    for batch_start in range(0, len(metrics), 500):
        batch = metrics[batch_start:batch_start + 500]
        queries = [
            {
                "Id": f"m{batch_start + offset}",
                "MetricStat": {"Metric": metric, "Period": 3600, "Stat": "Sum"},
                "ReturnData": True,
            }
            for offset, metric in enumerate(batch)
        ]
        paginator = cloudwatch.get_paginator("get_metric_data")
        for page in paginator.paginate(
            MetricDataQueries=queries, StartTime=start, EndTime=end, ScanBy="TimestampAscending",
        ):
            for result in page["MetricDataResults"]:
                buckets = results[int(result["Id"][1:])]
                for timestamp, value in zip(result["Timestamps"], result["Values"]):
                    key = _bucket_central(timestamp)
                    buckets[key] = buckets.get(key, 0) + value
    return results

def _fetch_lambda_series(start: datetime, end: datetime) -> tuple[dict, dict]:
    """Hourly Lambda run counts and per-tool call counts from CloudWatch

    Returns (runs, tool_calls):
      runs:       {function_name: {(date, hour): count}}
      tool_calls: {(function_name, tool_name): {(date, hour): count}}
    """
    cloudwatch = boto3.client("cloudwatch", region_name=REGION)

    run_metrics = _list_env_metrics(cloudwatch, "AWS/Lambda", "Invocations", ["FunctionName"])
    run_sums = _get_hourly_sums(cloudwatch, run_metrics, start, end)
    runs = {
        metric["Dimensions"][0]["Value"]: sums
        for metric, sums in zip(run_metrics, run_sums)
    }

    tool_metrics = _list_env_metrics(
        cloudwatch, TOOL_METRICS_NAMESPACE, TOOL_CALLS_METRIC, ["FunctionName", "ToolName"],
    )
    tool_sums = _get_hourly_sums(cloudwatch, tool_metrics, start, end)
    tool_calls = {}
    for metric, sums in zip(tool_metrics, tool_sums):
        dimensions = {d["Name"]: d["Value"] for d in metric["Dimensions"]}
        tool_calls[(dimensions["FunctionName"], dimensions["ToolName"])] = sums

    return runs, tool_calls

def _summarize(buckets: dict, report_day: date, baseline_days: list[date]) -> dict:
    """Yesterday's total and hourly counts for one series, plus its typical daily total"""
    hourly = [int(buckets.get((report_day, hour), 0)) for hour in range(24)]
    baseline_totals = [
        sum(value for (day, _), value in buckets.items() if day == baseline_day)
        for baseline_day in baseline_days
    ]
    typical = sum(baseline_totals) / len(baseline_totals) if baseline_totals else 0.0
    return {"total": sum(hourly), "hourly": hourly, "typical": typical}

def _build_rows(series: dict, report_day: date, baseline_days: list[date]) -> list[dict]:
    """Summarize every series, dropping ones with no activity yesterday or typically"""
    rows = []
    for label, buckets in series.items():
        summary = _summarize(buckets, report_day, baseline_days)
        if summary["total"] == 0 and summary["typical"] == 0:
            continue
        rows.append({"label": label, **summary})
    return sorted(rows, key=lambda row: (-row["total"], str(row["label"])))

def _render_table(title: str, label_header: str, rows: list[dict]) -> str:
    cell = "padding:6px 10px;border:1px solid #dddddd;"
    if not rows:
        return f"<h3>{html.escape(title)}</h3><p>No activity.</p>"
    body = "\n".join(
        "<tr>"
        f"<td style=\"{cell}\">{html.escape(str(row['label']))}</td>"
        f"<td style=\"{cell}text-align:right;\">{row['total']:,}</td>"
        f"<td style=\"{cell}text-align:right;\">{row['typical']:,.0f}</td>"
        "</tr>"
        for row in rows
    )
    return (
        f"<h3>{html.escape(title)}</h3>"
        "<table style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;\">"
        f"<tr><th style=\"{cell}\">{html.escape(label_header)}</th>"
        f"<th style=\"{cell}\">Yesterday</th>"
        f"<th style=\"{cell}\">Typical ({BASELINE_WEEKS}-wk avg, same weekday)</th></tr>\n{body}</table>"
    )

def _render_grouped_table(title: str, label_header: str, rows: list[dict], run_totals: dict) -> str:
    """Like _render_table, but groups rows under a shaded header row per Lambda (rows need "group"/"item" keys)."""
    cell = "padding:6px 10px;border:1px solid #dddddd;"
    if not rows:
        return f"<h3>{html.escape(title)}</h3><p>No activity.</p>"

    groups = {}
    for row in rows:
        groups.setdefault(row["group"], []).append(row)
    # Busiest Lambda first; each group's rows are already sorted busiest-first by _build_rows.
    ordered = sorted(groups.items(), key=lambda item: (-sum(r["total"] for r in item[1]), item[0]))

    body = []
    for function_name, group_rows in ordered:
        runs = run_totals.get(function_name)
        runs_text = (
            f" <span style=\"font-weight:normal;color:#555555;\">({runs:,} run{'' if runs == 1 else 's'})</span>"
            if runs is not None else ""
        )
        body.append(
            "<tr style=\"background:#eef2f7;font-weight:bold;\">"
            f"<td style=\"{cell}\">{html.escape(function_name)}{runs_text}</td>"
            f"<td style=\"{cell}text-align:right;\">{sum(r['total'] for r in group_rows):,}</td>"
            f"<td style=\"{cell}text-align:right;\">{sum(r['typical'] for r in group_rows):,.0f}</td>"
            "</tr>"
        )
        body.extend(
            "<tr>"
            f"<td style=\"{cell}padding-left:28px;\">{html.escape(row['item'])}</td>"
            f"<td style=\"{cell}text-align:right;\">{row['total']:,}</td>"
            f"<td style=\"{cell}text-align:right;\">{row['typical']:,.0f}</td>"
            "</tr>"
            for row in group_rows
        )
    return (
        f"<h3>{html.escape(title)}</h3>"
        "<table style=\"border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;\">"
        f"<tr><th style=\"{cell}\">{html.escape(label_header)}</th>"
        f"<th style=\"{cell}\">Yesterday</th>"
        f"<th style=\"{cell}\">Typical ({BASELINE_WEEKS}-wk avg, same weekday)</th></tr>\n"
        + "\n".join(body) + "</table>"
    )

def _render_email(report_day: date, sections: list[tuple[str, str, list[dict] | None]], run_totals: dict) -> str:
    def render(title, label_header, rows):
        if rows is None:
            return f"<h3>{html.escape(title)}</h3><p>Unavailable (data source error; see Lambda logs).</p>"
        if rows and "group" in rows[0]:
            return _render_grouped_table(title, label_header, rows, run_totals)
        return _render_table(title, label_header, rows)

    tables = "".join(render(title, label_header, rows) for title, label_header, rows in sections)
    return (
        "<div style=\"font-family:Arial,sans-serif;\">"
        f"<h2>MCP Usage Digest — {report_day.strftime('%A, %B %d, %Y')} (Central)</h2>"
        f"{tables}"
        "<p style=\"color:#666666;font-size:12px;\">Hourly breakdowns are in the attached CSV.</p>"
        "</div>"
    )

def _build_hourly_csv(sections: list[tuple[str, str, list[dict] | None]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Section", "Name", "Total"] + [f"{hour:02d}:00" for hour in range(24)])
    for title, _, rows in sections:
        for row in rows or []:
            writer.writerow([title, row["label"], row["total"]] + row["hourly"])
    return buffer.getvalue().encode("utf-8")

def lambda_handler(event: dict, context) -> dict:
    return asyncio.run(_handler(event, context))

async def _handler(event: dict, context) -> dict:
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    for key, value in secrets.items():
        os.environ[key] = value

    recipients = [addr.strip() for addr in os.getenv("USAGE_DIGEST_RECIPIENTS", "").split(",") if addr.strip()]
    if not recipients:
        logger.error("USAGE_DIGEST_RECIPIENTS environment variable is not set.")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    report_day, baseline_days = _report_dates(datetime.now(timezone.utc))
    start, end = _central_day_bounds_utc(baseline_days[-1], report_day)
    logger.info("Building MCP usage digest for %s (baseline days: %s)", report_day, baseline_days)

    try:
        runs, tool_calls = _fetch_lambda_series(start, end)
    except Exception:
        logger.exception("Failed to fetch Lambda metrics from CloudWatch")
        runs, tool_calls = None, None

    tool_totals = None
    if tool_calls is not None:
        tool_totals = {}
        for (_, tool_name), buckets in tool_calls.items():
            combined = tool_totals.setdefault(tool_name, {})
            for key, value in buckets.items():
                combined[key] = combined.get(key, 0) + value

    def rows_for(series):
        return None if series is None else _build_rows(series, report_day, baseline_days)

    by_lambda_rows = rows_for(tool_calls)
    for row in by_lambda_rows or []:
        row["group"], row["item"] = row["label"]
        row["label"] = f"{row['group']} / {row['item']}"

    sections = [
        ("Lambda runs", "Lambda", rows_for(runs)),
        ("Tool calls (all Lambdas)", "Tool", rows_for(tool_totals)),
        ("Tool calls by Lambda", "Lambda / Tool", by_lambda_rows),
    ]
    run_totals = {row["label"]: row["total"] for row in sections[0][2] or []}

    send_result_raw = await SendEmailTool().execute({
        "body": _render_email(report_day, sections, run_totals),
        "to": [{"address": address} for address in recipients],
        "from": {"name": "Digital Mortgage Systems MCP", "address": "no-reply@rate.com"},
        "subject": f"MCP Usage Digest — {report_day.isoformat()}",
        "attachments": [{
            "content": base64.b64encode(_build_hourly_csv(sections)).decode("ascii"),
            "encoding": "base64",
            "contentType": "text/csv",
            "filename": f"mcp-usage-hourly-{report_day.isoformat()}.csv",
        }],
    })
    send_result = json.loads(send_result_raw)
    if not send_result.get("success"):
        logger.error("Failed to send MCP usage digest email: %s", send_result)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to send digest email"})}

    logger.info("Sent MCP usage digest for %s", report_day)
    return {"statusCode": 200, "body": json.dumps({"report_day": report_day.isoformat()})}