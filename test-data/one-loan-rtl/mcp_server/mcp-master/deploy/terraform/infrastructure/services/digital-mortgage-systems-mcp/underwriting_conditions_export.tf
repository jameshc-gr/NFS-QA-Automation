locals {
  conditions_export_enabled = var.environment == "prod"
  conditions_export_name    = "mcp-underwriting-conditions-export-${var.environment}"
  conditions_export_bucket  = "${local.conditions_export_name}-${data.aws_caller_identity.current.account_id}"
  conditions_export_tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

data "aws_iam_policy_document" "databricks_conditions_export" {
  count = local.conditions_export_enabled ? 1 : 0

  statement {
    actions   = ["s3:GetBucketLocation"]
    resources = ["arn:aws:s3:::${local.conditions_export_bucket}"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::125302850010:role/databricks-cross-account-role-prod"]
    }
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${local.conditions_export_bucket}"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::125302850010:role/databricks-cross-account-role-prod"]
    }
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["databricks/*"]
    }
  }

  statement {
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${local.conditions_export_bucket}/databricks/*.parquet"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::125302850010:role/databricks-cross-account-role-prod"]
    }
  }
}

module "underwriting_conditions_export_bucket" {
  count                         = local.conditions_export_enabled ? 1 : 0
  source                        = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//s3_bucket?ref=v1.1.75"
  bucket_name                   = local.conditions_export_bucket
  encryption_algorithm          = "AES256"
  object_ownership              = "BucketOwnerEnforced"
  extra_bucket_policies         = [data.aws_iam_policy_document.databricks_conditions_export[0].json]
  enable_default_lifecycle_rule = false
  additional_lifecycle_rules = {
    abort_incomplete_uploads = jsonencode({
      id                                = "abort-incomplete-uploads"
      status                            = "Enabled"
      abort_incomplete_multipart_upload = { days_after_initiation = 7 }
    })
  }
  tags = local.conditions_export_tags
}

data "aws_iam_policy_document" "lambda_conditions_export" {
  count = local.conditions_export_enabled ? 1 : 0

  statement {
    actions   = ["dynamodb:DescribeContinuousBackups", "dynamodb:ExportTableToPointInTime"]
    resources = [aws_dynamodb_table.underwriting_approved_conditions_tasks.arn]
  }

  statement {
    actions   = ["dynamodb:DescribeExport"]
    resources = ["${aws_dynamodb_table.underwriting_approved_conditions_tasks.arn}/export/*"]
  }

  statement {
    actions   = ["s3:AbortMultipartUpload", "s3:GetObject", "s3:PutObject", "s3:PutObjectAcl"]
    resources = ["${module.underwriting_conditions_export_bucket[0].bucket_arn}/exports/*"]
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = [module.underwriting_conditions_export_bucket[0].bucket_arn]
    condition {
      test     = "StringEquals"
      variable = "s3:prefix"
      values   = ["_state/checkpoint.json"]
    }
  }

  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${module.underwriting_conditions_export_bucket[0].bucket_arn}/_state/checkpoint.json"]
  }

  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${module.underwriting_conditions_export_bucket[0].bucket_arn}/databricks/*.parquet"]
  }
}

module "underwriting_conditions_export_lambda" {
  count                         = local.conditions_export_enabled ? 1 : 0
  source                        = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.90"
  name                          = local.conditions_export_name
  handler                       = "lambdas.underwriting_conditions_export.handler.lambda_handler"
  runtime                       = "python3.12"
  source_path                   = "/tmp/mcp-underwriting-conditions-export.zip"
  permissions_boundary_name     = var.permissions_boundary_name
  iam_role_is_assumable_by      = "OnlyThisLambda"
  minimum_available_concurrency = 1
  memory                        = 1024
  timeout                       = 300
  environment_variables = {
    TABLE_ARN     = aws_dynamodb_table.underwriting_approved_conditions_tasks.arn
    EXPORT_BUCKET = module.underwriting_conditions_export_bucket[0].bucket
  }
  inline_policies = {
    conditions_export = data.aws_iam_policy_document.lambda_conditions_export[0].json
  }
  tags = local.conditions_export_tags
}

module "underwriting_conditions_export_alarms_topic" {
  count                       = local.conditions_export_enabled ? 1 : 0
  source                      = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//sns_topic?ref=v1.1.90"
  topic_name                  = "${local.conditions_export_name}-alarms"
  services_allowed_to_publish = ["cloudwatch.amazonaws.com"]
  tags                        = local.conditions_export_tags
}

resource "aws_sns_topic_subscription" "underwriting_conditions_export_alarm_email" {
  for_each  = local.conditions_export_enabled ? toset(var.underwriting_conditions_export_alarm_email_recipients) : toset([])
  topic_arn = module.underwriting_conditions_export_alarms_topic[0].topic_arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "underwriting_conditions_export_errors" {
  count               = local.conditions_export_enabled ? 1 : 0
  alarm_name          = "${local.conditions_export_name}-errors"
  alarm_description   = "The underwriting conditions export Lambda failed; inspect the Lambda logs and export checkpoint."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.underwriting_conditions_export_alarms_topic[0].topic_arn]
  dimensions = {
    FunctionName = module.underwriting_conditions_export_lambda[0].lambda_function_name
  }
  tags = local.conditions_export_tags
}

output "underwriting_conditions_export_bucket" {
  value = one(module.underwriting_conditions_export_bucket[*].bucket)
}

output "underwriting_conditions_export_lambda_arn" {
  value = one(module.underwriting_conditions_export_lambda[*].lambda_arn)
}

output "underwriting_conditions_export_lambda_name" {
  value = one(module.underwriting_conditions_export_lambda[*].lambda_function_name)
}
