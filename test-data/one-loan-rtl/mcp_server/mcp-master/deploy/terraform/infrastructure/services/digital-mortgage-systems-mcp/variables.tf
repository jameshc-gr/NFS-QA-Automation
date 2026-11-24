variable "app_name" {
  type    = string
  default = "digital-mortgage-systems-mcp"
}

variable "sub_domain_name" {
  type    = string
  default = "digital-mortgage-systems-mcp"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "oidc_arn" {
  type = string
}

variable "eks_namespace" {
  type    = string
  default = "digital-mortgage-systems-mcp"
}

variable "permissions_boundary_name" {
  type    = string
  default = "MachineLearning_PermissionsBoundary"
}

variable "route53_zone_name" {
  type = string
}

variable "additional_allowed_principles" {
  type    = list(string)
  default = []
}

variable "heloan_decline_digest_recipients" {
  type        = list(string)
  description = "Email addresses that should receive the daily HELOAN decline digest email."
}

variable "heloan_pass_digest_recipients" {
  type        = list(string)
  description = "Email addresses that should receive the daily HELOAN pass digest email."
}

variable "usage_digest_recipients" {
  type        = list(string)
  description = "Email addresses that should receive the daily MCP usage digest email."
}

variable "heloan_decline_digest_alarm_email_recipients" {
  type        = list(string)
  description = "Email recipients for production HELOAN digest failure, sustained throttle/duration, and missed-schedule alarms. Each recipient must confirm the SNS subscription."
  default     = ["danny.cowles@rate.com"]
}

variable "underwriting_conditions_export_alarm_email_recipients" {
  description = "Email addresses for production underwriting conditions export errors."
  type        = list(string)
  default     = []
}

variable "underwriting_approved_alarm_email_recipients" {
  type        = list(string)
  description = "Email recipients for production underwriting-approved Lambda failure, sustained throttle, and duration alarms. Each recipient must confirm the SNS subscription."
  default     = ["danny.cowles@rate.com"]
}

variable "credit_inquiry_alarm_email_recipients" {
  type        = list(string)
  description = "Email recipients for production credit inquiry Lambda error, throttle, and duration alarms. Each recipient must confirm the SNS subscription."
  default     = ["danny.cowles@rate.com"]
}

variable "heloan_alarm_email_recipients" {
  type        = list(string)
  description = "Email addresses that should be notified when HELOAN lambda CloudWatch alarms fire (errors, throttles, duration near timeout, missed schedule). SNS email subscriptions do not distinguish TO vs CC — every subscriber receives the alarm as a direct recipient."
  default = [
    "Min.Lei@rate.com",
    "Danny.Cowles@Rate.com",
    "Boyang.Zhao@rate.com",
  ]
}

variable "heloan_pipeline_alarm_email_recipients" {
  type        = list(string)
  description = "Email recipients for production HELOAN pipeline alarms. Each recipient must confirm the SNS subscription."
  default     = ["Boyang.Zhao@rate.com"]
}

variable "heloan_title_company_update_alarm_email_recipients" {
  type        = list(string)
  description = "Email recipients for production title company update alarms. Each recipient must confirm the SNS subscription."
  default     = ["Boyang.Zhao@rate.com"]
}

variable "usage_digest_alarm_email_recipients" {
  type        = list(string)
  description = "Email recipients for production usage digest Lambda error and throttle alarms. Each recipient must confirm the SNS subscription."
  default     = ["Boyang.Zhao@rate.com"]
}

## Tags

variable "tag_business_contact" {
  default = "NFS-AI-ML@rate.com"
}

variable "tag_business_owner" {
  default = "NFS-AI-ML@rate.com"
}

variable "tag_code_repo" {
  default = "https://github.com/Guaranteed-Rate/mcp"
}

variable "tag_criticality" {
  default = "high"
}

variable "tag_product" {
  default = "digital-mortgage-systems-mcp"
}

variable "tag_public_facing" {
  default = "no"
}

variable "tag_retirement_date" {
  default = "2030-12-31"
}

variable "tag_tech_contact" {
  default = "NFS-AI-ML@rate.com"
}

# ---------------------------------------------------------------------------
# ElastiCache / Redis
# ---------------------------------------------------------------------------

variable "redis_node_type" {
  type        = string
  default     = "cache.t3.micro"
  description = "ElastiCache node type. Use cache.t3.micro for dev, cache.r6g.large for prod."
}

variable "redis_num_nodes" {
  type        = number
  default     = 1
  description = "Number of cache nodes. 1 = single-node (dev). 2+ enables Multi-AZ automatic failover."
}