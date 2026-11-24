resource "aws_cloudwatch_event_rule" "underwriting_conditions_export" {
  name                = "mcp-underwriting-conditions-export-poll-prod"
  description         = "Check completion and start the next hourly DynamoDB export when it is ready"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_lambda_permission" "underwriting_conditions_export" {
  statement_id  = "AllowEventBridgeInvokeExport"
  action        = "lambda:InvokeFunction"
  function_name = module.digital_mortgage_systems_mcp.underwriting_conditions_export_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.underwriting_conditions_export.arn
}

resource "aws_cloudwatch_event_target" "underwriting_conditions_export" {
  rule       = aws_cloudwatch_event_rule.underwriting_conditions_export.name
  arn        = module.digital_mortgage_systems_mcp.underwriting_conditions_export_lambda_arn
  depends_on = [aws_lambda_permission.underwriting_conditions_export]
}

output "underwriting_conditions_export_bucket" {
  value = module.digital_mortgage_systems_mcp.underwriting_conditions_export_bucket
}
