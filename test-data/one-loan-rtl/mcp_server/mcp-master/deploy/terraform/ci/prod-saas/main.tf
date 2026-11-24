terraform {
  backend "s3" {
    bucket         = "rate-platform"
    dynamodb_table = "terraform-state-lock"
    key            = "digital-mortgage-systems-mcp/ci/prod-saas/terraform.tfstate"
    region         = "us-east-1"
    assume_role    = {
      role_arn     = "arn:aws:iam::800864774051:role/TerraformDeployer"
    }
    profile        = "prod-saas-MachineLearning"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.22.0"
    }
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "prod-saas-MachineLearning"
}

data "aws_iam_policy_document" "role_policy" {
  statement {
    actions = [
      "ecr:*"
    ]

    resources = [
      module.ecr_repository.arn
    ]
  }
  statement {
    actions = [
      "ecr:GetAuthorizationToken"
    ]

    resources = [
      "*"
    ]
  }

    statement {
     actions = [
      "eks:AccessKubernetesApi",
      "eks:Describe*",
      "eks:List*"
    ]

    resources = [
      "*"
    ]
  }
}

module "ecr_repository" {
  source = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//ecr_repository?ref=v1.1.60"
  name = var.app_name
  permissions_boundary_name = var.permissions_boundary_name
  tags = module.tagging.value
}

module "github_actions_role" {
  source = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//iam_role_gh_actions?ref=v1.1.60"
  rolename = "${var.app_name}-gh-actions"
  github_repo = var.github_repo_name
  permissions_boundary_name = var.permissions_boundary_name
  inline_policies = { permissions = data.aws_iam_policy_document.role_policy.json }
  tags = module.tagging.value
}

module tagging {
  source = "git@github.com:Guaranteed-Rate/terraform-aws-app-modules.git//tagging?ref=v1.1.60"
  business_contact = var.tag_business_contact
  business_owner = var.tag_business_owner
  code_repo = var.tag_code_repo
  criticality = var.tag_criticality
  environment = var.environment
  product = var.tag_product
  public_facing = var.tag_public_facing
  retirement_date = var.tag_retirement_date
  tech_contact = var.tag_tech_contact
}