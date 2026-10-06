terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

# Reusable "one container" module used for db, backend and frontend.
resource "docker_image" "this" {
  name         = var.image
  keep_locally = true
}

resource "docker_container" "this" {
  name    = var.name
  image   = docker_image.this.image_id
  restart = "unless-stopped"
  env     = [for k, v in var.env : "${k}=${v}"]

  networks_advanced {
    name    = var.network
    aliases = [var.alias != "" ? var.alias : var.name]
  }

  dynamic "ports" {
    for_each = var.host_port == null ? [] : [var.host_port]
    content {
      internal = var.container_port
      external = ports.value
      ip       = var.host_ip
    }
  }

  dynamic "volumes" {
    for_each = var.volume_name == "" ? [] : [var.volume_name]
    content {
      volume_name    = volumes.value
      container_path = var.volume_path
    }
  }

  healthcheck {
    test         = var.healthcheck_cmd
    interval     = "5s"
    timeout      = "3s"
    retries      = 10
    start_period = "10s"
  }

  # Wait until the container reports healthy so dependents start in order.
  wait         = true
  wait_timeout = 120
}
