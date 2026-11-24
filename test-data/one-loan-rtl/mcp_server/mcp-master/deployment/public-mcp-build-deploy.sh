#!/bin/bash

# Public MCP Server Build and Deploy Script
# This script builds and deploys the MCP server with public access enabled
#
# Usage: ./public-mcp-deploy.sh [MCP_VERSION] [LOG_LEVEL] [AWS_PROFILE] [SKIP_BUILD]
#   MCP_VERSION: Docker image tag (default: latest)
#   LOG_LEVEL: Logging level (default: INFO)
#   AWS_PROFILE: AWS profile to use (default: dev)
#   SKIP_BUILD: Skip Docker build (true|false, default: false)
#
# Environment Variables:
#   MCP_AUTH_TOKEN: Authentication token (optional)
#     - If set: Uses the provided token (overwrites CloudFormation default)
#     - If not set: Uses CloudFormation default (demo-token-123567890-1234567890-1234567890)
#
# Examples:
#   ./public-mcp-deploy.sh                    # Uses dev profile, latest version, builds image, default token
#   ./public-mcp-deploy.sh v1.0.0            # Uses dev profile, v1.0.0 version, builds image, default token
#   MCP_AUTH_TOKEN=my-token ./public-mcp-deploy.sh latest INFO prod  # Uses custom token
#   ./public-mcp-deploy.sh latest INFO dev true  # Uses dev profile, skips build, default token

set -e

# Store script directory at the beginning (before any directory changes)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Configuration
STACK_NAME="mcp-public-server"
REGION="us-east-2"
VPC_ID="vpc-03c64e0c29faf8169"  # Same VPC as voiceAgent deployment
DOMAIN="mcp.prajnagpt.net"
KEY_NAME="gpt-aws-key-2"
INSTANCE_TYPE="t3.micro"
UBUNTU_AMI="ami-0e83be366243f524a"
HOSTED_ZONE="prajnagpt.net."
# Certificate ARN for HTTPS (optional - leave empty for HTTP only)
# Default: arn:aws:acm:us-east-2:730784326723:certificate/bb597d9c-666a-4165-b668-9b92d25a932c
CERTIFICATE_ARN="${CERTIFICATE_ARN:-arn:aws:acm:us-east-2:730784326723:certificate/bb597d9c-666a-4165-b668-9b92d25a932c}"

# Parse command line arguments
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

# Optional: set SKIP_BUILD=true to skip local docker build/push
SKIP_BUILD="${4:-${SKIP_BUILD:-false}}"

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
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building and pushing Docker image..."
    
    # Change to parent directory where Dockerfile is located
    cd "$(dirname "$0")/.."
    log_info "Building from directory: $(pwd)"
    
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
    
    # Return to deployment directory
    cd "$(dirname "$0")"
    
    log_success "Docker image built and pushed successfully"
}

# Check if auth token is provided, otherwise use CloudFormation default
check_auth_token() {
    if [ -z "$MCP_AUTH_TOKEN" ]; then
        log_info "No MCP_AUTH_TOKEN provided. CloudFormation will use default token (32+ characters)"
        USE_DEFAULT_TOKEN=true
    else
        # Validate token length (security requirement: minimum 32 characters)
        if [ ${#MCP_AUTH_TOKEN} -lt 32 ]; then
            log_error "MCP_AUTH_TOKEN must be at least 32 characters long for security."
            log_error "Current length: ${#MCP_AUTH_TOKEN} characters"
            log_error "Generate a secure token with: openssl rand -hex 32"
            exit 1
        fi
        log_info "Using provided auth token: ${MCP_AUTH_TOKEN:0:8}... (length: ${#MCP_AUTH_TOKEN})"
        USE_DEFAULT_TOKEN=false
    fi
}

# Deploy CloudFormation stack
deploy_stack() {
    log_info "Deploying CloudFormation stack..."
    
    # Use the script directory stored at the beginning
    TEMPLATE_PATH="${SCRIPT_DIR}/public-mcp_deploy.yaml"
    
    log_info "Script directory: ${SCRIPT_DIR}"
    log_info "Template path: ${TEMPLATE_PATH}"
    
    # Check if template exists in script directory
    if [ ! -f "${TEMPLATE_PATH}" ]; then
        log_error "CloudFormation template not found at: ${TEMPLATE_PATH}"
        log_error "Please ensure the script is in the same directory as public-mcp_deploy.yaml"
        exit 1
    fi
    
    # Build parameter overrides
    # Note: aws cloudformation deploy uses space-separated Key=Value format
    PARAM_OVERRIDES="Region=$REGION \
                    AccountId=$ACCOUNT_ID \
                    Domain=$DOMAIN \
                    VpcId=$VPC_ID \
                    KeyName=$KEY_NAME \
                    UbuntuAMI=$UBUNTU_AMI \
                    InstanceType=$INSTANCE_TYPE \
                    MCPVersion=$MCP_VERSION \
                    LogLevel=$LOG_LEVEL \
                    HostedZoneName=$HOSTED_ZONE \
                    MinSize=1 \
                    MaxSize=3 \
                    DesiredCapacity=1"
    
    # Only add MCPAuthToken if explicitly provided (otherwise use CloudFormation default)
    if [ "$USE_DEFAULT_TOKEN" != "true" ]; then
        PARAM_OVERRIDES="$PARAM_OVERRIDES MCPAuthToken=$MCP_AUTH_TOKEN"
    fi
    
    # Add CertificateArn if provided (for HTTPS support)
    if [ -n "$CERTIFICATE_ARN" ]; then
        PARAM_OVERRIDES="$PARAM_OVERRIDES CertificateArn=$CERTIFICATE_ARN"
    fi
    
    # Deploy the stack
    aws cloudformation deploy \
        --template-file "${TEMPLATE_PATH}" \
        --stack-name $STACK_NAME \
        --region $REGION \
        --profile ${AWS_PROFILE} \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --parameter-overrides $PARAM_OVERRIDES
    
    log_success "Stack deployment completed successfully"
}

# Get stack outputs
get_outputs() {
    log_info "Getting deployment outputs..."
    
    aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --region ${REGION} \
        --profile ${AWS_PROFILE} \
        --query 'Stacks[0].Outputs' \
        --output table
}

# Refresh Auto Scaling Group instances to pick up new image
refresh_instances() {
    log_info "Refreshing Auto Scaling Group instances to pick up new image..."
    
    # Get Auto Scaling Group name from stack outputs
    ASG_NAME=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --region ${REGION} \
        --profile ${AWS_PROFILE} \
        --query 'Stacks[0].Outputs[?OutputKey==`AutoScalingGroupName`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$ASG_NAME" ] || [ "$ASG_NAME" == "None" ]; then
        # Try to get it from resources if output not available
        ASG_NAME=$(aws cloudformation describe-stack-resources \
            --stack-name ${STACK_NAME} \
            --region ${REGION} \
            --profile ${AWS_PROFILE} \
            --query 'StackResources[?ResourceType==`AWS::AutoScaling::AutoScalingGroup`].PhysicalResourceId' \
            --output text 2>/dev/null || echo "")
    fi
    
    if [ -n "$ASG_NAME" ]; then
        log_info "Starting instance refresh for Auto Scaling Group: ${ASG_NAME}"
        
        # Check if there's already a refresh in progress
        REFRESH_STATUS=$(aws autoscaling describe-instance-refreshes \
            --auto-scaling-group-name ${ASG_NAME} \
            --region ${REGION} \
            --profile ${AWS_PROFILE} \
            --query 'InstanceRefreshes[0].Status' \
            --output text 2>/dev/null || echo "None")
        
        if [ "$REFRESH_STATUS" != "InProgress" ] && [ "$REFRESH_STATUS" != "Pending" ]; then
            # Start instance refresh
            aws autoscaling start-instance-refresh \
                --auto-scaling-group-name ${ASG_NAME} \
                --region ${REGION} \
                --profile ${AWS_PROFILE} \
                --preferences MinHealthyPercentage=50,InstanceWarmup=60 \
                --output text > /dev/null 2>&1
            
            if [ $? -eq 0 ]; then
                log_success "Instance refresh started. Instances will be gradually replaced with new image."
                log_info "This may take 5-10 minutes. Check status with:"
                log_info "  aws autoscaling describe-instance-refreshes --auto-scaling-group-name ${ASG_NAME} --region ${REGION} --profile ${AWS_PROFILE}"
            else
                log_error "Failed to start instance refresh. You may need to manually refresh instances."
            fi
        else
            log_info "Instance refresh already in progress (Status: ${REFRESH_STATUS})"
        fi
    else
        log_error "Could not find Auto Scaling Group name. Instance refresh skipped."
        log_info "You may need to manually refresh instances to pick up the new image."
    fi
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
    
    PUBLIC_URL=$(aws cloudformation describe-stacks \
        --stack-name ${STACK_NAME} \
        --region ${REGION} \
        --profile ${AWS_PROFILE} \
        --query 'Stacks[0].Outputs[?OutputKey==`PublicURL`].OutputValue' \
        --output text)
    
    if [ -z "$ALB_DNS" ]; then
        log_error "Could not get ALB DNS name"
        return 1
    fi
    
    log_success "Deployment completed successfully!"
    echo ""
    log_info "🌐 Public Access Information:"
    echo "   ALB DNS: $ALB_DNS"
    echo "   Public URL: $PUBLIC_URL"
    echo "   Domain: $DOMAIN"
    echo ""
    log_info "🔐 Authentication:"
    if [ "$USE_DEFAULT_TOKEN" = "true" ]; then
        # Get the actual default token from CloudFormation
        DEFAULT_TOKEN=$(aws cloudformation describe-stacks \
            --stack-name ${STACK_NAME} \
            --region ${REGION} \
            --profile ${AWS_PROFILE} \
            --query 'Stacks[0].Parameters[?ParameterKey==`MCPAuthToken`].ParameterValue' \
            --output text 2>/dev/null || echo "demo-token-123567890-1234567890-1234567890")
        echo "   Token: ${DEFAULT_TOKEN:0:16}... (CloudFormation default, 32+ chars)"
        echo "   Header: Authorization: Bearer ${DEFAULT_TOKEN}"
        MCP_AUTH_TOKEN="$DEFAULT_TOKEN"
    else
        echo "   Token: $MCP_AUTH_TOKEN"
        echo "   Header: Authorization: Bearer $MCP_AUTH_TOKEN"
    fi
    echo ""
    log_info "🧪 Test Commands:"
    echo "   # Health check"
    echo "   curl $PUBLIC_URL/health"
    echo ""
    echo "   # Server info"
    echo "   curl $PUBLIC_URL/"
    echo ""
    echo "   # List tools (requires auth)"
    echo "   curl -H 'Authorization: Bearer $MCP_AUTH_TOKEN' $PUBLIC_URL/tools/"
    echo ""
    echo "   # Execute a tool (requires auth)"
    echo "   curl -H 'Authorization: Bearer $MCP_AUTH_TOKEN' -H 'Content-Type: application/json' -d '{\"name\":\"pull_credit\",\"arguments\":{\"loanId\":\"123\"}}' $PUBLIC_URL/tools/pull_credit"
    echo ""
    log_info "📚 API Documentation:"
    echo "   $PUBLIC_URL/docs"
    echo ""
    log_info "⚠️  Security Notes:"
    echo "   - Keep your auth token secure and don't share it publicly"
    echo "   - Consider rotating the token regularly"
    echo "   - Monitor access logs for any suspicious activity"
    echo ""
    log_info "🔧 Management Commands:"
    echo "   # Update stack"
    echo "   ./public-mcp-deploy.sh"
    echo ""
    echo "   # Delete stack"
    echo "   aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION --profile ${AWS_PROFILE}"
    echo ""
    echo "   # View stack status"
    echo "   aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --profile ${AWS_PROFILE}"
}

# Main execution
main() {
    log_info "Starting MCP Server Public Deployment"
    log_info "Stack Name: ${STACK_NAME}"
    log_info "Region: ${REGION}"
    log_info "Domain: ${DOMAIN}"
    log_info "MCP Version: ${MCP_VERSION}"
    log_info "Log Level: ${LOG_LEVEL}"
    log_info "AWS Profile: ${AWS_PROFILE} (${AWS_PROFILE_SET_EXPLICIT:+explicitly set}${AWS_PROFILE_SET_EXPLICIT:-default})"
    log_info "SKIP_BUILD: ${SKIP_BUILD}"
    
    check_prerequisites
    check_auth_token
    if [ "$SKIP_BUILD" = "true" ]; then
        log_info "Skipping local build. Using prebuilt ECR image tag: ${MCP_VERSION}"
    else
        build_and_push_image
    fi
    deploy_stack
    get_outputs
    
    # Force instance refresh to pick up new image
    refresh_instances
    
    get_deployment_info
    
    log_success "MCP Server public deployment completed successfully!"
    log_info "The server is accessible publicly at: ${DOMAIN}"
}

# Run main function
main "$@"
