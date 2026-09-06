# Production serving runbook

This runbook covers the first production-serving baseline for CSS Admin.

## Production boundary

- Public origin: `https://admin.csscdn.co.uk`
- Dedicated Unix account: `css_admin`
- Repository/runtime directory: `/srv/css-admin/repository`
- Next.js listener: `127.0.0.1:3067`
- Process manager: PM2, one forked process
- Public HTTP/TLS boundary: nginx only
- Production secrets: `/srv/css-admin/repository/.env.production`, never committed

The port and filesystem path are deployment conventions for this service. Verify that `3067` is free before first start. The PM2 definition allows a temporary port override through `CSS_ADMIN_PORT`, but nginx and the accepted production deployment must agree on the same loopback port.

## 1. Inspect the host first

Run these before changing the server:

```bash
node --version
yarn --version
pm2 --version
nginx -v
id css_admin || true
sudo ss -lntp | grep ':3067' || true
```

Requirements:

- Node.js must satisfy `package.json` (`>=22`).
- `3067` must not already be in use.
- nginx must already be installed and managed by systemd.

If PM2 is not installed for the system Node installation, install it with the host's normal Node package-management policy before continuing.

## 2. Create the runtime account and application directory

On a new host:

```bash
sudo adduser --system --group --home /srv/css-admin --shell /bin/bash css_admin
sudo install -d -o css_admin -g css_admin -m 0750 /srv/css-admin/repository
```

Clone or deploy the repository into `/srv/css-admin/repository` and keep the working tree owned by `css_admin:css_admin` for this first baseline.

## 3. Production environment

Create the production environment file as the runtime user and restrict it to that account:

```bash
sudo install -o css_admin -g css_admin -m 0600 /dev/null /srv/css-admin/repository/.env.production
sudoedit /srv/css-admin/repository/.env.production
```

At minimum configure:

```dotenv
MAGENTO_BASE_URL=https://<magento-origin>
MAGENTO_STORE_CODE=<store-code>
```

Optional Magento endpoint overrides may be added when required by the environment. Do not place Magento credentials or tokens in `ecosystem.config.cjs`.

## 4. Install, validate and build

Run as the runtime account:

```bash
sudo -iu css_admin bash -lc '
  cd /srv/css-admin/repository &&
  yarn install --frozen-lockfile &&
  yarn lint &&
  yarn typecheck &&
  yarn build
'
```

Do not use `next dev` in production.

## 5. Start with PM2

The checked-in `ecosystem.config.cjs` starts one production Next.js process bound only to `127.0.0.1:3067`.

```bash
sudo -iu css_admin bash -lc '
  cd /srv/css-admin/repository &&
  pm2 start ecosystem.config.cjs --env production &&
  pm2 save &&
  pm2 status
'
```

Verify the listener:

```bash
sudo ss -lntp | grep ':3067'
curl -fsSI http://127.0.0.1:3067/login
```

The socket must show `127.0.0.1:3067`, not `0.0.0.0:3067` or `[::]:3067`.

### PM2 startup after reboot

Generate the PM2 systemd startup command for `css_admin` and execute the generated root command exactly as PM2 prints it:

```bash
sudo -iu css_admin pm2 startup systemd -u css_admin --hp /srv/css-admin
```

Then save the accepted process list again:

```bash
sudo -iu css_admin pm2 save
```

Check the resulting unit:

```bash
systemctl status pm2-css_admin --no-pager
```

### PM2 logs and rotation

Application logs are available through:

```bash
sudo -iu css_admin pm2 logs css-admin --lines 200
sudo -iu css_admin pm2 describe css-admin
```

For bounded PM2 log retention, install the standard PM2 log-rotation module for the runtime account and configure a conservative baseline:

```bash
sudo -iu css_admin pm2 install pm2-logrotate
sudo -iu css_admin pm2 set pm2-logrotate:max_size 20M
sudo -iu css_admin pm2 set pm2-logrotate:retain 14
sudo -iu css_admin pm2 set pm2-logrotate:compress true
sudo -iu css_admin pm2 save
```

## 6. Install the nginx site

The repository contains the final TLS server block at:

`deploy/nginx/admin.csscdn.co.uk.conf`

It assumes the standard Certbot certificate paths:

- `/etc/letsencrypt/live/admin.csscdn.co.uk/fullchain.pem`
- `/etc/letsencrypt/live/admin.csscdn.co.uk/privkey.pem`

If this host uses a different certificate manager, adjust only the certificate paths/options to match the host's accepted TLS setup. Do not enable the final TLS vhost until a valid certificate exists.

Install and enable the site:

```bash
sudo cp /srv/css-admin/repository/deploy/nginx/admin.csscdn.co.uk.conf \
  /etc/nginx/sites-available/admin.csscdn.co.uk
sudo ln -sfn /etc/nginx/sites-available/admin.csscdn.co.uk \
  /etc/nginx/sites-enabled/admin.csscdn.co.uk
sudo nginx -t
sudo systemctl reload nginx
```

The proxy forwards the canonical Host and `X-Forwarded-*` headers required for application redirects/origin handling, limits uploads to 10 MiB, and allows up to 120 seconds for normal proxied requests such as larger CSV operations.

## 7. Public-origin smoke tests

From the server:

```bash
curl -fsSI https://admin.csscdn.co.uk/login
curl -fsSI http://admin.csscdn.co.uk/login
```

Expected:

- HTTPS responds successfully.
- HTTP redirects to HTTPS.
- `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` and the other configured baseline headers appear on HTTPS responses.

Then complete browser checks through `https://admin.csscdn.co.uk`:

1. Staff login, navigation and logout.
2. Company-user login, company context selection and logout.
3. Session-expiry behaviour.
4. Representative company-management GraphQL read and write.
5. CSV preview and apply.
6. Next.js static assets and route transitions.

## 8. Confirm the Node port is not public

On the host, the listener must remain loopback-only:

```bash
sudo ss -lntp | grep ':3067'
```

From a separate machine, a connection to `<server-public-ip>:3067` must fail. Only ports exposed intentionally by the host firewall/nginx should be reachable publicly.

## 9. Restart and reboot acceptance

Process restart:

```bash
sudo -iu css_admin pm2 restart css-admin
sudo -iu css_admin pm2 status
curl -fsSI https://admin.csscdn.co.uk/login
```

nginx validation/reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Finally reboot the host during the accepted maintenance window. After boot verify:

```bash
systemctl is-active nginx
systemctl is-active pm2-css_admin
sudo -iu css_admin pm2 status
sudo ss -lntp | grep ':3067'
curl -fsSI https://admin.csscdn.co.uk/login
```

No manual `pm2 start` should be required after reboot.

## 10. Release update procedure

For this first baseline, use an explicit maintenance deployment rather than rebuilding `.next` underneath a running process:

```bash
sudo -iu css_admin pm2 stop css-admin
sudo -iu css_admin bash -lc '
  cd /srv/css-admin/repository &&
  git fetch origin &&
  git checkout main &&
  git pull --ff-only &&
  yarn install --frozen-lockfile &&
  yarn lint &&
  yarn typecheck &&
  yarn build &&
  pm2 start ecosystem.config.cjs --env production &&
  pm2 save
'
```

If validation/build fails, do not start the failed release. Restore the last accepted commit and rebuild before returning the service to production.

A later deployment-hardening slice may move this to immutable release directories if zero-downtime or rollback requirements justify the extra machinery.
