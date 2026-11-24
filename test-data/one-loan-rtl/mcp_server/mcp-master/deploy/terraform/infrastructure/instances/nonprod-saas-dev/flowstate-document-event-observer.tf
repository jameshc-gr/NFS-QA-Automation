variable "flowstate_observer_test_loan_guid" {
  type        = string
  description = "Dev test loan to observe. Null disables the observer and its rules."
  default     = null

  validation {
    condition     = var.flowstate_observer_test_loan_guid == null || can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.flowstate_observer_test_loan_guid))
    error_message = "The test loan GUID must be a lowercase UUID."
  }
}

locals {
  flowstate_observer_enabled = var.flowstate_observer_test_loan_guid != null
  flowstate_observer_bus     = "erc_events_bus"
  flowstate_observer_tags = {
    BusinessContact = "nfs-ai-ml@rate.com"
    BusinessOwner   = "nfs-ai-ml@rate.com"
    TechContact     = "nfs-ai-ml@rate.com"
    TechOwner       = "none"
    CodeRepo        = "https://github.com/guaranteed-rate/mcp"
    Compliance      = "none"
    Criticality     = "low"
    Environment     = "dev"
    ManagedBy       = "terraform"
    Product         = "digital-mortgage-systems-mcp"
    PublicFacing    = "no"
    RetirementDate  = "2030-12-31"
    JV              = "multitenant"
    team            = "ag-datadog-digitalmortgage"
  }
}

module "flowstate_document_event_observer" {
  count                           = local.flowstate_observer_enabled ? 1 : 0
  source                          = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//lambda?ref=v1.1.90"
  name                            = "flowstate-document-event-observer-dev"
  handler                         = "handler.lambda_handler"
  runtime                         = "python3.12"
  source_path                     = "/tmp/flowstate-document-event-observer.zip"
  permissions_boundary_name       = "MachineLearning_PermissionsBoundary"
  iam_role_is_assumable_by        = "OnlyThisLambda"
  minimum_available_concurrency   = 1
  memory                          = 128
  timeout                         = 5
  cloudwatch_log_retention_period = 1
  logging_config                  = { log_format = "Text" }
  tags                            = local.flowstate_observer_tags
}

resource "aws_cloudwatch_event_rule" "flowstate_observer_pdf_completed" {
  count          = local.flowstate_observer_enabled ? 1 : 0
  name           = "flowstate-document-event-observer-pdf-completed-dev"
  description    = "Observe doc-storage PDF completion events for one dev test loan"
  event_bus_name = local.flowstate_observer_bus
  tags           = local.flowstate_observer_tags
  event_pattern = jsonencode({
    source = ["doc-storage-service"]
    detail = {
      eventName = ["pdf-process-completed"]
      eventData = {
        loanGuid = [var.flowstate_observer_test_loan_guid]
      }
    }
  })
}

resource "aws_lambda_permission" "flowstate_observer_pdf_completed" {
  count         = local.flowstate_observer_enabled ? 1 : 0
  statement_id  = "AllowEventBridgePdfProcessCompleted"
  action        = "lambda:InvokeFunction"
  function_name = module.flowstate_document_event_observer[0].lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.flowstate_observer_pdf_completed[0].arn
}

resource "aws_cloudwatch_event_target" "flowstate_observer_pdf_completed" {
  count          = local.flowstate_observer_enabled ? 1 : 0
  rule           = aws_cloudwatch_event_rule.flowstate_observer_pdf_completed[0].name
  event_bus_name = local.flowstate_observer_bus
  arn            = module.flowstate_document_event_observer[0].lambda_arn
  depends_on     = [aws_lambda_permission.flowstate_observer_pdf_completed]
}

resource "aws_cloudwatch_event_rule" "flowstate_observer_encompass_attachment" {
  count          = local.flowstate_observer_enabled ? 1 : 0
  name           = "flowstate-document-event-observer-encompass-attachment-dev"
  description    = "Observe Encompass attachment events for one dev test loan"
  event_bus_name = local.flowstate_observer_bus
  tags           = local.flowstate_observer_tags
  event_pattern = jsonencode({
    source        = ["enc-loan-sync"]
    "detail-type" = ["encompass-attachment-event"]
    detail = {
      identity = {
        encompassGUID = [var.flowstate_observer_test_loan_guid]
      }
    }
  })
}

resource "aws_lambda_permission" "flowstate_observer_encompass_attachment" {
  count         = local.flowstate_observer_enabled ? 1 : 0
  statement_id  = "AllowEventBridgeEncompassAttachment"
  action        = "lambda:InvokeFunction"
  function_name = module.flowstate_document_event_observer[0].lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.flowstate_observer_encompass_attachment[0].arn
}

resource "aws_cloudwatch_event_target" "flowstate_observer_encompass_attachment" {
  count          = local.flowstate_observer_enabled ? 1 : 0
  rule           = aws_cloudwatch_event_rule.flowstate_observer_encompass_attachment[0].name
  event_bus_name = local.flowstate_observer_bus
  arn            = module.flowstate_document_event_observer[0].lambda_arn
  depends_on     = [aws_lambda_permission.flowstate_observer_encompass_attachment]
}

resource "aws_cloudwatch_event_rule" "flowstate_observer_holder_updated" {
  count          = local.flowstate_observer_enabled ? 1 : 0
  name           = "flowstate-document-event-observer-holder-updated-dev"
  description    = "Observe doc-storage document holder changes for one dev test loan"
  event_bus_name = local.flowstate_observer_bus
  tags           = local.flowstate_observer_tags
  event_pattern = jsonencode({
    source = ["doc-storage-service"]
    detail = {
      eventName = ["document-holder-updated"]
      eventData = {
        loanGuid = [var.flowstate_observer_test_loan_guid]
      }
    }
  })
}

resource "aws_lambda_permission" "flowstate_observer_holder_updated" {
  count         = local.flowstate_observer_enabled ? 1 : 0
  statement_id  = "AllowEventBridgeDocumentHolderUpdated"
  action        = "lambda:InvokeFunction"
  function_name = module.flowstate_document_event_observer[0].lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.flowstate_observer_holder_updated[0].arn
}

resource "aws_cloudwatch_event_target" "flowstate_observer_holder_updated" {
  count          = local.flowstate_observer_enabled ? 1 : 0
  rule           = aws_cloudwatch_event_rule.flowstate_observer_holder_updated[0].name
  event_bus_name = local.flowstate_observer_bus
  arn            = module.flowstate_document_event_observer[0].lambda_arn
  depends_on     = [aws_lambda_permission.flowstate_observer_holder_updated]
}
