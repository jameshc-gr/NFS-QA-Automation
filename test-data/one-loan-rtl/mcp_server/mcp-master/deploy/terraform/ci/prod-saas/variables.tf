variable app_name {
  type = string
  default = "digital-mortgage-systems-mcp"
}

variable github_repo_name {
  type = string
  default = "mcp"
}

variable region {
  type = string
    default = "us-east-1"
}

variable environment {
  type = string
    default = "prod"
}

variable "permissions_boundary_name" {
  type = string
  default = "MachineLearning_PermissionsBoundary"
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