# MinIO used as the Terraform state backend for dev/test/prod.
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

variable "minio_user" {
  type    = string
  default = "tfstate"
}

variable "minio_password" {
  type      = string
  sensitive = true
}

resource "docker_volume" "minio" {
  name = "quiz-tfstate-minio"
}

resource "docker_image" "minio" {
  name         = "minio/minio:latest"
  keep_locally = true
}

resource "docker_container" "minio" {
  name    = "quiz-tfstate-minio"
  image   = docker_image.minio.image_id
  restart = "unless-stopped"
  command = ["server", "/data", "--console-address", ":9001"]
  env = [
    "MINIO_ROOT_USER=${var.minio_user}",
    "MINIO_ROOT_PASSWORD=${var.minio_password}",
  ]

  ports {
    internal = 9000
    external = 9000
    ip       = "127.0.0.1"
  }
  ports {
    internal = 9001
    external = 9001
    ip       = "127.0.0.1"
  }

  volumes {
    volume_name    = docker_volume.minio.name
    container_path = "/data"
  }
}

# Create the bucket once MinIO is up.
resource "terraform_data" "bucket" {
  depends_on = [docker_container.minio]

  provisioner "local-exec" {
    command = <<-EOT
      for i in $(seq 1 30); do
        curl -sf http://127.0.0.1:9000/minio/health/ready && break; sleep 1
      done
      docker run --rm --network host --entrypoint /bin/sh minio/mc -c \
        "mc alias set local http://127.0.0.1:9000 '${var.minio_user}' '${var.minio_password}' && mc mb --ignore-existing local/tfstate && mc version enable local/tfstate"
    EOT
  }
}
