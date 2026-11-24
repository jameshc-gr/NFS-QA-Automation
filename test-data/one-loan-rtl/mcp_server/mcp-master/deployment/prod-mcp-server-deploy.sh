#!/bin/bash

# Deploy MCP Server to AWS using CloudFormation
# This script deploys the MCP server infrastructure

set -e  # Exit on any error

# Default values
STACK_NAME="mcp-server-deploy"
TEMPLATE_FILE="prod-mcp_server_deploy.yaml"
REGION="us-east-2"
ACCOUNT_ID="933897080848"
DOMAIN="mcp.prajnagpt.net"
KEY_NAME="gpt-aws-key"
EIP_ALLOCATION_ID="eipalloc-0957b2097dab3bd0f"
UBUNTU_AMI="ami-0e83be366243f524a"
INSTANCE_TYPE="t2.small"
MCP_VERSION="latest"
MCP_AUTH_TOKEN="demo-token-123"
LOG_LEVEL="INFO"
MIN_SIZE=1
MAX_SIZE=3
DESIRED_CAPACITY=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --stack-name           CloudFormation stack name (default: $STACK_NAME)"
    echo "  -r, --region               AWS region (default: $REGION)"
    echo "  -d, --domain               Domain name (default: $DOMAIN)"
    echo "  -k, --key-name             EC2 key pair name (default: $KEY_NAME)"
    echo "  -e, --eip-allocation-id    Elastic IP allocation ID (default: $EIP_ALLOCATION_ID)"
    echo "  -i, --instance-type        EC2 instance type (default: $INSTANCE_TYPE)"
    echo "  -v, --mcp-version          MCP Server version (default: $MCP_VERSION)"
    echo "  -t, --auth-token           MCP Auth Token (default: $MCP_AUTH_TOKEN)"
    echo "  -g, --log-level            Log level (default: $LOG_LEVEL)"
    echo "  -a, --ami                  Ubuntu AMI ID (default: $UBUNTU_AMI)"
    echo "  --min-size                 Minimum number of instances (default: $MIN_SIZE)"
    echo "  --max-size                 Maximum number of instances (default: $MAX_SIZE)"
    echo "  --desired-capacity         Desired number of instances (default: $DESIRED_CAPACITY)"
    echo "  -x, --delete               Delete the stack instead of creating/updating"
    echo "  -R, --instance-refresh     Trigger instance refresh after deployment"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy with default values"
    echo "  $0 -v v2.0.1 -d mcp.example.com     # Deploy with custom version and domain"
    echo "  $0 -i t2.medium -v v2.0.1           # Deploy with custom instance type and version"
    echo "  $0 -x                               # Delete the stack"
}

# Parse command line arguments
DELETE_STACK=false
INSTANCE_REFRESH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -k|--key-name)
            KEY_NAME="$2"
            shift 2
            ;;
        -e|--eip-allocation-id)
            EIP_ALLOCATION_ID="$2"
            shift 2
            ;;
        -i|--instance-type)
            INSTANCE_TYPE="$2"
            shift 2
            ;;
        -v|--mcp-version)
            MCP_VERSION="$2"
            shift 2
            ;;
        -t|--auth-token)
            MCP_AUTH_TOKEN="$2"
            shift 2
            ;;
        -g|--log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        -a|--ami)
            UBUNTU_AMI="$2"
            shift 2
            ;;
        --min-size)
            MIN_SIZE="$2"
            shift 2
            ;;
        --max-size)
            MAX_SIZE="$2"
            shift 2
            ;;
        --desired-capacity)
            DESIRED_CAPACITY="$2"
            shift 2
            ;;
        -x|--delete)
            DELETE_STACK=true
            shift
            ;;
        -R|--instance-refresh)
            INSTANCE_REFRESH=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    print_error "Template file not found: $TEMPLATE_FILE"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Discover the ASG name from the stack
get_asg_name() {
    aws cloudformation list-stack-resources \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackResourceSummaries[?ResourceType==`AWS::AutoScaling::AutoScalingGroup`].PhysicalResourceId' \
        --output text 2>/dev/null
}

# Start an Instance Refresh on the ASG
start_instance_refresh() {
    local asg_name="$1"
    if [ -z "$asg_name" ]; then
        print_warning "No Auto Scaling Group found in stack; skipping instance refresh."
        return 0
    fi
    print_status "Starting Instance Refresh on ASG: $asg_name"
    aws autoscaling start-instance-refresh \
        --auto-scaling-group-name "$asg_name" \
        --preferences MinHealthyPercentage=100,InstanceWarmup=60 \
        --region "$REGION" \
        --query 'InstanceRefreshId' \
        --output text 2>/dev/null
}

# Wait for Instance Refresh to complete
wait_instance_refresh() {
    local asg_name="$1"
    local refresh_id="$2"
    if [ -z "$asg_name" ] || [ -z "$refresh_id" ]; then
        return 0
    fi
    print_status "Waiting for Instance Refresh ($refresh_id) to complete..."
    while true; do
        status=$(aws autoscaling describe-instance-refreshes \
            --auto-scaling-group-name "$asg_name" \
            --instance-refresh-ids "$refresh_id" \
            --region "$REGION" \
            --query 'InstanceRefreshes[0].Status' \
            --output text 2>/dev/null || echo "Unknown")
        case "$status" in
            Successful)
                print_status "Instance Refresh completed successfully."
                break
                ;;
            Failed|Cancelled)
                print_error "Instance Refresh $status."
                return 1
                ;;
            *)
                sleep 10
                ;;
        esac
    done
}

# Function to delete stack
delete_stack() {
    print_status "Deleting CloudFormation stack: $STACK_NAME"
    
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"
        print_status "Stack deletion initiated. Waiting for completion..."
        aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION"
        print_status "Stack deleted successfully!"
    else
        print_warning "Stack $STACK_NAME does not exist."
    fi
}

# Function to deploy stack
deploy_stack() {
    print_status "Deploying CloudFormation stack: $STACK_NAME"
    print_status "Template: $TEMPLATE_FILE"
    print_status "Region: $REGION"
    print_status "Parameters:"
    print_status "  - Domain: $DOMAIN"
    print_status "  - Key Name: $KEY_NAME"
    print_status "  - EIP Allocation ID: $EIP_ALLOCATION_ID"
    print_status "  - Instance Type: $INSTANCE_TYPE"
    print_status "  - MCP Version: $MCP_VERSION"
    print_status "  - MCP Auth Token: $MCP_AUTH_TOKEN"
    print_status "  - Log Level: $LOG_LEVEL"
    print_status "  - AMI: $UBUNTU_AMI"
    print_status "  - Min Size: $MIN_SIZE"
    print_status "  - Max Size: $MAX_SIZE"
    print_status "  - Desired Capacity: $DESIRED_CAPACITY"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        print_status "Stack exists. Updating..."
        OPERATION="update-stack"
    else
        print_status "Stack does not exist. Creating..."
        OPERATION="create-stack"
    fi
    
    # Build the CloudFormation command
    CMD="aws cloudformation $OPERATION \
        --stack-name $STACK_NAME \
        --template-body file://$TEMPLATE_FILE \
        --region $REGION \
        --parameters \
            ParameterKey=Region,ParameterValue=$REGION \
            ParameterKey=AccountId,ParameterValue=$ACCOUNT_ID \
            ParameterKey=Domain,ParameterValue=$DOMAIN \
            ParameterKey=KeyName,ParameterValue=$KEY_NAME \
            ParameterKey=ExistingEIPAllocationId,ParameterValue=$EIP_ALLOCATION_ID \
            ParameterKey=UbuntuAMI,ParameterValue=$UBUNTU_AMI \
            ParameterKey=InstanceType,ParameterValue=$INSTANCE_TYPE \
            ParameterKey=MCPVersion,ParameterValue=$MCP_VERSION \
            ParameterKey=MCPAuthToken,ParameterValue=$MCP_AUTH_TOKEN \
            ParameterKey=LogLevel,ParameterValue=$LOG_LEVEL \
            ParameterKey=MinSize,ParameterValue=$MIN_SIZE \
            ParameterKey=MaxSize,ParameterValue=$MAX_SIZE \
            ParameterKey=DesiredCapacity,ParameterValue=$DESIRED_CAPACITY \
        --capabilities CAPABILITY_IAM"
    
    # Execute the command
    print_status "Executing CloudFormation deployment..."
    eval $CMD
    
    if [ $? -eq 0 ]; then
        print_status "CloudFormation $OPERATION initiated successfully!"
        print_status "Waiting for stack operation to complete..."
        
        if [ "$OPERATION" = "create-stack" ]; then
            aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME" --region "$REGION"
        else
            aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME" --region "$REGION"
        fi
        
        print_status "Stack operation completed successfully!"
        
        # Get stack outputs
        print_status "Stack outputs:"
        aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs' --output table 2>/dev/null || print_warning "No outputs available"

        # Optionally trigger an ASG Instance Refresh to replace instances (immutable rollout)
        if [ "$INSTANCE_REFRESH" = true ]; then
            asg_name=$(get_asg_name)
            if refresh_id=$(start_instance_refresh "$asg_name"); then
                wait_instance_refresh "$asg_name" "$refresh_id"
            fi
        fi
        
        # Show important information
        print_status "🎉 MCP Server deployment completed successfully!"
        print_status "Your MCP server should be available at: https://$DOMAIN"
        print_status "API Documentation: https://$DOMAIN/docs"
        print_status "Health Check: https://$DOMAIN/health"
        print_status ""
        print_status "Note: This deployment pulls the Docker image from ECR:"
        print_status "Image: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/mcp-server:$MCP_VERSION"
        print_status "Make sure the image exists in ECR before deployment."
        
    else
        print_error "CloudFormation deployment failed!"
        exit 1
    fi
}

# Main execution
if [ "$DELETE_STACK" = true ]; then
    delete_stack
else
    deploy_stack
fi

print_status "Script completed successfully!"
