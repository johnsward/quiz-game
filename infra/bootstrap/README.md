# State backend bootstrap

```bash
cd infra/bootstrap
terraform init
terraform apply -var 'minio_password=<choose-a-password>'
```

Creates MinIO on `127.0.0.1:9000` (console `:9001`) and the `tfstate` bucket.
Each environment then stores its state at `tfstate/<env>/terraform.tfstate` (key passed via `-backend-config`).
Export credentials for the envs (never commit them):

```bash
export AWS_ACCESS_KEY_ID=tfstate
export AWS_SECRET_ACCESS_KEY=<same-password>
```
