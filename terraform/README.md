# AWS deployment direction

The Docker image is ready to build and push to Amazon ECR. For a secure, complete deployment, use:
- ECS Fargate services: one API service and one worker service
- Application Load Balancer for the public API
- CloudWatch Logs and alarms
- Managed Redis (ElastiCache) and a managed MongoDB provider
- Secrets Manager for database credentials
- Private subnets for workers and data stores; only the load balancer is public

This starter intentionally does not create AWS resources automatically. Networking, secrets, and managed database costs need to be configured deliberately before deployment. Never commit credentials or Terraform state containing secrets.
