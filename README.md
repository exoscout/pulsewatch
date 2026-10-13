# PulseWatch — Cloud-Native Uptime Monitoring

PulseWatch is a backend platform that lets users register public websites/APIs, queue health checks, and inspect availability, latency, and check history. It separates the HTTP API from background probe workers.

## Architecture

```text
Client -> Express API -> MongoDB (monitors + history)
               |
               +---- enqueue check ----> Redis / BullMQ
                                             |
                                             v
                                      Worker replicas
                                             |
                                  HTTP probes to targets
                                             |
                                             v
                                     MongoDB results
```

## Tech stack

- Node.js 20+, Express
- MongoDB + Mongoose for monitor configuration and time-series-like check history
- Redis + BullMQ for asynchronous jobs, retries, and queue coordination
- Docker Compose for local multi-service development
- AWS deployment design documented in `terraform/README.md`

## Run locally

Requires Docker Engine and Docker Compose.

```bash
docker compose up --build
```

API: `http://localhost:3000`. The API and worker are separate containers. Scale workers:

```bash
docker compose up --build --scale worker=3
```

Stop containers (preserves data):

```bash
docker compose down
```

Remove containers and local database/queue data:

```bash
docker compose down -v
```

## API examples

### Health

```bash
curl http://localhost:3000/health
```

### Register a monitor

Only public HTTP/HTTPS URLs are accepted. Private/local IPs and hostnames are rejected, and redirects are not followed by the worker.

```bash
curl -X POST http://localhost:3000/monitors \
  -H 'Content-Type: application/json' \
  -d '{"name":"Example website","url":"https://example.com","intervalSeconds":300}'
```

This registers the monitor and queues an initial check. The current starter does not yet run a recurring scheduler; checks are triggered when a monitor is created or when the manual endpoint is called.

### List monitors

```bash
curl http://localhost:3000/monitors
```

### Trigger a manual check

Replace `MONITOR_ID` with the returned MongoDB ID.

```bash
curl -X POST http://localhost:3000/monitors/MONITOR_ID/check
```

### View check history

```bash
curl 'http://localhost:3000/monitors/MONITOR_ID/history?limit=50'
```

### Stats

```bash
curl http://localhost:3000/stats
```

### Delete a monitor

```bash
curl -X DELETE http://localhost:3000/monitors/MONITOR_ID
```

## Design decisions

- **Async work:** API requests enqueue jobs; workers perform probes outside the request lifecycle.
- **Horizontal scaling:** add worker replicas without scaling the API by the same amount.
- **Persistence:** monitor configuration and individual check results are stored separately.
- **Timeouts:** requests have a bounded timeout.
- **Queue retries:** transient worker errors receive a limited retry policy with exponential backoff.
- **Operational visibility:** endpoints expose monitor status, latency history, and queue counts.
- **SSRF defenses:** URL validation rejects common private IP ranges and local hostnames; workers revalidate and disable redirects.

## Important limitations

This is an educational starter, not a production security guarantee. DNS rebinding and cloud metadata protections need stronger network-level egress controls in a production deployment. The current version has no authentication/tenant isolation, no recurring scheduler, no alert delivery, and no production-grade rate limiting. Do not expose it publicly without adding those safeguards.

## Next upgrades

1. Add recurring scheduling using BullMQ repeatable jobs or a dedicated scheduler.
2. Add alert rules (for example, notify only after 3 consecutive failures) and email/webhook delivery.
3. Add API keys, per-user monitor ownership, quotas, and rate limiting.
4. Add percentile latency charts, uptime windows, and a simple dashboard.
5. Add integration tests with real MongoDB and Redis services in CI.
6. Deploy API and worker as separate ECS Fargate services; add ALB, CloudWatch, Secrets Manager, managed Redis, and a managed MongoDB service.

## Run tests

```bash
npm install
npm test
```

The unit tests cover private-IP helper logic. They do not replace live integration tests against MongoDB, Redis, and target websites.

## License

MIT
