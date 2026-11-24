#!/bin/bash

# MCP Server Deployment Script
# This script deploys the complete MCP server infrastructure with dedicated subnets
#
# Usage: ./dev-mcp-build-deploy.sh [MCP_VERSION] [LOG_LEVEL] [AWS_PROFILE] [DEPLOY_ENV]
#   MCP_VERSION: Docker image tag (default: latest)
#   LOG_LEVEL: Logging level (default: INFO)
#   AWS_PROFILE: AWS profile to use (default: dev)
#   DEPLOY_ENV: Environment (dev|prod, default: dev)
#
# Examples:
#   ./dev-mcp-build-deploy.sh                    # Uses dev profile, latest version
#   ./dev-mcp-build-deploy.sh v1.0.0            # Uses dev profile, v1.0.0 version
#   ./dev-mcp-build-deploy.sh latest INFO prod  # Uses prod profile, latest version
#   ./dev-mcp-build-deploy.sh latest INFO dev prod  # Uses dev profile, prod environment

set -e

# Configuration
STACK_NAME="mcp-unified-server"
REGION="us-east-2"
DOMAIN="mcp.prajnagpt.net"
MCP_VERSION="${1:-latest}"
LOG_LEVEL="${2:-INFO}"
# Set AWS profile - default to dev, but track if explicitly set
if [ -n "${3}" ]; then
    AWS_PROFILE="${3}"
    AWS_PROFILE_SET_EXPLICIT="true"
else
    AWS_PROFILE="dev"  # Default to dev profile
    AWS_PROFILE_SET_EXPLICIT="false"
fi
# Optional 4th arg: deploy env (dev|prod); env var DEPLOY_ENV also supported
DEPLOY_ENV="${4:-${DEPLOY_ENV:-dev}}"
# Optional: set SKIP_BUILD=true to skip local docker build/push (for prod/CI)
SKIP_BUILD="${SKIP_BUILD:-false}"
# Optional: prod-specific overrides provided via env
NAT_ALLOCATION_ID="${NAT_ALLOCATION_ID:-}"
HOSTED_ZONE_NAME="${HOSTED_ZONE_NAME:-}"
KEY_NAME_OVERRIDE="${KEY_NAME:-}"

# VPC Configuration - We'll use an existing VPC but create new subnets
VPC_ID="vpc-03c64e0c29faf8169"  # Your existing VPC ID

# Additional configuration with defaults
ACCOUNT_ID="730784326723"
UBUNTU_AMI="ami-0e83be366243f524a"
INSTANCE_TYPE="t3.micro"
MCP_AUTH_TOKEN="demo-token-123"

# Set defaults for dev environment
if [ "${DEPLOY_ENV}" = "dev" ]; then
    NAT_ALLOCATION_ID="${NAT_ALLOCATION_ID:-eipalloc-0bb556b2af0b8ba3c}"
    HOSTED_ZONE_NAME="${HOSTED_ZONE_NAME:-prajnagpt.net.}"
    KEY_NAME_OVERRIDE="${KEY_NAME_OVERRIDE:-gpt-aws-key-2}"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Auto-detect prod defaults from AWS if not provided
auto_detect_prod_defaults() {
    if [ "${DEPLOY_ENV}" != "prod" ]; then
        return 0
    fi

    log_info "DEPLOY_ENV=prod: attempting to auto-detect defaults via AWS (${AWS_PROFILE})"

    # Default AWS_PROFILE to prod if not explicitly set and we're in prod environment
    if [ "${AWS_PROFILE_SET_EXPLICIT}" = "false" ] && [ "${AWS_PROFILE}" = "dev" ]; then
        AWS_PROFILE="prod"
        log_info "Switching AWS_PROFILE to prod for deployment (DEPLOY_ENV=prod)"
    fi

    # VPC_ID (prefer existing value)
    if [ -z "${VPC_ID}" ]; then
        VPC_ID=$(aws ec2 describe-vpcs --profile ${AWS_PROFILE} --region ${REGION} \
            --query 'Vpcs[?IsDefault==`true`].VpcId' --output text 2>/dev/null || true)
        if [ -z "${VPC_ID}" ] || [ "${VPC_ID}" = "None" ]; then
            VPC_ID=$(aws ec2 describe-vpcs --profile ${AWS_PROFILE} --region ${REGION} \
                --query 'Vpcs[0].VpcId' --output text 2>/dev/null || true)
        fi
        [ -n "${VPC_ID}" ] && log_info "Auto-detected VPC_ID: ${VPC_ID}"
    fi

    # NAT_ALLOCATION_ID (unassociated EIP)
    if [ -z "${NAT_ALLOCATION_ID}" ]; then
        NAT_ALLOCATION_ID=$(aws ec2 describe-addresses --profile ${AWS_PROFILE} --region ${REGION} \
            --query 'Addresses[?AssociationId==`null`].[AllocationId]' --output text 2>/dev/null | head -n1 || true)
        [ -n "${NAT_ALLOCATION_ID}" ] && log_info "Auto-detected NAT_ALLOCATION_ID: ${NAT_ALLOCATION_ID}"
    fi

    # HOSTED_ZONE_NAME (first public zone)
    if [ -z "${HOSTED_ZONE_NAME}" ]; then
        HOSTED_ZONE_NAME=$(aws route53 list-hosted-zones --profile ${AWS_PROFILE} \
            --query 'HostedZones[?Config.PrivateZone==`false`].Name' --output text 2>/dev/null | head -n1 || true)
        [ -n "${HOSTED_ZONE_NAME}" ] && log_info "Auto-detected HOSTED_ZONE_NAME: ${HOSTED_ZONE_NAME}"
    fi

    # KEY_NAME (prefer name containing "prod")
    if [ -z "${KEY_NAME_OVERRIDE}" ]; then
        KEY_NAME_OVERRIDE=$(aws ec2 describe-key-pairs --profile ${AWS_PROFILE} --region ${REGION} \
            --query 'KeyPairs[?contains(KeyName, `prod`)].KeyName' --output text 2>/dev/null | head -n1 || true)
        if [ -z "${KEY_NAME_OVERRIDE}" ]; then
            KEY_NAME_OVERRIDE=$(aws ec2 describe-key-pairs --profile ${AWS_PROFILE} --region ${REGION} \
                --query 'KeyPairs[0].KeyName' --output text 2>/dev/null || true)
        fi
        [ -n "${KEY_NAME_OVERRIDE}" ] && log_info "Auto-detected KEY_NAME: ${KEY_NAME_OVERRIDE}"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Only require Docker if we plan to build locally
    if [ "$SKIP_BUILD" != "true" ]; then
        if ! command -v docker &> /dev/null; then
            log_error "Docker is not installed. Please install it first or set SKIP_BUILD=true."
            exit 1
        fi
    else
        log_info "SKIP_BUILD=true: skipping local Docker requirement. Using prebuilt image tag: ${MCP_VERSION}"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile ${AWS_PROFILE} &> /dev/null; then
        log_error "AWS credentials not configured for profile ${AWS_PROFILE}. Please run 'aws configure' first."
        exit 1
    fi
    
    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --profile ${AWS_PROFILE} --query Account --output text)
    if [ -z "$ACCOUNT_ID" ]; then
        log_error "Could not get AWS account ID"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
    auto_detect_prod_defaults
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building and pushing Docker image..."
    
    # Build Docker image
    docker build -t mcp-server:${MCP_VERSION} .
    
    # Login to ECR
    aws ecr get-login-password --region ${REGION} --profile ${AWS_PROFILE} | \
        docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
    
    # Create ECR repository if it doesn't exist
    aws ecr describe-repositories --repository-names mcp-server --region ${REGION} --profile ${AWS_PROFILE} &> /dev/null || \
        aws ecr create-repository --repository-name mcp-server --region ${REGION} --profile ${AWS_PROFILE}
    
    # Tag and push image
    docker tag mcp-server:${MCP_VERSION} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/mcp-server:${MCP_VERSION}
    docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/mcp-server:${MCP_VERSION}
    
    log_success "Docker image built and pushed successfully"
}

# Check and delete existing stack
check_and_delete_existing_stack() {
    log_info "Checking for existing stack..."
    
    if aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${REGION} --profile ${AWS_PROFILE} &> /dev/null; then
        log_info "Existing stack found: ${STACK_NAME}"
        log_info "Deleting existing stack before deploying new one..."
        
        aws cloudformation delete-stack --stack-name ${STACK_NAME} --region ${REGION} --profile ${AWS_PROFILE}
        
        log_info "Waiting for stack deletion to complete..."
        aws cloudformation wait stack-delete-complete --stack-name ${STACK_NAME} --region ${REGION} --profile ${AWS_PROFILE}
        
        log_success "Existing stack deleted successfully"
    else
        log_info "No existing stack found, proceeding with fresh deployment"
    fi
}

# Deploy CloudFormation stack
deploy_stack() {
log_info "Deploying CloudFormation stack..."
    
    # Always create a new stack (since we delete existing ones)
    OPERATION="create-stack"
    log_info "Creating new stack: ${STACK_NAME}"
    

    # Deploy the stack
    aws cloudformation ${OPERATION} \
        --stack-name ${STACK_NAME} \
        --template-body file://deployment/dev-mcp_deploy.yaml \
        --parameters \
            ParameterKey=Region,ParameterValue=${REGION} \
            ParameterKey=AccountId,ParameterValue=${ACCOUNT_ID} \
            ParameterKey=Domain,ParameterValue=${DOMAIN} \
            ParameterKey=VpcId,ParameterValue=${VPC_ID} \
            ParameterKey=KeyName,ParameterValue=${KEY_NAME_OVERRIDE} \
            ParameterKey=UbuntuAMI,ParameterValue=${UBUNTU_AMI} \
            ParameterKey=InstanceType,ParameterValue=${INSTANCE_TYPE} \
            ParameterKey=MCPVersion,ParameterValue=${MCP_VERSION} \
            ParameterKey=LogLevel,ParameterValue=${LOG_LEVEL} \
            ParameterKey=MCPAuthToken,ParameterValue=${MCP_AUTH_TOKEN} \
            ParameterKey=NATAllocationId,ParameterValue=${NAT_ALLOCATION_ID} \
            ParameterKey=HostedZoneName,ParameterValue=${HOSTED_ZONE_NAME} \
        --capabilities CAPABILITY_NAMED_IAM \
        --region ${REGION} \
        --profile ${AWS_PROFILE}
    
    # Wait for stack completion
    log_info "Waiting for stack creation to complete..."
    aws cloudformation wait stack-create-complete --stack-name ${STACK_NAME} --region ${REGION} --profile ${AWS_PROFILE}
    
    log_success "Stack creation completed successfully"
}

# Get stack outputs
get_outputs() {
    log_info "Getting stack outputs..."
    
    aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --region ${REGION} \
        --profile ${AWS_PROFILE} \
        --query 'Stacks[0].Outputs' \
        --output table
}

# Get deployment info
get_deployment_info() {
    log_info "Getting deployment information..."
    
    # Get ALB DNS name
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --region ${REGION} \
        --profile ${AWS_PROFILE} \
        --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
        --output text)
    
    if [ -z "$ALB_DNS" ]; then
        log_error "Could not get ALB DNS name"
        return 1
    fi
    
    log_info "ALB DNS: ${ALB_DNS}"
    log_info "Domain: ${DOMAIN}"
    log_info "Note: Server is only accessible from within the VPC (internal ALB)"
}

# Main execution
main() {
    log_info "Starting MCP Server Unified Deployment"
    log_info "Stack Name: ${STACK_NAME}"
    log_info "Region: ${REGION}"
    log_info "Domain: ${DOMAIN}"
    log_info "MCP Version: ${MCP_VERSION}"
    log_info "Log Level: ${LOG_LEVEL}"
    log_info "AWS Profile: ${AWS_PROFILE} (${AWS_PROFILE_SET_EXPLICIT:+explicitly set}${AWS_PROFILE_SET_EXPLICIT:-default})"
    log_info "DEPLOY_ENV: ${DEPLOY_ENV}"
    log_info "SKIP_BUILD: ${SKIP_BUILD}"
    
    check_prerequisites
    check_and_delete_existing_stack
    if [ "$SKIP_BUILD" = "true" ]; then
        log_info "Skipping local build. Using prebuilt ECR image tag: ${MCP_VERSION}"
    else
        build_and_push_image
    fi
    deploy_stack
    get_outputs
    get_deployment_info
    
    log_success "MCP Server deployment completed successfully!"
    log_info "The server is accessible at: ${DOMAIN}"
    log_info "Note: Server is only accessible from within the VPC (internal ALB)"
}

# Run main function
main "$@"
