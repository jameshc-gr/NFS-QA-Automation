#!/bin/bash

dev_role=$1
assumed_role_arn=arn:aws:iam::336015931235:role/k8s-svc-digital-mortgage-systems-mcp-dev
role_session_name=digital-mortgage-systems-mcp-dev

# Set the enviroment
eval $(aws-sso eval --profile $dev_role)

assumed_role_json=$(aws sts assume-role --role-arn $assumed_role_arn --role-session-name $role_session_name)

aws_access_key_id=$(echo $assumed_role_json | jq -r '.Credentials.AccessKeyId')
aws_secret_access_key=$(echo $assumed_role_json | jq -r '.Credentials.SecretAccessKey')
aws_session_token=$(echo $assumed_role_json | jq -r '.Credentials.SessionToken')


env_vars="AWS_ACCESS_KEY_ID=$aws_access_key_id
AWS_SECRET_ACCESS_KEY=$aws_secret_access_key
AWS_SESSION_TOKEN=$aws_session_token"

echo "$env_vars" > .env.aws