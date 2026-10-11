# Every tunable value lives here. Defaults can be overridden per environment in
# envs/<env>.tfvars or on the command line with -var.

# --- Environment -------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, test, prod); prefixes all resource names."
  type        = string
}

variable "project_name" {
  description = "Prefix for every Docker resource: <project_name>-<environment>-<service>."
  type        = string
  default     = "quiz"
}

# --- Images ------------------------------------------------------------------

variable "frontend_image" {
  description = "Frontend image incl. tag; changed independently of the backend."
  type        = string
}

variable "backend_image" {
  description = "Backend image incl. tag; changed independently of the frontend."
  type        = string
}

variable "db_image" {
  description = "Postgres image incl. tag."
  type        = string
  default     = "postgres:17-alpine"
}

# --- Database ----------------------------------------------------------------

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

variable "db_port" {
  description = "Port Postgres listens on inside its container."
  type        = number
  default     = 5432
}

variable "db_data_path" {
  description = "Path inside the database container where the data volume is mounted."
  type        = string
  default     = "/var/lib/postgresql/data"
}

variable "db_alias" {
  description = "Network name the backend uses to reach the database."
  type        = string
  default     = "db"
}

# --- Backend -----------------------------------------------------------------

variable "backend_port" {
  description = "Port the backend listens on. The frontend's nginx.conf proxies /api to this port, so change both together."
  type        = number
  default     = 3001
}

variable "backend_alias" {
  description = "Network name the frontend uses to reach the backend (must match frontend/nginx.conf)."
  type        = string
  default     = "backend"
}

variable "backend_health_path" {
  description = "HTTP path used by the backend health check."
  type        = string
  default     = "/api/health"
}

variable "backend_trust_proxy" {
  description = "Value of the backend TRUST_PROXY setting (1 behind nginx)."
  type        = string
  default     = "1"
}

# --- Frontend ----------------------------------------------------------------

variable "frontend_alias" {
  description = "Network name of the frontend container."
  type        = string
  default     = "frontend"
}

variable "frontend_container_port" {
  description = "Port nginx listens on inside the frontend container."
  type        = number
  default     = 80
}

variable "frontend_host_port" {
  description = "Host port the frontend is published on. Defaults per environment are set in envs/<env>.tfvars (dev 8081, test 8082, prod 8080)."
  type        = number
}

variable "frontend_health_path" {
  description = "HTTP path used by the frontend health check."
  type        = string
  default     = "/healthz"
}

variable "host_ip" {
  description = "Host interface the frontend port is bound to (127.0.0.1 = this machine only, 0.0.0.0 = all interfaces)."
  type        = string
  default     = "127.0.0.1"
}

variable "public_host" {
  description = "Host name used to build the frontend_url output."
  type        = string
  default     = "localhost"
}

# --- Container behaviour -----------------------------------------------------

variable "restart_policy" {
  description = "Docker restart policy for all containers."
  type        = string
  default     = "unless-stopped"
}

variable "healthcheck_interval" {
  type    = string
  default = "5s"
}

variable "healthcheck_timeout" {
  type    = string
  default = "3s"
}

variable "healthcheck_retries" {
  type    = number
  default = 10
}

variable "healthcheck_start_period" {
  type    = string
  default = "10s"
}

variable "wait_timeout" {
  description = "Seconds Terraform waits for a container to become healthy."
  type        = number
  default     = 120
}
