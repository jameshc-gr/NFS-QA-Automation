# MCP Server VPC Deployment Guide

This guide explains how to deploy the MCP server with VPC-only access using the `dev-mcp-build-deploy.sh` script and `dev-mcp_deploy.yaml` CloudFormation template.

## 🏗️ **Architecture Overview**

```
Internet
    ↓
VPC (Internal Only)
    ↓
Application Load Balancer (Internal)
    ↓
Auto Scaling Group
    ↓
EC2 Instances (Private Subnets)
    ↓
MCP Server (Port 8080)
```

## 🔧 **Prerequisites**

### **1. AWS Resources Required**
- **VPC**: Existing VPC with private and public subnets
- **Route 53**: Hosted zone for `prajnaapi.com`
- **ECR**: Container registry for Docker images
- **IAM**: Permissions for EC2, ECR, ELB, Route 53, CloudFormation

### **2. Local Tools Required**
- AWS CLI configured with appropriate permissions
- Docker installed and running (not required when SKIP_BUILD=true)
- Git (to clone the repository)

## 📋 **Step-by-Step Deployment**

### **Step 1: Identify VPC Resources**

Run the VPC setup helper to identify your resources:

```bash
cd deployment
./setup-vpc.sh interactive
```

This will:
- List all VPCs in your region
- Show subnets for each VPC
- Display security groups
- Check Route 53 hosted zone
- Generate a configuration file

### **Step 2: Set Required Environment Variables**

Use env vars with the unified script instead of editing multiple files:

```bash
export VPC_ID=vpc-xxxxxxxxxxxxxxxxx
export AWS_PROFILE=dev   # or prod
export DEPLOY_ENV=dev    # or prod (enables auto-detection of prod defaults)

# Optional for prod-only deployments
export NAT_ALLOCATION_ID=eipalloc-xxxxxxxxxxxx    # existing unassociated EIP in that account/region
export HOSTED_ZONE_NAME=yourdomain.com.          # must end with a dot
export KEY_NAME=prod-key-name                    # override EC2 key pair
```

### **Step 3: Deploy the MCP Server (Unified)**

```bash
# Build + Deploy (dev) from local
./deployment/dev-mcp-build-deploy.sh latest INFO dev

# Deploy-only (prod) using a prebuilt ECR tag, skipping local build (auto-detect prod defaults)
SKIP_BUILD=true \
AWS_PROFILE=prod \
DEPLOY_ENV=prod \
./deployment/dev-mcp-build-deploy.sh prod-YYYYMMDD INFO prod

# Optional: explicitly override auto-detected prod values
SKIP_BUILD=true AWS_PROFILE=prod DEPLOY_ENV=prod \
VPC_ID=vpc-xxxxxxxx NAT_ALLOCATION_ID=eipalloc-xxxxxxxx \
HOSTED_ZONE_NAME=yourdomain.com. KEY_NAME=prod-key \
./deployment/dev-mcp-build-deploy.sh prod-YYYYMMDD INFO prod
```

## 🔒 **Security Configuration**

### **VPC-Only Access**
The deployment creates:
- **Internal ALB**: Only accessible from within the VPC
- **Private Subnets**: EC2 instances in private subnets
- **Security Groups**: Restrictive rules for VPC access only

### **Security Groups Created**

#### **ALB Security Group**
- **Inbound**: HTTP (80), HTTPS (443) from VPC security group
- **Outbound**: All traffic

#### **VPC Security Group**
- **Inbound**: 
  - Port 8080 from ALB security group
  - SSH (22) from VPC CIDR
- **Outbound**: All traffic

## 🌐 **DNS Configuration**

### **Route 53 Record**
The deployment creates:
- **A Record**: `mcp.prajnagpt.net` (or your `Domain` parameter) → Internal ALB
- **Alias**: Points to ALB DNS name

### **Access Notes**
- This is VPC-only. Access endpoints from within the VPC (bastion/SSM/VPN).

## 🔧 **Configuration Options**

### **Environment Variables**
```bash
# Server Configuration
MCP_HOST=0.0.0.0
MCP_PORT=8080
MCP_AUTH_ENABLED=true
MCP_AUTH_TOKEN=your-secure-token

# Logging
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
```

### **Auto Scaling Configuration**
```bash
MinSize=1        # Minimum instances
MaxSize=3        # Maximum instances
DesiredCapacity=2 # Desired instances
```

## 🚀 **Deployment Process**

The unified deployment performs these steps:

1. **Prerequisites Check**
   - Verify AWS CLI, Docker, credentials
   - Check required permissions

2. **Docker Image Build (optional)**
   - If `SKIP_BUILD=true`, this step is skipped (uses prebuilt ECR image)
   - Otherwise, build/tag/push to ECR

3. **CloudFormation Deployment**
   - Create/update CloudFormation stack
   - Deploy infrastructure resources
   - Wait for completion

4. **Post-Deploy Info**
   - Outputs ALB DNS and domain (internal only)
   - Perform any tests from inside the VPC

## 📊 **Monitoring and Logs**

### **CloudWatch Logs**
- **Log Group**: `/aws/ec2/mcp-server`
- **Retention**: 30 days
- **Log Level**: Configurable via environment

### **Health Checks**
- **ALB Health Check**: `/health` endpoint
- **Interval**: 30 seconds
- **Timeout**: 5 seconds
- **Healthy Threshold**: 2 consecutive successes
- **Unhealthy Threshold**: 3 consecutive failures

## 🔍 **Troubleshooting**

### **Common Issues**

#### **1. VPC Configuration**
```bash
# Check VPC and subnets
./setup-vpc.sh list-vpcs
./setup-vpc.sh list-subnets vpc-xxxxxxxxx
```

#### **2. Security Groups**
```bash
# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
```

#### **3. Route 53**
```bash
# Check hosted zone
./setup-vpc.sh check-route53
```

#### **4. Instance Health**
```bash
# Check ALB target health
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:...
```

### **Logs and Debugging**

#### **View Application Logs**
```bash
# SSH to instance and check Docker logs
docker logs mcp-server
```

#### **Check CloudWatch Logs**
```bash
# View logs in CloudWatch
aws logs describe-log-streams --log-group-name /aws/ec2/mcp-server
```

## 🔄 **Updates and Maintenance**

### **Update MCP Server**
```bash
# Deploy new version
./mcp-vpc-deploy.sh v2.0.0
```

### **Scale Instances**
```bash
# Update Auto Scaling Group
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name mcp-asg \
  --min-size 2 \
  --max-size 5 \
  --desired-capacity 3
```

### **Update Security Groups**
```bash
# Modify security group rules via AWS Console or CLI
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 8080 \
  --source-group sg-yyyyyyyyy
```

## 🗑️ **Cleanup**

### **Delete Deployment**
```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name mcp-unified-server --region <region> --profile <profile>

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name mcp-unified-server --region <region> --profile <profile>
```

### **Clean Up Resources**
- ECR images (if no longer needed)
- Route 53 records (if not using domain)
- Security groups (if custom created)

## 📝 **Best Practices**

### **Security**
- Use strong authentication tokens
- Regularly rotate tokens
- Monitor access logs
- Keep instances updated

### **Performance**
- Monitor ALB metrics
- Adjust Auto Scaling based on load
- Use appropriate instance types
- Enable CloudWatch detailed monitoring

### **Cost Optimization**
- Use Spot instances for non-critical workloads
- Right-size instances based on usage
- Monitor and optimize EBS volumes
- Clean up unused resources

## 🆘 **Support**

For issues or questions:
1. Check CloudWatch logs
2. Verify security group rules
3. Test connectivity from within VPC
4. Review Auto Scaling Group health
5. Check Route 53 DNS resolution

## 📚 **Additional Resources**

- [AWS VPC Documentation](https://docs.aws.amazon.com/vpc/)
- [Application Load Balancer Guide](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
- [Auto Scaling Documentation](https://docs.aws.amazon.com/autoscaling/)
- [Route 53 Documentation](https://docs.aws.amazon.com/route53/)
