terraform {
  required_version = ">= 1.10"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }

  # State lives in the local MinIO that the deploy workflow starts. Backend blocks
  # cannot use variables, so these values are fixed here and the workflow overrides
  # the endpoint (-backend-config) and the per-environment key at init time:
  #   terraform init -backend-config="key=<env>/terraform.tfstate"
  # Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
  backend "s3" {
    bucket                      = "tfstate"
    region                      = "us-east-1"
    endpoints                   = { s3 = "http://127.0.0.1:9000" }
    use_path_style              = true
    use_lockfile                = true
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
  }
}

provider "docker" {}

locals {
  prefix = "${var.project_name}-${var.environment}"

  # One entry per container; everything environment-specific comes from variables.
  services = {
    db = {
      alias          = var.db_alias
      image          = var.db_image
      container_port = var.db_port
      host_port      = null
      volume         = true
      health         = "pg_isready -p ${var.db_port} -U ${var.db_user} -d ${var.db_name}"
      env = merge({
        POSTGRES_USER     = var.db_user
        POSTGRES_PASSWORD = var.db_password
        POSTGRES_DB       = var.db_name
        # Only set for a non-default port, so the default setup is unchanged.
      }, var.db_port == 5432 ? {} : { PGPORT = tostring(var.db_port) })
    }
    backend = {
      alias          = var.backend_alias
      image          = var.backend_image
      container_port = var.backend_port
      host_port      = null
      volume         = false
      health         = "wget -qO- http://127.0.0.1:${var.backend_port}${var.backend_health_path}"
      env = {
        PORT         = tostring(var.backend_port)
        TRUST_PROXY  = var.backend_trust_proxy
        DATABASE_URL = "postgres://${var.db_user}:${var.db_password}@${var.db_alias}:${var.db_port}/${var.db_name}"
      }
    }
    frontend = {
      alias          = var.frontend_alias
      image          = var.frontend_image
      container_port = var.frontend_container_port
      host_port      = var.frontend_host_port
      volume         = false
      health         = "wget -qO- http://127.0.0.1:${var.frontend_container_port}${var.frontend_health_path}"
      env            = {}
    }
  }
}

resource "docker_network" "this" {
  name = local.prefix
}

resource "docker_volume" "db" {
  name = "${local.prefix}-db-data"
}

module "service" {
  source   = "./modules/service"
  for_each = local.services

  name            = "${local.prefix}-${each.key}"
  alias           = each.value.alias
  image           = each.value.image
  network         = docker_network.this.name
  container_port  = each.value.container_port
  host_port       = each.value.host_port
  env             = each.value.env
  volume_name     = each.value.volume ? docker_volume.db.name : ""
  volume_path     = each.value.volume ? var.db_data_path : ""
  host_ip         = var.host_ip
  restart         = var.restart_policy
  healthcheck_cmd = ["CMD-SHELL", "${each.value.health} || exit 1"]

  healthcheck_interval     = var.healthcheck_interval
  healthcheck_timeout      = var.healthcheck_timeout
  healthcheck_retries      = var.healthcheck_retries
  healthcheck_start_period = var.healthcheck_start_period
  wait_timeout             = var.wait_timeout
}
