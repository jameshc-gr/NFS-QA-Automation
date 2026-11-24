import boto3
import os
import json
import logging
import hvac
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


VAULT_SECRET_PATH = "secret/digital-mortgage-ai/okta/owning/config"

# Maps Vault secret keys -> environment variable names
VAULT_KEY_MAP = {
    "apiClientId":           "BORROWER_OKTA_CLIENT_ID",
    "apiJwksKid":            "BORROWER_OKTA_JWKS_KID",
    "apiPrivateKey":         "BORROWER_OKTA_PRIVATE_KEY",
    "apiPublicKey":          "BORROWER_OKTA_PUBLIC_KEY",
    "apiScopes":             "BORROWER_OKTA_SCOPES",
    "authServerAudience":    "BORROWER_OKTA_AUTH_SERVER_AUDIENCE",
    "authServerId":          "BORROWER_OKTA_AUTH_SERVER_ID",
    "borrowerGroupId":       "BORROWER_OKTA_BORROWER_GROUP_ID",
    "firstTimeLoginGroupId": "BORROWER_OKTA_FIRST_LOGIN_GROUP_ID",
    "firstTimeLoginGroupName": "BORROWER_OKTA_FIRST_LOGIN_GROUP_NAME",
    "mfaGroupId":            "BORROWER_OKTA_MFA_GROUP_ID",
    "oktaHost":              "BORROWER_OKTA_HOST",
    "vanityUrl":             "BORROWER_OKTA_VANITY_URL",
}


def load_vault_secrets() -> None:
    """
    Load secrets from HashiCorp Vault using AWS IAM auth and set them
    as environment variables.

    The pod's existing IAM role is used automatically via boto3 — no
    extra credentials or token files required.
    """
    vault_addr = os.getenv("VAULT_ADDR", "https://vault.dev.platform.rate.com")
    if not vault_addr:
        raise ValueError("Vault address must be set via VAULT_ADDR")

    client = hvac.Client(url=vault_addr)
    # Pod / CI: authenticate via the pod's IAM role using AWS IAM auth
    vault_role = os.getenv("VAULT_ROLE", "arn-aws-iam-336015931235-role-k8s-svc-digital-mortgage-systems-mcp-dev")
    if not vault_role:
        raise ValueError("Vault role must be set via VAULT_ROLE")

    session = boto3.session.Session()
    credentials = session.get_credentials().get_frozen_credentials()

    client.auth.aws.iam_login(
        access_key=credentials.access_key,
        secret_key=credentials.secret_key,
        session_token=credentials.token,
        role=vault_role,
        mount_point="aws",
    )

    if not client.is_authenticated():
        raise RuntimeError("Vault authentication failed")

    # Determine mount point and sub-path from the full secret_path
    parts = VAULT_SECRET_PATH.split("/", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid secret_path: '{VAULT_SECRET_PATH}'. Expected '<mount>/<path>'.")
    mount_point, path = parts

    response = client.secrets.kv.v2.read_secret_version(
        path=path,
        mount_point=mount_point,
    )

    secrets = response.get("data", {}).get("data", {})
    if not secrets:
        raise ValueError(f"No data found at Vault path '{VAULT_SECRET_PATH}'")

    for key, value in secrets.items():
        env_key = VAULT_KEY_MAP.get(key, key)
        if env_key == "BORROWER_OKTA_SCOPES" and isinstance(value, list):
            value = " ".join(value)
        os.environ[env_key] = str(value)

    logger.info(f"Loaded {len(secrets)} secret(s) from Vault path '{VAULT_SECRET_PATH}'")


def load_secrets():
    """ Method to load secrets from AWS Secrets Manager and Vault into environment variables """
    # Load secrets from Vault first
    try:
        load_vault_secrets()
    except Exception as e:
        logger.exception(f"Failed to load Vault secrets: {e}")

    # Read secret name from env (set in K8s deployment manifest per environment)
    secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
    region_name = "us-east-1"

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        raise e

    secrets = json.loads(response['SecretString'])

    # Load secrets into environment variables
    for key, value in secrets.items():
        os.environ[key] = value


if __name__ == "__main__":
    load_secrets()
