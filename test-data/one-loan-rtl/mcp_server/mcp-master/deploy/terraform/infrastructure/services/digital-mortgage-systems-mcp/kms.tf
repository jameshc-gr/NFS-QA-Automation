data "aws_iam_policy_document" "kms_key" {
  statement {
    sid       = "Enable Root Account Access"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root", ]
    }
  }

  statement {
    sid    = "Permitted Principals"
    effect = "Deny"
    actions = [
      "kms:Encrypt",
      "kms:Decrypt"
    ]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    resources = ["*"]
    condition {
      test     = "ArnNotLike"
      variable = "aws:PrincipalArn"
      values = concat(
        [module.k8s_iam_role.role_arn],
        [module.underwriting_approved_lambda.role.role_arn],
        [module.underwriting_credit_inquiry_task_automation_lambda.role.role_arn],
        [module.lambda_1003.role.role_arn],
        [module.heloan_lambda.role.role_arn],
        [module.heloan_title_company_update_lambda.role.role_arn],
        [module.heloan_pipeline_assignment_lambda.role.role_arn],
        [module.heloan_processor_first_review_lambda.role.role_arn],
        [module.heloan_milestone_move_lambda.role.role_arn],
        [module.heloan_decline_digest_lambda.role.role_arn],
        [module.heloan_uw_roster_sync_lambda.role.role_arn],
        [module.heloan_uw_roster_reset_daily_lambda.role.role_arn],
        [module.usage_digest_lambda.role.role_arn],
        var.additional_allowed_principles
      )
    }
  }
}

resource "aws_kms_key" "secret_encryption" {
  description             = "${var.app_name}-secrets-${var.environment}"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.kms_key.json
  tags                    = module.tagging.value
}

resource "aws_kms_alias" "secret_encryption" {
  name          = "alias/secrets-manager-${var.app_name}-${var.environment}"
  target_key_id = aws_kms_key.secret_encryption.key_id
}

resource "aws_kms_grant" "role" {
  name              = "grant-role-${var.app_name}-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.k8s_iam_role.role_arn
  operations        = ["Encrypt", "Decrypt", "GenerateDataKey", "DescribeKey"]
}

resource "aws_kms_grant" "underwriting_approved_lambda_role" {
  name              = "grant-lambda-underwriting-approved-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.underwriting_approved_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "underwriting_credit_inquiry_task_automation_lambda_role" {
  name              = "grant-lambda-underwriting-credit-inquiry-task-automation-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.underwriting_credit_inquiry_task_automation_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "lambda_1003_role" {
  name              = "grant-lambda-1003-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.lambda_1003.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_lambda_role" {
  name              = "grant-lambda-heloan-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_title_company_update_lambda_role" {
  name              = "grant-lambda-heloan-title-company-update-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_title_company_update_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_pipeline_assignment_lambda_role" {
  name              = "grant-lambda-heloan-pipeline-assignment-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_pipeline_assignment_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_processor_first_review_lambda_role" {
  name              = "grant-lambda-heloan-processor-first-review-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_processor_first_review_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_milestone_move_lambda_role" {
  name              = "grant-lambda-heloan-milestone-move-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_milestone_move_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_decline_digest_lambda_role" {
  name              = "grant-lambda-heloan-decline-digest-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_decline_digest_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_uw_roster_sync_lambda_role" {
  name              = "grant-lambda-heloan-uw-roster-sync-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_uw_roster_sync_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "heloan_uw_roster_reset_daily_lambda_role" {
  name              = "grant-lambda-heloan-uw-roster-reset-daily-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.heloan_uw_roster_reset_daily_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}

resource "aws_kms_grant" "usage_digest_lambda_role" {
  name              = "grant-lambda-usage-digest-${var.environment}"
  key_id            = aws_kms_key.secret_encryption.key_id
  grantee_principal = module.usage_digest_lambda.role.role_arn
  operations        = ["Decrypt", "DescribeKey"]
}
