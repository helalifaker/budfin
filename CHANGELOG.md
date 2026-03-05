# Changelog

All notable changes to BudFin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Database is automatically initialized with required extensions and security roles on first startup (#15)
- Application secrets (JWT keys, encryption keys, database credentials) are generated automatically via a setup script, removing the need for manual configuration (#16)
- Structured application logging with Winston provides timestamped, searchable log output for troubleshooting and audit purposes (#17)
- Automated CI/CD pipeline runs tests, linting, and type checks in parallel on every code change, with quality gates that prevent broken code from being deployed (#18)
- Backup and restore scripts allow scheduled or on-demand database backups with point-in-time recovery capability (#19)
- Database maintenance scripts for vacuum and reindex operations keep the database performant over time (#20)
- Nginx reverse proxy with SSL/TLS encryption secures all network traffic; local development uses mkcert for HTTPS without browser warnings (#21)
- Health check endpoint now reports database connectivity status and application uptime, enabling monitoring tools to detect outages faster (#22)
- Application performance metrics (request durations, error rates, calculation times) are collected and exposed for future Grafana dashboards (#23)
- Docker containers are hardened for production with non-root users, read-only filesystems, resource limits, and automatic restart policies (#24)
