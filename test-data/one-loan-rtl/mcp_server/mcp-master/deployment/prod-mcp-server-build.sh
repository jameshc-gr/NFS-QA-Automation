#!/bin/bash

# Build and push MCP Server Docker image to ECR from EC2
# This script creates an EC2 build instance that builds and pushes the Docker image to ECR

set -e  # Exit on any error

# Default values
STACK_NAME="mcp-server-build"
TEMPLATE_FILE="prod-mcp_server_build.yaml"
REGION="us-east-2"
ACCOUNT_ID="933897080848"
REPOSITORY_NAME="mcp-server"
IMAGE_TAG="latest"
KEY_NAME="gpt-aws-key"
UBUNTU_AMI="ami-0e83be366243f524a"
INSTANCE_TYPE="t2.small"
VPC_ID=""
SUBNET_ID=""
GIT_BRANCH="main"
GIT_TAG="v0.0.0"

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
    echo "  -n, --repository-name      ECR repository name (default: $REPOSITORY_NAME)"
    echo "  -t, --image-tag            Docker image tag (default: $IMAGE_TAG)"
    echo "  -k, --key-name             EC2 key pair name (default: $KEY_NAME)"
    echo "  -a, --ami                  Ubuntu AMI ID (default: $UBUNTU_AMI)"
    echo "  -i, --instance-type        EC2 instance type (default: $INSTANCE_TYPE)"
    echo "  -v, --vpc-id               VPC ID for build instance"
    echo "  -u, --subnet-id            Subnet ID for build instance"
    echo "  -b, --branch               Git branch to build (default: $GIT_BRANCH)"
    echo "  -g, --git-tag              Git tag to build (default: $GIT_TAG)"
    echo "  -x, --delete               Delete the stack instead of creating/updating"
    echo "  -f, --force                Force rebuild even if ECR image exists"
    echo "  -c, --auto-cleanup         Build, wait for completion, and auto-delete stack"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -v vpc-12345 -u subnet-67890                    # Build with VPC and subnet"
    echo "  $0 -t v2.0.1 -n mcp-server-prod -v vpc-12345      # Build with custom tag and repo name"
    echo "  $0 -x                                               # Delete the stack"
}

# Parse command line arguments
DELETE_STACK=false
FORCE_REBUILD=false
AUTO_CLEANUP=false

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
        -n|--repository-name)
            REPOSITORY_NAME="$2"
            shift 2
            ;;
        -t|--image-tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -k|--key-name)
            KEY_NAME="$2"
            shift 2
            ;;
        -a|--ami)
            UBUNTU_AMI="$2"
            shift 2
            ;;
        -i|--instance-type)
            INSTANCE_TYPE="$2"
            shift 2
            ;;
        -v|--vpc-id)
            VPC_ID="$2"
            shift 2
            ;;
        -u|--subnet-id)
            SUBNET_ID="$2"
            shift 2
            ;;
        -b|--branch)
            GIT_BRANCH="$2"
            shift 2
            ;;
        -g|--git-tag)
            GIT_TAG="$2"
            shift 2
            ;;
        -x|--delete)
            DELETE_STACK=true
            shift
            ;;
        -f|--force)
            FORCE_REBUILD=true
            shift
            ;;
        -c|--auto-cleanup)
            AUTO_CLEANUP=true
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

# Validate required parameters
if [ -z "$VPC_ID" ]; then
    print_error "VPC ID is required. Use -v or --vpc-id option."
    exit 1
fi

if [ -z "$SUBNET_ID" ]; then
    print_error "Subnet ID is required. Use -u or --subnet-id option."
    exit 1
fi

# Function to check if ECR image exists
check_ecr_image() {
    local repository_name="$REPOSITORY_NAME"
    local image_tag="$IMAGE_TAG"
    local ecr_uri="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${repository_name}:${image_tag}"
    
    print_status "Checking if ECR image exists: $ecr_uri"
    
    # Check if the repository exists
    if ! aws ecr describe-repositories --repository-names "$repository_name" --region "$REGION" &> /dev/null; then
        print_warning "ECR repository '$repository_name' does not exist."
        return 1
    fi
    
    # Check if the specific image tag exists
    if aws ecr describe-images --repository-name "$repository_name" --image-ids imageTag="$image_tag" --region "$REGION" &> /dev/null; then
        print_status "✅ ECR image $ecr_uri already exists!"
        return 0
    else
        print_status "❌ ECR image $ecr_uri does not exist."
        return 1
    fi
}

# Function to wait for build completion and verify ECR image
wait_for_build_completion() {
    local repository_name="$REPOSITORY_NAME"
    local image_tag="$IMAGE_TAG"
    local ecr_uri="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${repository_name}:${image_tag}"
    local max_wait_time=600  # 10 minutes
    local check_interval=30   # 30 seconds
    local elapsed_time=0
    
    print_status "Waiting for Docker image build and push to complete..."
    print_status "Target ECR image: $ecr_uri"
    print_status "This may take several minutes. Checking every $check_interval seconds..."
    
    while [ $elapsed_time -lt $max_wait_time ]; do
        print_status "Checking ECR for image... (${elapsed_time}s elapsed)"
        
        if check_ecr_image; then
            print_status "✅ Docker image successfully pushed to ECR!"
            print_status "ECR Image: $ecr_uri"
            return 0
        fi
        
        sleep $check_interval
        elapsed_time=$((elapsed_time + check_interval))
        
        # Show progress every 5 minutes
        if [ $((elapsed_time % 300)) -eq 0 ]; then
            print_status "Still waiting for build completion... (${elapsed_time}s elapsed)"
        fi
    done
    
    print_error "Build timeout reached (${max_wait_time}s). Image may not have been pushed successfully."
    return 1
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
    print_status "  - Repository Name: $REPOSITORY_NAME"
    print_status "  - Image Tag: $IMAGE_TAG"
    print_status "  - Key Name: $KEY_NAME"
    print_status "  - Ubuntu AMI: $UBUNTU_AMI"
    print_status "  - Instance Type: $INSTANCE_TYPE"
    print_status "  - VPC ID: $VPC_ID"
    print_status "  - Subnet ID: $SUBNET_ID"
    print_status "  - Git Branch: $GIT_BRANCH"
    print_status "  - Git Tag: $GIT_TAG"
    
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
            ParameterKey=RepositoryName,ParameterValue=$REPOSITORY_NAME \
            ParameterKey=ImageTag,ParameterValue=$IMAGE_TAG \
            ParameterKey=KeyName,ParameterValue=$KEY_NAME \
            ParameterKey=UbuntuAMI,ParameterValue=$UBUNTU_AMI \
            ParameterKey=InstanceType,ParameterValue=$INSTANCE_TYPE \
            ParameterKey=VpcId,ParameterValue=$VPC_ID \
            ParameterKey=SubnetId,ParameterValue=$SUBNET_ID \
            ParameterKey=GitBranch,ParameterValue=$GIT_BRANCH \
            ParameterKey=GitTag,ParameterValue=$GIT_TAG \
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
        
        # Get build instance ID
        BUILD_INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`BuildInstanceId`].OutputValue' --output text)
        
        # Show important information
        print_status "🎉 MCP Server build infrastructure deployed successfully!"
        print_status "Repository URI: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME"
        print_status "Build Instance ID: $BUILD_INSTANCE_ID"
        print_status ""
        print_status "Next steps:"
        print_status "1. SSH into the build instance to upload your source code:"
        print_status "   ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@<build-instance-ip>"
        print_status "2. Upload your MCP source code to /opt/mcp-build/"
        print_status "3. Run the build script: sudo systemctl start mcp-build.service"
        print_status "4. Monitor build progress: sudo journalctl -u mcp-build.service -f"
        
    else
        print_error "CloudFormation deployment failed!"
        exit 1
    fi
}

# Main execution
if [ "$DELETE_STACK" = true ]; then
    delete_stack
else
    # Check if ECR image already exists (unless force rebuild is requested)
    if [ "$FORCE_REBUILD" = true ]; then
        print_status "Force rebuild requested. Proceeding with build process..."
        deploy_stack
        
        if [ "$AUTO_CLEANUP" = true ]; then
            # Wait for build completion and auto-delete
            if wait_for_build_completion; then
                print_status "Build completed successfully! Auto-deleting stack..."
                delete_stack
                print_status "✅ Build and cleanup completed successfully!"
            else
                print_error "Build failed or timed out. Stack will remain for manual inspection."
                exit 1
            fi
        else
            # Manual cleanup mode
            print_status "Waiting for Docker image build and push to complete..."
            print_status "This may take several minutes. You can monitor the EC2 instance in the AWS console."
            print_warning "Note: The EC2 instance will continue running until you manually delete the stack."
            print_warning "Run './deployment/mcp-server-build.sh -d' to delete the stack after the build completes."
        fi
    elif check_ecr_image; then
        print_status "Target image version $IMAGE_TAG already exists in ECR!"
        print_status "Checking if build stack exists and cleaning up..."
        
        # Check if the build stack exists and delete it
        if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
            print_status "Build stack exists. Deleting to save costs..."
            delete_stack
        else
            print_status "No build stack found. Nothing to clean up."
        fi
        
        print_status "✅ Build process skipped - image already exists in ECR!"
        print_status "ECR Image: ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:${IMAGE_TAG}"
        print_status "Use -f/--force flag to rebuild anyway."
    else
        print_status "Target image version $IMAGE_TAG does not exist in ECR."
        print_status "Proceeding with build process..."
        deploy_stack
        
        if [ "$AUTO_CLEANUP" = true ]; then
            # Wait for build completion and auto-delete
            if wait_for_build_completion; then
                print_status "Build completed successfully! Auto-deleting stack..."
                delete_stack
                print_status "✅ Build and cleanup completed successfully!"
            else
                print_error "Build failed or timed out. Stack will remain for manual inspection."
                exit 1
            fi
        else
            # Manual cleanup mode
            print_status "Waiting for Docker image build and push to complete..."
            print_status "This may take several minutes. You can monitor the EC2 instance in the AWS console."
            print_warning "Note: The EC2 instance will continue running until you manually delete the stack."
            print_warning "Run './deployment/mcp-server-build.sh -d' to delete the stack after the build completes."
        fi
    fi
fi

print_status "Script completed successfully!"
