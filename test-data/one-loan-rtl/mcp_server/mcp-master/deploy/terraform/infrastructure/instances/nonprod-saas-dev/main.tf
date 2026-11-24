terraform {
  backend "s3" {
    bucket         = "rate-platform"
    dynamodb_table = "terraform-state-lock"
    key            = "digital-mortgage-systems-mcp/instances/nonprod-saas-dev/terraform.tfstate"
    region         = "us-east-1"
    assume_role = {
      role_arn = "arn:aws:iam::800864774051:role/TerraformDeployer"
    }
    profile = "nonprod-saas-MachineLearning"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.16.0"
    }
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "nonprod-saas-MachineLearning"
}

data "aws_eks_cluster_auth" "auth" {
  name = "nonprod-saas"
}

data "aws_eks_cluster" "cluster" {
  name = "nonprod-saas"
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.auth.token
}

module "digital_mortgage_systems_mcp" {
  source                           = "../../services/digital-mortgage-systems-mcp"
  oidc_arn                         = "arn:aws:iam::336015931235:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/E3ED1CCF7B42558FC966375CCAAA85E2"
  environment                      = "dev"
  vpc_name                         = "rate-saas-dev-vpc"
  route53_zone_name                = "dev.saas.rate.com"
  additional_allowed_principles    = ["arn:aws:iam::336015931235:role/aws-reserved/sso.amazonaws.com/AWSReservedSSO_MachineLearning*"]
  heloan_decline_digest_recipients = ["Arwen.Nanson@rate.com", "Mitch.Michels@rate.com"]
  heloan_pass_digest_recipients    = ["Arwen.Nanson@rate.com"]
  usage_digest_recipients          = ["Boyang.Zhao@rate.com"]
}

# K8s Secret consumed by the MCP deployment as REDIS_URL env var
resource "kubernetes_secret_v1" "mcp_cache_config" {
  metadata {
    name      = "mcp-cache-config"
    namespace = "digital-mortgage-systems-mcp"
  }

  data = {
    REDIS_URL = "redis://${module.digital_mortgage_systems_mcp.redis_primary_endpoint}:6379/0"
  }
}

module "underwriting-approved" {
  source      = "git@github.com:Guaranteed-Rate/erc//terraform/modules/eventbridge_rule?ref=latest"
  name        = "mcp-underwriting-approved-rule"
  description = "Fires when the underwriting approved event occurs"
  event_pattern = jsonencode({
    detail = {
      eventName = ["underwriting-approved"]
    }
  })
}

data "aws_caller_identity" "current" {}

resource "aws_cloudwatch_event_target" "underwriting_approved" {
  rule           = module.underwriting-approved.name
  arn            = module.digital_mortgage_systems_mcp.underwriting_approved_lambda_arn
  event_bus_name = "erc_events_bus"
}

resource "aws_lambda_permission" "allow_eventbridge_underwriting_approved" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.underwriting_approved_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = "arn:aws:events:us-east-1:${data.aws_caller_identity.current.account_id}:rule/erc_events_bus/mcp-underwriting-approved-rule"
}

module "underwriting_credit_inquiry_task_automation" {
  source         = "git@github.com:Guaranteed-Rate/erc//terraform/modules/eventbridge_rule?ref=latest"
  name           = "mcp-underwriting-credit-inquiry-task-automation-rule-dev"
  description    = "Fires when the credit order reference number changes"
  event_bus_name = "erc_events_bus"
  event_pattern = jsonencode({
    detail = {
      eventName = ["credit-order-ref-num-changed"]
    }
  })
}

resource "aws_cloudwatch_event_target" "underwriting_credit_inquiry_task_automation" {
  rule           = module.underwriting_credit_inquiry_task_automation.name
  arn            = module.digital_mortgage_systems_mcp.underwriting_credit_inquiry_task_automation_lambda_arn
  event_bus_name = "erc_events_bus"
}

resource "aws_lambda_permission" "allow_eventbridge_underwriting_credit_inquiry_task_automation" {
  statement_id  = "AllowEventBridgeInvokeUnderwritingCreditInquiryTaskAutomation"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.underwriting_credit_inquiry_task_automation_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = "arn:aws:events:us-east-1:${data.aws_caller_identity.current.account_id}:rule/erc_events_bus/mcp-underwriting-credit-inquiry-task-automation-rule-dev"
}

module "extraction_completed_1003" {
  source         = "git@github.com:Guaranteed-Rate/erc//terraform/modules/eventbridge_rule?ref=latest"
  name           = "mcp-1003-extraction-completed-rule"
  description    = "Fires when the 1003 extraction agent completes"
  event_bus_name = "erc_events_bus"
  event_pattern = jsonencode({
    source      = ["document_extraction.1003_agent"]
    detail-type = ["ExtractionCompleted"]
  })
}

resource "aws_cloudwatch_event_target" "extraction_completed" {
  rule           = module.extraction_completed_1003.name
  arn            = module.digital_mortgage_systems_mcp.lambda_1003_arn
  event_bus_name = "erc_events_bus"
}

resource "aws_lambda_permission" "allow_eventbridge_extraction_completed" {
  statement_id  = "AllowEventBridgeInvokeExtractionCompleted"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.lambda_1003_name
  principal     = "events.amazonaws.com"
  source_arn    = "arn:aws:events:us-east-1:${data.aws_caller_identity.current.account_id}:rule/erc_events_bus/mcp-1003-extraction-completed-rule"
}

resource "aws_cloudwatch_event_rule" "lambda_1003_cron" {
  name                = "mcp-1003-cron-dev"
  description         = "Hourly trigger for 1003 lambda scheduling retries"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "lambda_1003_cron" {
  rule = aws_cloudwatch_event_rule.lambda_1003_cron.name
  arn  = module.digital_mortgage_systems_mcp.lambda_1003_arn
}

resource "aws_lambda_permission" "allow_eventbridge_1003_cron" {
  statement_id  = "AllowEventBridgeInvokeCron"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.lambda_1003_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.lambda_1003_cron.arn
}

resource "aws_cloudwatch_event_rule" "heloan_uw_roster_reset_daily_cron" {
  name                = "mcp-heloan-uw-roster-reset-daily-cron-dev"
  description         = "Daily trigger to reset HELOAN underwriter roster assignment counts at 2 AM Central (CST)"
  schedule_expression = "cron(0 6 * * ? *)"
}

resource "aws_cloudwatch_event_target" "heloan_uw_roster_reset_daily_cron" {
  rule = aws_cloudwatch_event_rule.heloan_uw_roster_reset_daily_cron.name
  arn  = module.digital_mortgage_systems_mcp.heloan_uw_roster_reset_daily_lambda_arn
}

resource "aws_lambda_permission" "allow_eventbridge_heloan_uw_roster_reset_daily_cron" {
  statement_id  = "AllowEventBridgeInvokeUwRosterResetDaily"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.heloan_uw_roster_reset_daily_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.heloan_uw_roster_reset_daily_cron.arn
}

module "heloan" {
  source         = "git@github.com:Guaranteed-Rate/erc//terraform/modules/eventbridge_rule?ref=latest"
  name           = "mcp-heloan-rule"
  description    = "Fires when a HELoan application event occurs"
  event_bus_name = "erc_events_bus"
  event_pattern = jsonencode({
    detail = {
      eventName = ["milestone-changed"]
    }
  })
}

resource "aws_cloudwatch_event_target" "heloan" {
  rule           = module.heloan.name
  arn            = module.digital_mortgage_systems_mcp.heloan_lambda_arn
  event_bus_name = "erc_events_bus"
}

resource "aws_lambda_permission" "allow_eventbridge_heloan" {
  statement_id  = "AllowEventBridgeInvokeHeloan"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.heloan_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = "arn:aws:events:us-east-1:${data.aws_caller_identity.current.account_id}:rule/erc_events_bus/mcp-heloan-rule"
}

module "heloan_milestone_move" {
  source         = "git@github.com:Guaranteed-Rate/erc//terraform/modules/eventbridge_rule?ref=latest"
  name           = "mcp-heloan-milestone-move-rule"
  description    = "Fires when Flowstate loan classification completes"
  event_bus_name = "erc_events_bus"
  event_pattern = jsonencode({
    source        = ["nfs-ai.flowstate"]
    "detail-type" = ["Loan Classification"]
    detail = {
      eventName = ["loan-classification-finished"]
      eventData = {
        completed = [true]
      }
    }
  })
}

resource "aws_lambda_permission" "allow_eventbridge_heloan_milestone_move" {
  statement_id  = "AllowEventBridgeInvokeHeloanMilestoneMove"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.heloan_milestone_move_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = "arn:aws:events:us-east-1:${data.aws_caller_identity.current.account_id}:rule/erc_events_bus/${module.heloan_milestone_move.name}"
}

resource "aws_cloudwatch_event_target" "heloan_milestone_move" {
  rule           = module.heloan_milestone_move.name
  arn            = module.digital_mortgage_systems_mcp.heloan_milestone_move_lambda_arn
  event_bus_name = "erc_events_bus"
  depends_on     = [aws_lambda_permission.allow_eventbridge_heloan_milestone_move]
}

module "heloan-title-company-update" {
  source         = "git@github.com:Guaranteed-Rate/erc//terraform/modules/eventbridge_rule?ref=latest"
  name           = "mcp-heloan-title-company-update-rule"
  description    = "Fires when a HELOAN milestone changes"
  event_bus_name = "erc_events_bus"
  event_pattern = jsonencode({
    detail = {
      eventName = ["milestone-changed"]
    }
  })
}

resource "aws_cloudwatch_event_target" "heloan_title_company_update" {
  rule           = module.heloan-title-company-update.name
  arn            = module.digital_mortgage_systems_mcp.heloan_title_company_update_lambda_arn
  event_bus_name = "erc_events_bus"
}

resource "aws_lambda_permission" "allow_eventbridge_heloan_title_company_update" {
  statement_id  = "AllowEventBridgeInvokeHeloanTitleCompanyUpdate"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.heloan_title_company_update_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = "arn:aws:events:us-east-1:${data.aws_caller_identity.current.account_id}:rule/erc_events_bus/mcp-heloan-title-company-update-rule"
}

resource "aws_cloudwatch_event_rule" "heloan_decline_digest_cron" {
  name                = "mcp-heloan-decline-digest-cron-dev"
  description         = "Daily trigger to send the accumulated HELOAN decline digest email at 9 AM ET during daylight saving time"
  schedule_expression = "cron(0 13 * * ? *)"
}

resource "aws_cloudwatch_event_target" "heloan_decline_digest_cron" {
  rule = aws_cloudwatch_event_rule.heloan_decline_digest_cron.name
  arn  = module.digital_mortgage_systems_mcp.heloan_decline_digest_lambda_arn
}

resource "aws_lambda_permission" "allow_eventbridge_heloan_decline_digest_cron" {
  statement_id  = "AllowEventBridgeInvokeDeclineDigestCron"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.heloan_decline_digest_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.heloan_decline_digest_cron.arn
}

resource "aws_cloudwatch_event_rule" "heloan_decline_digest_standard_time_cron" {
  name                = "mcp-heloan-decline-digest-est-cron-dev"
  description         = "Daily trigger to send the accumulated HELOAN decline digest email at 9 AM ET during standard time"
  schedule_expression = "cron(0 14 * * ? *)"
}

resource "aws_cloudwatch_event_target" "heloan_decline_digest_standard_time_cron" {
  rule = aws_cloudwatch_event_rule.heloan_decline_digest_standard_time_cron.name
  arn  = module.digital_mortgage_systems_mcp.heloan_decline_digest_lambda_arn
}

resource "aws_lambda_permission" "allow_eventbridge_heloan_decline_digest_standard_time_cron" {
  statement_id  = "AllowEventBridgeInvokeDeclineDigestStandardCron"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.heloan_decline_digest_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.heloan_decline_digest_standard_time_cron.arn
}
