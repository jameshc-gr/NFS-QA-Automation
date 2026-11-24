# ---------------------------------------------------------------------------
# Lambda error alarm standard
# ---------------------------------------------------------------------------
# Every Lambda module creates a `lambda-errors-<function>` alarm. The module
# compares with GreaterThanThreshold, so a threshold of 0 alerts on >= 1 error
# in the evaluation period. Each Lambda wires its prod SNS topic through
# alarm_notification_arns, except Lambdas whose custom failure alarms below
# already notify on any AWS/Lambda Errors datapoint.

locals {
  lambda_errors_evaluation_period   = 300
  lambda_excessive_errors_in_period = 0
}

module "heloan_decline_digest_alarms_topic" {
  count                       = var.environment == "prod" ? 1 : 0
  source                      = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.90"
  topic_name                  = "mcp-heloan-decline-digest-alarms-${var.environment}"
  services_allowed_to_publish = ["cloudwatch.amazonaws.com"]
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_sns_topic_subscription" "heloan_decline_digest_alarm_email" {
  for_each  = var.environment == "prod" ? toset(var.heloan_decline_digest_alarm_email_recipients) : toset([])
  topic_arn = module.heloan_decline_digest_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_log_metric_filter" "heloan_decline_digest_errors" {
  count          = var.environment == "prod" ? 1 : 0
  name           = "heloan-decline-digest-processing-failures-${var.environment}"
  log_group_name = "/aws/lambda/${module.heloan_decline_digest_lambda.lambda_function_name}"
  pattern        = "\"HELOAN_DECLINE_DIGEST_PROCESSING_FAILED\""

  metric_transformation {
    name          = "ProcessingFailures"
    namespace     = "MCP/HeloanDeclineDigest/${var.environment}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "heloan_decline_digest_failures" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-processing-failures-${module.heloan_decline_digest_lambda.lambda_function_name}"
  alarm_description   = "HELOAN digest processing failed: an unhandled exception, timeout, initialization failure, or final error response occurred. Healthy schedule skips, empty queues, and recovery events do not notify. Inspect the Lambda logs for details."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.heloan_decline_digest_alarms_topic[0].topic_arn]
  ok_actions          = []

  metric_query {
    id          = "failures"
    expression  = "SUM([runtime_errors, processing_failures])"
    label       = "Final HELOAN digest processing failures"
    return_data = true
  }
  metric_query {
    id          = "runtime_errors"
    return_data = false
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 60
      stat        = "Sum"
      dimensions = {
        FunctionName = module.heloan_decline_digest_lambda.lambda_function_name
      }
    }
  }
  metric_query {
    id          = "processing_failures"
    return_data = false
    metric {
      namespace   = aws_cloudwatch_log_metric_filter.heloan_decline_digest_errors[0].metric_transformation[0].namespace
      metric_name = aws_cloudwatch_log_metric_filter.heloan_decline_digest_errors[0].metric_transformation[0].name
      period      = 60
      stat        = "Sum"
    }
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_cloudwatch_metric_alarm" "heloan_decline_digest_throttles" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-sustained-throttles-${module.heloan_decline_digest_lambda.lambda_function_name}"
  alarm_description   = "HELOAN digest Lambda was throttled in at least two of the last three one-minute periods; investigate sustained concurrency limits."
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  statistic           = "Sum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  period              = 60
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.heloan_decline_digest_alarms_topic[0].topic_arn]
  ok_actions          = []
  dimensions = {
    FunctionName = module.heloan_decline_digest_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "underwriting_approved_alarms_topic" {
  count                       = var.environment == "prod" ? 1 : 0
  source                      = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.90"
  topic_name                  = "mcp-underwriting-approved-alarms-${var.environment}"
  services_allowed_to_publish = ["cloudwatch.amazonaws.com"]
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_sns_topic_subscription" "underwriting_approved_alarm_email" {
  for_each  = var.environment == "prod" ? toset(var.underwriting_approved_alarm_email_recipients) : toset([])
  topic_arn = module.underwriting_approved_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_log_metric_filter" "underwriting_approved_errors" {
  count          = var.environment == "prod" ? 1 : 0
  name           = "underwriting-approved-processing-failures-${var.environment}"
  log_group_name = "/aws/lambda/${module.underwriting_approved_lambda.lambda_function_name}"
  pattern        = "\"UNDERWRITING_APPROVED_PROCESSING_FAILED\""

  metric_transformation {
    name          = "ProcessingFailures"
    namespace     = "MCP/UnderwritingApproved/${var.environment}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "underwriting_approved_failures" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-processing-failures-${module.underwriting_approved_lambda.lambda_function_name}"
  alarm_description   = "Underwriting-approved processing failed: an unhandled exception, timeout, initialization failure, or final error response occurred. Successful no-ops, retries, and recovery events do not notify. Inspect the Lambda logs for details."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.underwriting_approved_alarms_topic[0].topic_arn]
  ok_actions          = []

  metric_query {
    id          = "failures"
    expression  = "SUM([runtime_errors, processing_failures])"
    label       = "Final underwriting-approved processing failures"
    return_data = true
  }
  metric_query {
    id          = "runtime_errors"
    return_data = false
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 60
      stat        = "Sum"
      dimensions = {
        FunctionName = module.underwriting_approved_lambda.lambda_function_name
      }
    }
  }
  metric_query {
    id          = "processing_failures"
    return_data = false
    metric {
      namespace   = aws_cloudwatch_log_metric_filter.underwriting_approved_errors[0].metric_transformation[0].namespace
      metric_name = aws_cloudwatch_log_metric_filter.underwriting_approved_errors[0].metric_transformation[0].name
      period      = 60
      stat        = "Sum"
    }
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_cloudwatch_metric_alarm" "underwriting_approved_duration" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-duration-${module.underwriting_approved_lambda.lambda_function_name}"
  alarm_description   = "Underwriting-approved Lambda exceeded 80% of its configured timeout in three consecutive one-minute periods; investigate sustained downstream slowness."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  period              = 60
  threshold           = module.underwriting_approved_lambda.lambda_metadata.timeout * 1000 * 0.8
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.underwriting_approved_alarms_topic[0].topic_arn]
  ok_actions          = []
  dimensions = {
    FunctionName = module.underwriting_approved_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_cloudwatch_metric_alarm" "underwriting_approved_throttles" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-sustained-throttles-${module.underwriting_approved_lambda.lambda_function_name}"
  alarm_description   = "Underwriting-approved Lambda was throttled in at least two of the last three one-minute periods; investigate sustained concurrency limits."
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  statistic           = "Sum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  period              = 60
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.underwriting_approved_alarms_topic[0].topic_arn]
  ok_actions          = []
  dimensions = {
    FunctionName = module.underwriting_approved_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "credit_inquiry_alarms_topic" {
  count                       = var.environment == "prod" ? 1 : 0
  source                      = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.90"
  topic_name                  = "mcp-credit-inquiry-alarms-${var.environment}"
  services_allowed_to_publish = ["cloudwatch.amazonaws.com"]
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_sns_topic_subscription" "credit_inquiry_alarm_email" {
  for_each  = var.environment == "prod" ? toset(var.credit_inquiry_alarm_email_recipients) : toset([])
  topic_arn = module.credit_inquiry_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_log_metric_filter" "credit_inquiry_errors" {
  count          = var.environment == "prod" ? 1 : 0
  name           = "credit-inquiry-logged-errors-${var.environment}"
  log_group_name = "/aws/lambda/${module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name}"
  pattern        = "\"CREDIT_INQUIRY_PROCESSING_FAILED\""

  metric_transformation {
    name          = "ProcessingFailures"
    namespace     = "MCP/CreditInquiry/${var.environment}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "credit_inquiry_logged_errors" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-logged-errors-${module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name}"
  alarm_description   = "Credit inquiry processing failed: an unhandled exception, timeout, initialization failure, or alertable final error response occurred. Missing successful ECS reports, ECS E0710, E0424, E0059, empty borrower data, and Taskmaster create HTTP 500 or unmatched create results are logged without email. Inspect Lambda logs for details."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.credit_inquiry_alarms_topic[0].topic_arn]
  ok_actions          = []
  metric_query {
    id          = "failures"
    expression  = "SUM([runtime_errors, processing_failures])"
    label       = "Final credit inquiry processing failures"
    return_data = true
  }
  metric_query {
    id          = "runtime_errors"
    return_data = false
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 60
      stat        = "Sum"
      dimensions = {
        FunctionName = module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name
      }
    }
  }
  metric_query {
    id          = "processing_failures"
    return_data = false
    metric {
      namespace   = aws_cloudwatch_log_metric_filter.credit_inquiry_errors[0].metric_transformation[0].namespace
      metric_name = aws_cloudwatch_log_metric_filter.credit_inquiry_errors[0].metric_transformation[0].name
      period      = 60
      stat        = "Sum"
    }
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_cloudwatch_metric_alarm" "credit_inquiry_duration" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-duration-${module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name}"
  alarm_description   = "Credit inquiry Lambda exceeded 80% of its configured timeout in three consecutive one-minute periods; investigate sustained downstream slowness."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  period              = 60
  threshold           = module.underwriting_credit_inquiry_task_automation_lambda.lambda_metadata.timeout * 1000 * 0.8
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.credit_inquiry_alarms_topic[0].topic_arn]
  ok_actions          = []
  dimensions = {
    FunctionName = module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_cloudwatch_metric_alarm" "credit_inquiry_throttles" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-sustained-throttles-${module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name}"
  alarm_description   = "Credit inquiry Lambda was throttled in at least two of the last three one-minute periods; investigate sustained concurrency limits."
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  statistic           = "Sum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  period              = 60
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.credit_inquiry_alarms_topic[0].topic_arn]
  ok_actions          = []
  dimensions = {
    FunctionName = module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

# ---------------------------------------------------------------------------
# HELOAN Lambda Monitoring
# ---------------------------------------------------------------------------
# CloudWatch alarms for HELOAN processing Lambdas, wired to an SNS topic that
# fans out to email recipients. Covers:
#   - Errors        (built-in in the lambda module via alarm_notification_arns;
#                    >= 1 error in 5 minutes, see "Lambda error alarm standard")
#   - Throttles     (built-in in the lambda module via alarm_notification_arns)
#   - Duration      (custom, warns when a lambda invocation nears its timeout)
#   - Missed digest (custom, warns if the digest lambda has zero invocations
#                    over a 25-hour window, meaning the daily cron did not fire)
#
# Only wired up in prod — dev/nonprod alarms would otherwise page/email the
# team for expected noise from testing.

module "heloan_alarms_topic" {
  count      = var.environment == "prod" ? 1 : 0
  source     = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.75"
  topic_name = "mcp-heloan-alarms-${var.environment}"
  services_allowed_to_publish = [
    "cloudwatch.amazonaws.com",
  ]
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

# SNS "email" protocol subscriptions do not support a distinct CC field; every
# subscriber receives the notification as a direct recipient. All three
# addresses below are subscribed so they will receive the alarm emails
# regardless of nominal "to" vs "cc" designation.
resource "aws_sns_topic_subscription" "heloan_alarm_email" {
  for_each  = var.environment == "prod" ? toset(var.heloan_alarm_email_recipients) : toset([])
  topic_arn = module.heloan_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

# Part of the topic module's state was left at the pre-count address; move it
# so Terraform updates the existing topic policy/alias instead of replacing them.
moved {
  from = module.heloan_alarms_topic.aws_sns_topic_policy.this
  to   = module.heloan_alarms_topic[0].aws_sns_topic_policy.this
}

moved {
  from = module.heloan_alarms_topic.aws_kms_alias.this
  to   = module.heloan_alarms_topic[0].aws_kms_alias.this
}

moved {
  from = module.heloan_alarms_topic.random_string.stack
  to   = module.heloan_alarms_topic[0].random_string.stack
}

module "heloan_pipeline_alarms_topic" {
  count      = var.environment == "prod" ? 1 : 0
  source     = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.75"
  topic_name = "mcp-heloan-pipeline-alarms-${var.environment}"
  services_allowed_to_publish = [
    "cloudwatch.amazonaws.com",
  ]
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_sns_topic_subscription" "heloan_pipeline_alarm_email" {
  for_each  = var.environment == "prod" ? toset(var.heloan_pipeline_alarm_email_recipients) : toset([])
  topic_arn = module.heloan_pipeline_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

moved {
  from = aws_sns_topic_subscription.heloan_pipeline_alarm_email[0]
  to   = aws_sns_topic_subscription.heloan_pipeline_alarm_email["Boyang.Zhao@rate.com"]
}

moved {
  from = aws_sns_topic_subscription.heloan_pipeline_additional_alarm_email["Min.Lei@rate.com"]
  to   = aws_sns_topic_subscription.heloan_pipeline_alarm_email["Min.Lei@rate.com"]
}

module "heloan_title_company_update_alarms_topic" {
  count      = var.environment == "prod" ? 1 : 0
  source     = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.75"
  topic_name = "mcp-heloan-title-company-update-alarms-${var.environment}"
  services_allowed_to_publish = [
    "cloudwatch.amazonaws.com",
  ]
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_sns_topic_subscription" "heloan_title_company_update_alarm_email" {
  for_each  = var.environment == "prod" ? toset(var.heloan_title_company_update_alarm_email_recipients) : toset([])
  topic_arn = module.heloan_title_company_update_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

moved {
  from = aws_sns_topic_subscription.heloan_title_company_update_alarm_email[0]
  to   = aws_sns_topic_subscription.heloan_title_company_update_alarm_email["Boyang.Zhao@rate.com"]
}

moved {
  from = aws_sns_topic_subscription.heloan_title_company_update_additional_alarm_email["Min.Lei@rate.com"]
  to   = aws_sns_topic_subscription.heloan_title_company_update_alarm_email["Min.Lei@rate.com"]
}

module "usage_digest_alarms_topic" {
  count                       = var.environment == "prod" ? 1 : 0
  source                      = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.90"
  topic_name                  = "mcp-usage-digest-alarms-${var.environment}"
  services_allowed_to_publish = ["cloudwatch.amazonaws.com"]
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_sns_topic_subscription" "usage_digest_alarm_email" {
  for_each  = var.environment == "prod" ? toset(var.usage_digest_alarm_email_recipients) : toset([])
  topic_arn = module.usage_digest_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

# ---------------------------------------------------------------------------
# Duration alarms — warn when an invocation gets close to the lambda timeout,
# which typically means a downstream dependency (Prajna, ECS, OneLoan, SES,
# S3, DynamoDB) is slow or hung. The threshold is expressed in milliseconds.
# ---------------------------------------------------------------------------

locals {
  heloan_lambda_timeout_ms                  = 300 * 1000
  heloan_digest_lambda_timeout_ms           = 300 * 1000
  heloan_duration_alarm_threshold_ms        = local.heloan_lambda_timeout_ms * 0.8
  heloan_digest_duration_alarm_threshold_ms = local.heloan_digest_lambda_timeout_ms * 0.8
}

resource "aws_cloudwatch_metric_alarm" "heloan_duration" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-duration-${module.heloan_lambda.lambda_function_name}"
  alarm_description   = "HELOAN lambda invocation duration exceeded 80% of its ${local.heloan_lambda_timeout_ms}ms timeout in the last 5 minutes; downstream call is likely hanging."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  threshold           = local.heloan_duration_alarm_threshold_ms
  treat_missing_data  = "notBreaching"
  ok_actions          = [module.heloan_alarms_topic[0].topic_arn]
  alarm_actions       = [module.heloan_alarms_topic[0].topic_arn]
  dimensions = {
    FunctionName = module.heloan_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_cloudwatch_metric_alarm" "heloan_decline_digest_duration" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-duration-${module.heloan_decline_digest_lambda.lambda_function_name}"
  alarm_description   = "HELOAN digest Lambda exceeded 80% of its configured timeout in three consecutive one-minute periods; investigate sustained downstream slowness."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  period              = 60
  threshold           = module.heloan_decline_digest_lambda.lambda_metadata.timeout * 1000 * 0.8
  treat_missing_data  = "notBreaching"
  ok_actions          = []
  alarm_actions       = [module.heloan_decline_digest_alarms_topic[0].topic_arn]
  dimensions = {
    FunctionName = module.heloan_decline_digest_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

# These custom alarms used the same names as the Lambda modules' built-in
# `lambda-errors-*` alarms, so both resources fought over one CloudWatch alarm.
# The module alarms now own them; forget the duplicates without deleting the
# shared AWS alarms.
removed {
  from = aws_cloudwatch_metric_alarm.heloan_errors
  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_cloudwatch_metric_alarm.heloan_pipeline_assignment_errors
  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_cloudwatch_metric_alarm.heloan_uw_roster_reset_daily_errors
  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_cloudwatch_metric_alarm.heloan_uw_roster_sync_errors
  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_cloudwatch_metric_alarm.heloan_processor_first_review_errors
  lifecycle {
    destroy = false
  }
}

# ---------------------------------------------------------------------------
# Missed digest schedule alarm — the digest lambda has two EventBridge crons
# (DST + standard time) so exactly ONE fires per day. If we observe zero
# invocations over a 25h window, the schedule is broken. Uses treat_missing_data
# = "breaching" so no metric data (i.e. never invoked) also triggers.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "heloan_decline_digest_missed_schedule" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "lambda-missed-schedule-${module.heloan_decline_digest_lambda.lambda_function_name}"
  alarm_description   = "HELOAN decline digest lambda has not been invoked in the last 25 hours; the daily EventBridge cron is likely broken."
  namespace           = "AWS/Lambda"
  metric_name         = "Invocations"
  statistic           = "Sum"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  period              = 90000 # 25 hours in seconds
  threshold           = 1
  treat_missing_data  = "breaching"
  ok_actions          = []
  alarm_actions       = [module.heloan_decline_digest_alarms_topic[0].topic_arn]
  dimensions = {
    FunctionName = module.heloan_decline_digest_lambda.lambda_function_name
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}
