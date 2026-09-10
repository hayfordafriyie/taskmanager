# System Caddy Setup for acs.edspike.com

Run the following commands to add the taskmanager domain to the system Caddy and reload:

```bash
sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'BLOCK'

# Task Manager
acs.edspike.com {
    import edspike_origin_guard
    rate_limit {
        zone per_ip {
            key {remote_host}
            events 100
            window 1m
            ipv6_prefix 64
        }
    }
    encode zstd gzip
    route /api/* {
        reverse_proxy 127.0.0.1:8080
    }
    route {
        reverse_proxy 127.0.0.1:5173
    }
}
BLOCK

sudo systemctl reload caddy
```

Then verify:

```bash
curl -I https://acs.edspike.com
curl -I https://acs.edspike.com/api/v1/health
```
