# ---------------------------------------------------------------------------
# ElastiCache Redis — MCP tool-result cache
# ---------------------------------------------------------------------------

# Allow port 6379 from within the VPC only (no public exposure)
resource "aws_security_group" "redis" {
  name        = "${var.app_name}-redis-${var.environment}"
  description = "Allow Redis 6379 inbound from VPC CIDR only"
  vpc_id      = data.aws_vpc.vpc.id

  ingress {
    description = "Redis from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(module.tagging.value, { Name = "${var.app_name}-redis-${var.environment}" })
}

# Place the cluster in private subnets — reuse existing subnet group rather than creating one
data "aws_elasticache_subnet_group" "redis" {
  name = "one-loan-redis-subnets"
}

# Single-node (dev) or multi-node (prod) Redis replication group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "mcp-cache-${var.environment}"
  description          = "MCP tool-result cache - ${var.environment}"

  engine         = "redis"
  engine_version = "7.1"
  node_type      = var.redis_node_type
  port           = 6379

  # num_cache_clusters=1 → single node (dev). Set to 2+ to enable Multi-AZ failover.
  num_cache_clusters         = var.redis_num_nodes
  automatic_failover_enabled = var.redis_num_nodes > 1
  multi_az_enabled           = var.redis_num_nodes > 1

  subnet_group_name  = data.aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # set true in prod and use rediss:// URL

  apply_immediately        = true
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_window          = "03:00-04:00"
  snapshot_retention_limit = 1

  tags = merge(module.tagging.value, { Name = "mcp-cache-${var.environment}" })
}
