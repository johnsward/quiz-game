variable "environment" {
  description = "Environment name (dev, test, prod); prefixes all resource names."
  type        = string
}

variable "frontend_image" {
  description = "Frontend image incl. tag; changed independently of the backend."
  type        = string
}

variable "backend_image" {
  description = "Backend image incl. tag; changed independently of the frontend."
  type        = string
}

variable "db_image" {
  type    = string
  default = "postgres:17-alpine"
}

variable "db_user" {
  type    = string
  default = "quiz"
}

variable "db_name" {
  type    = string
  default = "quiz"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "backend_port" {
  type    = number
  default = 3001
}

variable "frontend_host_port" {
  description = "Host port the frontend is published on."
  type        = number
}
