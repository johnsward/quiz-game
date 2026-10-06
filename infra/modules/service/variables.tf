variable "name" {
  description = "Container name (unique per environment)."
  type        = string
}

variable "alias" {
  description = "Network alias other containers use to reach this one (defaults to name)."
  type        = string
  default     = ""
}

variable "image" {
  description = "Full image reference including tag."
  type        = string
}

variable "network" {
  description = "Docker network to attach to."
  type        = string
}

variable "env" {
  description = "Environment variables."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "container_port" {
  type    = number
  default = 0
}

variable "host_port" {
  description = "Published host port, or null to keep the service internal."
  type        = number
  default     = null
}

variable "host_ip" {
  type    = string
  default = "127.0.0.1"
}

variable "volume_name" {
  type    = string
  default = ""
}

variable "volume_path" {
  type    = string
  default = ""
}

variable "healthcheck_cmd" {
  type = list(string)
}
