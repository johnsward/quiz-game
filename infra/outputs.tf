output "frontend_url" {
  value = "http://${var.public_host}:${var.frontend_host_port}"
}
