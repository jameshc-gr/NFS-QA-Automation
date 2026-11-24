data "aws_caller_identity" "current" {}

data "aws_vpc" "vpc" {
  filter {
    name   = "tag:Name"
    values = ["${var.vpc_name}"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.vpc.id]
  }
  filter {
    name   = "tag:Name"
    values = ["*private*"]
  }
}

data "aws_iam_policy_document" "secrets" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetRandomPassword",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecretVersionIds",
      "secretsmanager:ListSecrets",
      "secretsmanager:BatchGetSecretValue"
    ]
    resources = ["arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}*"]
  }

}

data "aws_iam_policy_document" "doc_extraction_centralized_dynamodb" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:Query", "dynamodb:GetItem"]
    resources = [
      "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/document_extraction_centralized",
      "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/document_extraction_centralized/index/*",
    ]
  }
}

module "k8s_iam_role" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//kubernetes_iam_service_account?ref=v1.1.60"
  namespace                 = var.eks_namespace
  oidc_arn                  = var.oidc_arn
  permissions_boundary_name = var.permissions_boundary_name
  service_account_name      = local.service_account_name
  inline_policies = {
    "secrets"                       = data.aws_iam_policy_document.secrets.json
    "doc_extraction_centralized_db" = data.aws_iam_policy_document.doc_extraction_centralized_dynamodb.json
  }
  tags = module.tagging.value
}

module "tagging" {
  source           = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//tagging?ref=v1.1.60"
  business_contact = var.tag_business_contact
  business_owner   = var.tag_business_owner
  code_repo        = var.tag_code_repo
  criticality      = var.tag_criticality
  environment      = var.environment
  product          = var.tag_product
  public_facing    = var.tag_public_facing
  retirement_date  = var.tag_retirement_date
  tech_contact     = var.tag_tech_contact
}

resource "aws_acm_certificate" "digital_mortgage_systems_mcp" {
  domain_name       = local.common_name_digital_mortgage_systems_mcp
  validation_method = "DNS"
  tags              = merge(module.tagging.value, { "PermissionsBoundary" = var.permissions_boundary_name })
  lifecycle {
    create_before_destroy = true
  }
}

locals {
  service_account_name                     = "${var.app_name}-${var.environment}"
  common_name_digital_mortgage_systems_mcp = "${var.sub_domain_name}-${var.environment}.${var.route53_zone_name}"
}

data "aws_iam_policy_document" "lambda_secrets" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetRandomPassword",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecretVersionIds",
      "secretsmanager:ListSecrets",
      "secretsmanager:BatchGetSecretValue"
    ]
    resources = ["arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}*"]
  }
}

data "aws_iam_policy_document" "lambda_idempotency" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:PutItem"
    ]
    resources = [aws_dynamodb_table.underwriting_approved_idempotency.arn]
  }
}

data "aws_iam_policy_document" "lambda_uw_tasks" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:PutItem"
    ]
    resources = [aws_dynamodb_table.underwriting_approved_tasks.arn]
  }
}

resource "aws_dynamodb_table" "underwriting_approved_tasks" {
  name         = "mcp-underwriting-tasks-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"
  range_key    = "created_at"

  attribute {
    name = "loan_number"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

data "aws_iam_policy_document" "lambda_uw_conditions_tasks" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:BatchWriteItem"
    ]
    resources = [aws_dynamodb_table.underwriting_approved_conditions_tasks.arn]
  }
}

# One row per underwriting condition on the loan (including conditions filtered out
# before ever reaching Prajna), joined with any task generated from that condition.
resource "aws_dynamodb_table" "underwriting_approved_conditions_tasks" {
  name         = "mcp-underwriting-conditions-to-tasks-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"
  range_key    = "row_id"

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  attribute {
    name = "loan_number"
    type = "S"
  }

  attribute {
    name = "row_id"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "underwriting_approved_idempotency" {
  name         = "mcp-underwriting-approved-idempotency-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "underwriting_credit_inquiry_tasks" {
  name         = "mcp-underwriting-credit-inquiry-tasks-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

data "aws_iam_policy_document" "lambda_underwriting_credit_inquiry_tasks" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:DeleteItem", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.underwriting_credit_inquiry_tasks.arn]
  }
}

resource "aws_dynamodb_table" "lambda_1003_scheduling" {
  name         = "mcp-1003-scheduling-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "lambda_1003_resolved_fields" {
  name         = "mcp-1003-resolved-fields-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

# Accumulates HELOAN decline decisions (and a pointer to their PDF report in S3) so a
# single digest email can be sent daily instead of one email per decline.
resource "aws_dynamodb_table" "heloan_decline_queue" {
  name         = "mcp-heloan-decline-queue-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

# One row per HELOAN credit decision: a readable audit trail and the deduplication
# guard against duplicate credit-order-ref-num-changed events for the same loan.
# The credit reference is stored verbatim; a reissue (which appends 'R') looks up the
# reference it derives from to detect that the original event already ran.
resource "aws_dynamodb_table" "heloan_decisions" {
  name         = "mcp-heloan-decisions-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"
  range_key    = "credit_reference_identifier"

  attribute {
    name = "loan_number"
    type = "S"
  }

  attribute {
    name = "credit_reference_identifier"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_decline_pdf_bucket" {
  source      = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//s3_bucket?ref=v1.1.75"
  bucket_name = "mcp-heloan-decline-pdfs-${var.environment}"
  # Safety net in case the digest lambda fails to clean up after sending; entries are
  # normally deleted immediately after being included in the daily digest email.
  additional_lifecycle_rules = {
    "expire-stale-decline-pdfs" = jsonencode({
      id     = "expire-stale-decline-pdfs"
      status = "Enabled"
      expiration = {
        days = 7
      }
    })
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_pipeline_assignment_pdfs_bucket" {
  source                        = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//s3_bucket?ref=v1.1.75"
  bucket_name                   = "mcp-heloan-pipeline-assignment-pdfs-${var.environment}"
  enable_default_lifecycle_rule = false
  additional_lifecycle_rules = {
    abort-incomplete-multipart-uploads = jsonencode({
      id     = "abort-incomplete-multipart-uploads"
      status = "Enabled"
      abort_incomplete_multipart_upload = {
        days_after_initiation = 7
      }
    })
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_processor_first_review_pdfs_bucket" {
  source                        = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//s3_bucket?ref=v1.1.75"
  bucket_name                   = "mcp-heloan-first-review-decision-pdfs-${var.environment}"
  enable_default_lifecycle_rule = false
  additional_lifecycle_rules = {
    abort-incomplete-multipart-uploads = jsonencode({
      id     = "abort-incomplete-multipart-uploads"
      status = "Enabled"
      abort_incomplete_multipart_upload = {
        days_after_initiation = 7
      }
    })
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_uw_roster_bucket" {
  source      = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//s3_bucket?ref=v1.1.75"
  bucket_name = "mcp-heloan-uw-roster-${var.environment}"
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_uw_roster" {
  name         = "mcp-heloan-uw-roster-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Encompass User ID"

  attribute {
    name = "Encompass User ID"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_processor_roster" {
  name         = "mcp-heloan-processor-roster-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Encompass User ID"

  attribute {
    name = "Encompass User ID"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_cc_roster" {
  name         = "mcp-heloan-cc-roster-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Encompass User ID"

  attribute {
    name = "Encompass User ID"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

data "aws_iam_policy_document" "lambda_heloan_uw_roster_sync" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:PutItem", "dynamodb:BatchWriteItem", "dynamodb:Scan", "dynamodb:DeleteItem", "dynamodb:UpdateItem"]
    resources = [
      aws_dynamodb_table.heloan_uw_roster.arn,
      aws_dynamodb_table.heloan_processor_roster.arn,
      aws_dynamodb_table.heloan_cc_roster.arn,
    ]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${module.heloan_uw_roster_bucket.bucket_arn}/*"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_pipeline_assignment_uw_roster_read" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:UpdateItem"]
    resources = [
      aws_dynamodb_table.heloan_uw_roster.arn,
      aws_dynamodb_table.heloan_processor_roster.arn,
      aws_dynamodb_table.heloan_cc_roster.arn,
    ]
  }
}

data "aws_iam_policy_document" "lambda_heloan_pipeline_assignment_pdfs_write" {
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${module.heloan_pipeline_assignment_pdfs_bucket.bucket_arn}/*"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_uw_roster_reset_daily_assignment_pdfs_read" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${module.heloan_pipeline_assignment_pdfs_bucket.bucket_arn}/*"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_uw_roster_reset_daily_first_review_read" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:Query"]
    resources = [
      "${aws_dynamodb_table.heloan_processor_first_review_audit.arn}/index/audit_date-created_at-index",
    ]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${module.heloan_processor_first_review_pdfs_bucket.bucket_arn}/*"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_decline_queue_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.heloan_decline_queue.arn]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${module.heloan_decline_pdf_bucket.bucket_arn}/*"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_decline_queue_read" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:Scan", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.heloan_decline_queue.arn]
  }
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:DeleteObject"]
    resources = ["${module.heloan_decline_pdf_bucket.bucket_arn}/*"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_decisions_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.heloan_decisions.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_flowstate_invoke" {
  statement {
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = ["arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:flowstate-intel-milestone-${var.environment}"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_flowstate_whitelist_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.heloan_flowstate_whitelist.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_pipeline_assignment_invoke" {
  statement {
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = ["arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:mcp-heloan-pipeline-assignment-${var.environment}"]
  }
}

data "aws_iam_policy_document" "lambda_heloan_first_review_invoke" {
  statement {
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = ["arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:mcp-heloan-processor-first-review-${var.environment}"]
  }
}

data "aws_iam_policy_document" "lambda_1003_dynamodb" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [
      aws_dynamodb_table.lambda_1003_scheduling.arn,
      aws_dynamodb_table.lambda_1003_resolved_fields.arn,
    ]
  }
}

data "aws_iam_policy_document" "lambda_1003_scheduler" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:Scan"]
    resources = [aws_dynamodb_table.lambda_1003_scheduling.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_uw_roster_reset_daily" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:Scan", "dynamodb:UpdateItem"]
    resources = [
      aws_dynamodb_table.heloan_uw_roster.arn,
      aws_dynamodb_table.heloan_processor_roster.arn,
      aws_dynamodb_table.heloan_cc_roster.arn,
    ]
  }
}

data "aws_iam_policy_document" "lambda_heloan_uw_roster_reset_daily_audit_read" {
  statement {
    effect  = "Allow"
    actions = ["dynamodb:Query"]
    resources = [
      aws_dynamodb_table.heloan_pipeline_assignment_audit.arn,
      "${aws_dynamodb_table.heloan_pipeline_assignment_audit.arn}/index/assignment_date-created_at-index",
    ]
  }
}

module "lambda_1003" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-1003-${var.environment}"
  handler                   = "lambdas.loan_1003.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-1003.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME            = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                = var.environment
    SCHEDULING_TABLE_NAME      = aws_dynamodb_table.lambda_1003_scheduling.name
    RESOLVED_FIELDS_TABLE_NAME = aws_dynamodb_table.lambda_1003_resolved_fields.name
  }
  inline_policies = {
    "secrets"   = data.aws_iam_policy_document.lambda_secrets.json
    "dynamodb"  = data.aws_iam_policy_document.lambda_1003_dynamodb.json
    "scheduler" = data.aws_iam_policy_document.lambda_1003_scheduler.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "underwriting_approved_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-underwriting-approved-${var.environment}"
  handler                   = "lambdas.underwriting_approved.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-underwriting-approved.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME                   = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    IDEMPOTENCY_TABLE_NAME            = aws_dynamodb_table.underwriting_approved_idempotency.name
    UW_TASKS_TABLE_NAME               = aws_dynamodb_table.underwriting_approved_tasks.name
    UW_CONDITIONS_TO_TASKS_TABLE_NAME = aws_dynamodb_table.underwriting_approved_conditions_tasks.name
    ENVIRONMENT                       = var.environment
  }
  inline_policies = {
    "secrets"                      = data.aws_iam_policy_document.lambda_secrets.json
    "idempotency_dynamodb"         = data.aws_iam_policy_document.lambda_idempotency.json
    "uw_tasks_dynamodb"            = data.aws_iam_policy_document.lambda_uw_tasks.json
    "uw_conditions_tasks_dynamodb" = data.aws_iam_policy_document.lambda_uw_conditions_tasks.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "underwriting_credit_inquiry_task_automation_lambda" {
  source                     = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                       = "mcp-underwriting-credit-inquiry-task-automation-${var.environment}"
  handler                    = "lambdas.underwriting_credit_inquiry_task_automation.handler.lambda_handler"
  runtime                    = "python3.12"
  source_path                = "/tmp/mcp-underwriting-credit-inquiry-task-automation.zip"
  permissions_boundary_name  = var.permissions_boundary_name
  subnet_ids                 = [for s in data.aws_subnets.private.ids : s]
  alarm_notification_arns    = []
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  environment_variables = {
    AWS_SECRET_NAME                = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                    = var.environment
    CREDIT_INQUIRY_TASK_TABLE_NAME = aws_dynamodb_table.underwriting_credit_inquiry_tasks.name
  }
  inline_policies = {
    "secrets"                       = data.aws_iam_policy_document.lambda_secrets.json
    "credit_inquiry_tasks_dynamodb" = data.aws_iam_policy_document.lambda_underwriting_credit_inquiry_tasks.json
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-heloan-${var.environment}"
  handler                   = "lambdas.heloan.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-heloan.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME                 = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                     = var.environment
    FLOWSTATE_LAMBDA_NAME           = "flowstate-intel-milestone-${var.environment}"
    PIPELINE_ASSIGNMENT_LAMBDA_NAME = "mcp-heloan-pipeline-assignment-${var.environment}"
    DECLINE_QUEUE_TABLE_NAME        = aws_dynamodb_table.heloan_decline_queue.name
    DECLINE_PDF_BUCKET_NAME         = module.heloan_decline_pdf_bucket.bucket
    HELOAN_DECISIONS_TABLE_NAME     = aws_dynamodb_table.heloan_decisions.name
  }
  inline_policies = {
    "secrets"                    = data.aws_iam_policy_document.lambda_secrets.json
    "decline_queue_write"        = data.aws_iam_policy_document.lambda_heloan_decline_queue_write.json
    "decisions_write"            = data.aws_iam_policy_document.lambda_heloan_decisions_write.json
    "flowstate_lambda_invoke"    = data.aws_iam_policy_document.lambda_heloan_flowstate_invoke.json
    "pipeline_assignment_invoke" = data.aws_iam_policy_document.lambda_heloan_pipeline_assignment_invoke.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  # Require several throttles over a longer window before alerting, so brief
  # concurrency spikes don't email the team.
  throttles_evaluation_period   = 900
  excessive_throttles_in_period = 10
  alarm_notification_arns       = var.environment == "prod" ? [module.heloan_alarms_topic[0].topic_arn] : []
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_title_company_update_lambda" {
  source                     = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                       = "mcp-heloan-title-company-update-${var.environment}"
  handler                    = "lambdas.heloan_title_company_update.handler.lambda_handler"
  runtime                    = "python3.12"
  source_path                = "/tmp/mcp-heloan-title-company-update.zip"
  permissions_boundary_name  = var.permissions_boundary_name
  subnet_ids                 = [for s in data.aws_subnets.private.ids : s]
  alarm_notification_arns    = var.environment == "prod" ? [module.heloan_title_company_update_alarms_topic[0].topic_arn] : []
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  environment_variables = {
    AWS_SECRET_NAME                       = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                           = var.environment
    TITLE_COMPANY_UPDATE_AUDIT_TABLE_NAME = aws_dynamodb_table.heloan_title_company_update_audit.name
  }
  inline_policies = {
    "secrets"     = data.aws_iam_policy_document.lambda_secrets.json
    "audit_write" = data.aws_iam_policy_document.lambda_heloan_title_company_update_audit_write.json
  }
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_pipeline_assignment_lambda" {
  source                        = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                          = "mcp-heloan-pipeline-assignment-${var.environment}"
  handler                       = "lambdas.heloan_pipeline_assignment.handler.lambda_handler"
  runtime                       = "python3.12"
  source_path                   = "/tmp/mcp-heloan-pipeline-assignment.zip"
  minimum_available_concurrency = 1
  permissions_boundary_name     = var.permissions_boundary_name
  subnet_ids                    = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    ASSIGNMENT_AUDIT_TABLE_NAME          = aws_dynamodb_table.heloan_pipeline_assignment_audit.name
    ASSIGNMENT_LOCK_TABLE_NAME           = aws_dynamodb_table.heloan_assignment_lock.name
    ASSIGNMENT_PDF_BUCKET_NAME           = module.heloan_pipeline_assignment_pdfs_bucket.bucket
    AWS_SECRET_NAME                      = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                          = var.environment
    FIRST_REVIEW_LAMBDA_NAME             = "mcp-heloan-processor-first-review-${var.environment}"
    FLOWSTATE_LAMBDA_NAME                = "flowstate-intel-milestone-${var.environment}"
    FLOWSTATE_WHITELIST_TABLE_NAME       = aws_dynamodb_table.heloan_flowstate_whitelist.name
    UW_ROSTER_TABLE_NAME                 = aws_dynamodb_table.heloan_uw_roster.name
    PROCESSOR_ROSTER_TABLE_NAME          = aws_dynamodb_table.heloan_processor_roster.name
    CC_ROSTER_TABLE_NAME                 = aws_dynamodb_table.heloan_cc_roster.name
    ASSIGN_ROLES_IN_ONELOAN              = "true"
    PIPELINE_ASSIGNMENT_ALERT_RECIPIENTS = "Boyang.Zhao@rate.com,Brian.Neff@rate.com,Matt.Fine@rate.com,andrew.levy@rate.com,Mitch.Michels@rate.com"
  }
  inline_policies = {
    "secrets"                    = data.aws_iam_policy_document.lambda_secrets.json
    "uw_roster"                  = data.aws_iam_policy_document.lambda_heloan_pipeline_assignment_uw_roster_read.json
    "assignment_audit"           = data.aws_iam_policy_document.lambda_heloan_pipeline_assignment_audit_write.json
    "assignment_lock"            = data.aws_iam_policy_document.lambda_heloan_pipeline_assignment_lock_write.json
    "assignment_pdfs"            = data.aws_iam_policy_document.lambda_heloan_pipeline_assignment_pdfs_write.json
    "first_review_lambda_invoke" = data.aws_iam_policy_document.lambda_heloan_first_review_invoke.json
    "flowstate_lambda_invoke"    = data.aws_iam_policy_document.lambda_heloan_flowstate_invoke.json
    "flowstate_whitelist_write"  = data.aws_iam_policy_document.lambda_heloan_flowstate_whitelist_write.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  alarm_notification_arns    = var.environment == "prod" ? [module.heloan_pipeline_alarms_topic[0].topic_arn] : []
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_processor_first_review_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-heloan-processor-first-review-${var.environment}"
  handler                   = "lambdas.heloan_processor_first_review.handler.lambda_handler"
  runtime                   = "python3.12"
  timeout                   = 900
  source_path               = "/tmp/mcp-heloan-processor-first-review.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME               = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                   = var.environment
    FIRST_REVIEW_LOCK_TABLE_NAME  = aws_dynamodb_table.heloan_processor_first_review_lock.name
    FIRST_REVIEW_AUDIT_TABLE_NAME = aws_dynamodb_table.heloan_processor_first_review_audit.name
    FIRST_REVIEW_PDF_BUCKET_NAME  = module.heloan_processor_first_review_pdfs_bucket.bucket
  }
  inline_policies = {
    "secrets"            = data.aws_iam_policy_document.lambda_secrets.json
    "first_review_lock"  = data.aws_iam_policy_document.lambda_heloan_processor_first_review_lock_write.json
    "first_review_audit" = data.aws_iam_policy_document.lambda_heloan_processor_first_review_audit_write.json
    "first_review_pdf"   = data.aws_iam_policy_document.lambda_heloan_processor_first_review_pdf_write.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  alarm_notification_arns    = var.environment == "prod" ? [module.heloan_pipeline_alarms_topic[0].topic_arn] : []
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

data "aws_iam_policy_document" "lambda_heloan_milestone_move_first_review_read" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem",
    ]
    resources = [
      aws_dynamodb_table.heloan_processor_first_review_audit.arn,
    ]
  }
  statement {
    effect  = "Allow"
    actions = ["dynamodb:Query", "dynamodb:Scan"]
    resources = [
      "${aws_dynamodb_table.heloan_processor_first_review_audit.arn}/index/audit_date-created_at-index",
    ]
  }
}

data "aws_iam_policy_document" "lambda_heloan_milestone_move_first_review_pdf_read" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${module.heloan_processor_first_review_pdfs_bucket.bucket_arn}/*"]
  }
}

module "heloan_milestone_move_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.90"
  name                      = "mcp-heloan-milestone-move-${var.environment}"
  handler                   = "lambdas.heloan_milestone_move.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-heloan-milestone-move.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME               = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                   = var.environment
    FIRST_REVIEW_AUDIT_TABLE_NAME = aws_dynamodb_table.heloan_processor_first_review_audit.name
    FIRST_REVIEW_PDF_BUCKET_NAME  = module.heloan_processor_first_review_pdfs_bucket.bucket
  }
  inline_policies = {
    "secrets"                 = data.aws_iam_policy_document.lambda_secrets.json
    "first_review_audit_read" = data.aws_iam_policy_document.lambda_heloan_milestone_move_first_review_read.json
    "first_review_pdf_read"   = data.aws_iam_policy_document.lambda_heloan_milestone_move_first_review_pdf_read.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  alarm_notification_arns    = var.environment == "prod" ? [module.heloan_pipeline_alarms_topic[0].topic_arn] : []
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_decline_digest_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-heloan-decline-digest-${var.environment}"
  handler                   = "lambdas.heloan_decline_digest.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-heloan-decline-digest.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME           = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT               = var.environment
    DECLINE_QUEUE_TABLE_NAME  = aws_dynamodb_table.heloan_decline_queue.name
    DECLINE_PDF_BUCKET_NAME   = module.heloan_decline_pdf_bucket.bucket
    DECLINE_DIGEST_RECIPIENTS = join(",", var.heloan_decline_digest_recipients)
    PASS_DIGEST_RECIPIENTS    = join(",", var.heloan_pass_digest_recipients)
  }
  inline_policies = {
    "secrets"            = data.aws_iam_policy_document.lambda_secrets.json
    "decline_queue_read" = data.aws_iam_policy_document.lambda_heloan_decline_queue_read.json
  }
  alarm_notification_arns    = []
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_uw_roster_sync_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-heloan-uw-roster-sync-${var.environment}"
  handler                   = "lambdas.heloan_uw_roster_sync.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-heloan-uw-roster-sync.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME             = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                 = var.environment
    UW_ROSTER_TABLE_NAME        = aws_dynamodb_table.heloan_uw_roster.name
    PROCESSOR_ROSTER_TABLE_NAME = aws_dynamodb_table.heloan_processor_roster.name
    CC_ROSTER_TABLE_NAME        = aws_dynamodb_table.heloan_cc_roster.name
    UW_ROSTER_BUCKET_NAME       = module.heloan_uw_roster_bucket.bucket
  }
  inline_policies = {
    "secrets"   = data.aws_iam_policy_document.lambda_secrets.json
    "uw_roster" = data.aws_iam_policy_document.lambda_heloan_uw_roster_sync.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  alarm_notification_arns    = var.environment == "prod" ? [module.heloan_pipeline_alarms_topic[0].topic_arn] : []
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

module "heloan_uw_roster_reset_daily_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-heloan-uw-roster-reset-daily-${var.environment}"
  handler                   = "lambdas.heloan_uw_roster_reset_daily.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-heloan-uw-roster-reset-daily.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    ASSIGNMENT_AUDIT_TABLE_NAME           = aws_dynamodb_table.heloan_pipeline_assignment_audit.name
    ASSIGNMENT_PDF_BUCKET_NAME            = module.heloan_pipeline_assignment_pdfs_bucket.bucket
    FIRST_REVIEW_AUDIT_TABLE_NAME         = aws_dynamodb_table.heloan_processor_first_review_audit.name
    FIRST_REVIEW_PDF_BUCKET_NAME          = module.heloan_processor_first_review_pdfs_bucket.bucket
    AWS_SECRET_NAME                       = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT                           = var.environment
    HELOAN_UW_ROSTER_TABLE_NAME           = aws_dynamodb_table.heloan_uw_roster.name
    HELOAN_PROCESSOR_ROSTER_TABLE_NAME    = aws_dynamodb_table.heloan_processor_roster.name
    HELOAN_CC_ROSTER_TABLE_NAME           = aws_dynamodb_table.heloan_cc_roster.name
    PIPELINE_ASSIGNMENT_DIGEST_RECIPIENTS = "Boyang.Zhao@rate.com,Brian.Neff@rate.com,Matt.Fine@rate.com,andrew.levy@rate.com,Mitch.Michels@rate.com,Matt.Kramer@rate.com"
  }
  inline_policies = {
    "secrets"          = data.aws_iam_policy_document.lambda_secrets.json
    "uw_roster_reset"  = data.aws_iam_policy_document.lambda_heloan_uw_roster_reset_daily.json
    "assignment_audit" = data.aws_iam_policy_document.lambda_heloan_uw_roster_reset_daily_audit_read.json
    "assignment_pdfs"  = data.aws_iam_policy_document.lambda_heloan_uw_roster_reset_daily_assignment_pdfs_read.json
    "first_review"     = data.aws_iam_policy_document.lambda_heloan_uw_roster_reset_daily_first_review_read.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  alarm_notification_arns    = var.environment == "prod" ? [module.heloan_pipeline_alarms_topic[0].topic_arn] : []
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

# ListMetrics and GetMetricData do not support resource-level permissions.
data "aws_iam_policy_document" "lambda_usage_digest_cloudwatch_read" {
  statement {
    effect    = "Allow"
    actions   = ["cloudwatch:ListMetrics", "cloudwatch:GetMetricData"]
    resources = ["*"]
  }
}

module "usage_digest_lambda" {
  source                    = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.75"
  name                      = "mcp-usage-digest-${var.environment}"
  handler                   = "lambdas.usage_digest.handler.lambda_handler"
  runtime                   = "python3.12"
  source_path               = "/tmp/mcp-usage-digest.zip"
  permissions_boundary_name = var.permissions_boundary_name
  subnet_ids                = [for s in data.aws_subnets.private.ids : s]
  environment_variables = {
    AWS_SECRET_NAME         = "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-${var.environment}"
    ENVIRONMENT             = var.environment
    USAGE_DIGEST_RECIPIENTS = join(",", var.usage_digest_recipients)
  }
  inline_policies = {
    "secrets"         = data.aws_iam_policy_document.lambda_secrets.json
    "cloudwatch_read" = data.aws_iam_policy_document.lambda_usage_digest_cloudwatch_read.json
  }
  errors_evaluation_period   = local.lambda_errors_evaluation_period
  excessive_errors_in_period = local.lambda_excessive_errors_in_period
  alarm_notification_arns    = var.environment == "prod" ? [module.usage_digest_alarms_topic[0].topic_arn] : []
  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

# S3 -> Lambda trigger: fires the sync lambda whenever a new roster object is uploaded.
resource "aws_lambda_permission" "allow_s3_heloan_uw_roster" {
  statement_id  = "AllowS3InvokeUwRosterSync"
  action        = "lambda:InvokeFunction"
  function_name = module.heloan_uw_roster_sync_lambda.lambda_function_name
  principal     = "s3.amazonaws.com"
  source_arn    = module.heloan_uw_roster_bucket.bucket_arn
}

resource "aws_s3_bucket_notification" "heloan_uw_roster" {
  bucket = module.heloan_uw_roster_bucket.bucket

  lambda_function {
    lambda_function_arn = module.heloan_uw_roster_sync_lambda.lambda_arn
    events              = ["s3:ObjectCreated:Put"]
  }

  depends_on = [aws_lambda_permission.allow_s3_heloan_uw_roster]
}

resource "aws_dynamodb_table" "heloan_flowstate_whitelist" {
  name         = "mcp-heloan-flowstate-whitelist-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_pipeline_assignment_audit" {
  name         = "mcp-heloan-pipeline-assignment-audit-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "N"
  }
  attribute {
    name = "assignment_date"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "assignment_date-created_at-index"
    hash_key        = "assignment_date"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_processor_first_review_audit" {
  name         = "mcp-heloan-processor-first-review-audit-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "N"
  }
  attribute {
    name = "audit_date"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "audit_date-created_at-index"
    hash_key        = "audit_date"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_title_company_update_audit" {
  name         = "mcp-heloan-title-company-update-audit-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "N"
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_assignment_lock" {
  name         = "mcp-heloan-assignment-lock-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

resource "aws_dynamodb_table" "heloan_processor_first_review_lock" {
  name         = "mcp-heloan-processor-first-review-lock-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "loan_number"

  attribute {
    name = "loan_number"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = merge(module.tagging.value, {
    JV   = "multitenant"
    team = "ag-datadog-digitalmortgage"
  })
}

data "aws_iam_policy_document" "lambda_heloan_pipeline_assignment_audit_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.heloan_pipeline_assignment_audit.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_pipeline_assignment_lock_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.heloan_assignment_lock.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_processor_first_review_lock_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.heloan_processor_first_review_lock.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_processor_first_review_audit_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.heloan_processor_first_review_audit.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_title_company_update_audit_write" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.heloan_title_company_update_audit.arn]
  }
}

data "aws_iam_policy_document" "lambda_heloan_processor_first_review_pdf_write" {
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${module.heloan_processor_first_review_pdfs_bucket.bucket_arn}/*"]
  }
}
