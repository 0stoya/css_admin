# Production serving runbook

This runbook covers the first production-serving baseline for CSS Admin on `oneflow-prod-01`.

## Production boundary

- Public origin: `https://admin.csscdn.co.uk`
- Dedicated Unix account: `css_admin`
- Runtime account home / PM2 state: `/srv/css-admin`
- Repository/runtime directory: `/srv/css/css_admin`
- Next.js listener: `127.0.0.1:3067`
- Process manager: PM2, one forked process
- Public HTTP/TLS boundary: nginx only
- ACME webroot: `/var/www/css-acme`
- Production secrets: `/srv/css/css_admin/.env.production`, never committed

The production host was inspected on 6 Sep 2026: Node 24.19.0, Yarn 1.22.22, PM2 7.0.3 and nginx 1.24.0 are installed, nginx is active, `nginx -t` passes, DNS for `admin.csscdn.co.uk` resolves to the host, and TCP port 3067 is free.

## 1. Create the runtime account and hand off the checkout

Create the dedicated account without creating a second application checkout:

```bash
sudo adduser --system --group --home /srv/css-admin --shell /bin/bash css_admin
sudo chown -R css_admin:css_admin /srv/css/css_admin
```

Keep `/srv/css` itself owned by root. The application working tree under `/srv/css/css_admin` is owned by `css_admin:css_admin` so that the runtime account can install dependencies, build `.next`, update the checkout and run PM2 without root.

## 2. Production environment

Next.js loads `.env.local` in production as well as development, and `.env.local` has higher precedence than `.env.production`. Do not leave a stale `.env.local` beside the production file.

If the current `.env.local` already contains the accepted production Magento endpoints, migrate it without printing its contents:

```bash
sudo -u css_admin cp /srv/css/css_admin/.env.local /srv/css/css_admin/.env.production
sudo chmod 0600 /srv/css/css_admin/.env.production
sudo rm /srv/css/css_admin/.env.local
```

Otherwise create `/srv/css/css_admin/.env.production` directly and then remove `.env.local` after the production values are confirmed.

At minimum configure:

```dotenv
MAGENTO_BASE_URL=https://<magento-origin>
MAGENTO_STORE_CODE=<store-code>
```

Optional Magento endpoint overrides may be added when required by the environment. Do not place Magento credentials or tokens in `ecosystem.config.cjs`.

## 3. Check out the production-serving PR and build

Before merge/runtime acceptance, validate the exact PR branch on the host:

```bash
sudo -iu css_admin bash -lc '
  cd /srv/css/css_admin &&
  git fetch origin &&
  git checkout chore/production-serving-pm2-nginx &&
  git reset --hard origin/chore/production-serving-pm2-nginx &&
  yarn install --frozen-lockfile &&
  yarn lint &&
  yarn typecheck &&
  yarn build
'
```

Do not use `next dev` in production.

## 4. Start with PM2

The checked-in `ecosystem.config.cjs` starts one production Next.js process bound only to `127.0.0.1:3067`.

```bash
sudo -iu css_admin bash -lc '
  cd /srv/css/css_admin &&
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

For bounded PM2 log retention:

```bash
sudo -iu css_admin pm2 install pm2-logrotate
sudo -iu css_admin pm2 set pm2-logrotate:max_size 20M
sudo -iu css_admin pm2 set pm2-logrotate:retain 14
sudo -iu css_admin pm2 set pm2-logrotate:compress true
sudo -iu css_admin pm2 save
```

## 5. Obtain the TLS certificate

The host uses Certbot with the shared webroot `/var/www/css-acme`. The final checked-in nginx site references a per-host certificate at `/etc/letsencrypt/live/admin.csscdn.co.uk/`.

Because the certificate does not exist on first deployment, install a temporary HTTP-only site first:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name admin.csscdn.co.uk;

    access_log /var/log/nginx/css-admin-access.log;
    error_log /var/log/nginx/css-admin-error.log;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/css-acme;
        default_type text/plain;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

Save it as `/etc/nginx/sites-available/admin.csscdn.co.uk`, enable it, validate nginx and reload:

```bash
sudo ln -sfn /etc/nginx/sites-available/admin.csscdn.co.uk /etc/nginx/sites-enabled/admin.csscdn.co.uk
sudo nginx -t
sudo systemctl reload nginx
```

Then request the certificate through the same webroot used by `app.csscdn.co.uk`:

```bash
sudo certbot certonly --webroot -w /var/www/css-acme -d admin.csscdn.co.uk
```

Confirm the certificate exists before installing the final TLS vhost:

```bash
sudo certbot certificates
sudo test -r /etc/letsencrypt/live/admin.csscdn.co.uk/fullchain.pem
sudo test -r /etc/letsencrypt/live/admin.csscdn.co.uk/privkey.pem
```

## 6. Install the final nginx site

Install the checked-in site after the certificate has been issued:

```bash
sudo cp /srv/css/css_admin/deploy/nginx/admin.csscdn.co.uk.conf /etc/nginx/sites-available/admin.csscdn.co.uk
sudo ln -sfn /etc/nginx/sites-available/admin.csscdn.co.uk /etc/nginx/sites-enabled/admin.csscdn.co.uk
sudo nginx -t
sudo systemctl reload nginx
```

The site mirrors the accepted CSS host conventions: shared ACME webroot, dedicated access/error logs, HTTP-to-HTTPS redirect, Let's Encrypt TLS files, explicit forwarded HTTPS host/proto/port headers and a loopback-only upstream. The Admin request-body ceiling is 10 MiB and proxy read/send timeouts are 120 seconds to accommodate CSV workflows.

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

## 10. Merge and normal release update

Do not merge the production-serving PR until the host acceptance checks above are green. After merge, return the deployment checkout to `main`:

```bash
sudo -iu css_admin bash -lc '
  cd /srv/css/css_admin &&
  git fetch origin &&
  git checkout main &&
  git reset --hard origin/main
'
```

For later releases, use an explicit maintenance deployment rather than rebuilding `.next` underneath a running process:

```bash
sudo -iu css_admin pm2 stop css-admin
sudo -iu css_admin bash -lc '
  cd /srv/css/css_admin &&
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
