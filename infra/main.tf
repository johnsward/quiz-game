terraform {
  required_version = ">= 1.10"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }

  # State lives in the local MinIO from infra/bootstrap. The per-environment
  # key is supplied at init time:
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
  prefix = "quiz-${var.environment}"

  # One entry per container; everything environment-specific comes from variables.
  services = {
    db = {
      image          = var.db_image
      container_port = 5432
      host_port      = null
      volume         = true
      health         = "pg_isready -U ${var.db_user} -d ${var.db_name}"
      env = {
        POSTGRES_USER     = var.db_user
        POSTGRES_PASSWORD = var.db_password
        POSTGRES_DB       = var.db_name
      }
    }
    backend = {
      image          = var.backend_image
      container_port = var.backend_port
      host_port      = null
      volume         = false
      health         = "wget -qO- http://127.0.0.1:${var.backend_port}/api/health"
      env = {
        PORT         = tostring(var.backend_port)
        TRUST_PROXY  = "1"
        DATABASE_URL = "postgres://${var.db_user}:${var.db_password}@db:5432/${var.db_name}"
      }
    }
    frontend = {
      image          = var.frontend_image
      container_port = 80
      host_port      = var.frontend_host_port
      volume         = false
      health         = "wget -qO- http://127.0.0.1/healthz"
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
  alias           = each.key
  image           = each.value.image
  network         = docker_network.this.name
  container_port  = each.value.container_port
  host_port       = each.value.host_port
  env             = each.value.env
  volume_name     = each.value.volume ? docker_volume.db.name : ""
  volume_path     = each.value.volume ? "/var/lib/postgresql/data" : ""
  healthcheck_cmd = ["CMD-SHELL", "${each.value.health} || exit 1"]
}
