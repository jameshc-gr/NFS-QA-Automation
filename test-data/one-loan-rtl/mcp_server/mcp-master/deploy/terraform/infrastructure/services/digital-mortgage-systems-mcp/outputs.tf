output "lambda_1003_arn" {
  value = module.lambda_1003.lambda_arn
}

output "lambda_1003_name" {
  value = module.lambda_1003.lambda_function_name
}

output "underwriting_approved_lambda_arn" {
  value = module.underwriting_approved_lambda.lambda_arn
}

output "underwriting_approved_lambda_name" {
  value = module.underwriting_approved_lambda.lambda_function_name
}

output "underwriting_credit_inquiry_task_automation_lambda_arn" {
  value = module.underwriting_credit_inquiry_task_automation_lambda.lambda_arn
}

output "underwriting_credit_inquiry_task_automation_lambda_name" {
  value = module.underwriting_credit_inquiry_task_automation_lambda.lambda_function_name
}

output "heloan_lambda_arn" {
  value = module.heloan_lambda.lambda_arn
}

output "heloan_lambda_name" {
  value = module.heloan_lambda.lambda_function_name
}

output "heloan_title_company_update_lambda_arn" {
  value = module.heloan_title_company_update_lambda.lambda_arn
}

output "heloan_title_company_update_lambda_name" {
  value = module.heloan_title_company_update_lambda.lambda_function_name
}

output "heloan_pipeline_assignment_lambda_arn" {
  value = module.heloan_pipeline_assignment_lambda.lambda_arn
}

output "heloan_pipeline_assignment_lambda_name" {
  value = module.heloan_pipeline_assignment_lambda.lambda_function_name
}

output "heloan_processor_first_review_lambda_arn" {
  value = module.heloan_processor_first_review_lambda.lambda_arn
}

output "heloan_processor_first_review_lambda_name" {
  value = module.heloan_processor_first_review_lambda.lambda_function_name
}

output "heloan_milestone_move_lambda_arn" {
  value = module.heloan_milestone_move_lambda.lambda_arn
}

output "heloan_milestone_move_lambda_name" {
  value = module.heloan_milestone_move_lambda.lambda_function_name
}

output "heloan_decline_digest_lambda_arn" {
  value = module.heloan_decline_digest_lambda.lambda_arn
}

output "heloan_decline_digest_lambda_name" {
  value = module.heloan_decline_digest_lambda.lambda_function_name
}

output "heloan_uw_roster_sync_lambda_arn" {
  value = module.heloan_uw_roster_sync_lambda.lambda_arn
}

output "heloan_uw_roster_sync_lambda_name" {
  value = module.heloan_uw_roster_sync_lambda.lambda_function_name
}

output "heloan_uw_roster_reset_daily_lambda_arn" {
  value = module.heloan_uw_roster_reset_daily_lambda.lambda_arn
}

output "heloan_uw_roster_reset_daily_lambda_name" {
  value = module.heloan_uw_roster_reset_daily_lambda.lambda_function_name
}

output "usage_digest_lambda_arn" {
  value = module.usage_digest_lambda.lambda_arn
}

output "usage_digest_lambda_name" {
  value = module.usage_digest_lambda.lambda_function_name
}

output "heloan_decline_digest_alarms_topic_arn" {
  value       = var.environment == "prod" ? module.heloan_decline_digest_alarms_topic[0].topic_arn : null
  description = "SNS topic for production HELOAN digest failure-only notifications. Null outside of prod."
}

output "underwriting_approved_alarms_topic_arn" {
  value       = var.environment == "prod" ? module.underwriting_approved_alarms_topic[0].topic_arn : null
  description = "SNS topic for production underwriting-approved Lambda failure-only notifications. Null outside of prod."
}

output "credit_inquiry_alarms_topic_arn" {
  value       = var.environment == "prod" ? module.credit_inquiry_alarms_topic[0].topic_arn : null
  description = "SNS topic for all production credit inquiry Lambda alarms. Null outside of prod."
}

output "heloan_alarms_topic_arn" {
  value       = var.environment == "prod" ? module.heloan_alarms_topic[0].topic_arn : null
  description = "SNS topic ARN receiving CloudWatch alarm notifications for the HELOAN lambdas. Null outside of prod."
}

output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "ElastiCache Redis primary endpoint hostname."
}
