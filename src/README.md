# IMIQ FAQ

Node.js/Express backend for the IMIQ FAQ page. The database uses [`node:sqlite`](https://nodejs.org/api/sqlite.html), which has been built into Node.js since version 22.5. This means **no native dependencies, no compilation, and no platform-specific binaries** that could cause issues (unlike packages such as `better-sqlite3`).

**Requirement: Node.js >= 22.5.** Check your version with `node -v`. When starting the server, you will see a message like `ExperimentalWarning: SQLite is an experimental feature...` — this is normal, harmless, and **not an error**.

## What's Included

* **Public page** (`public/index.html`): Displays only answered questions. Visitors can submit new questions.
* **API** (`server.js`):

  * `GET /api/faqs` – Returns only answered questions (public)
  * `POST /api/faqs` – Submit a new question (public, stored without an answer)
* **Admin area** (`admin/admin.html`), accessible **only through a secret URL, with no login**:

  * `GET /<SECRET-PATH>/` – Admin interface
  * `GET /<SECRET-PATH>/api/faqs` – All questions (including unanswered ones)
  * `PUT /<SECRET-PATH>/api/faqs/:id` – Edit and/or answer a question
  * `DELETE /<SECRET-PATH>/api/faqs/:id` – Delete a question
* **Database**: SQLite file located at `data/faqs.db` (created automatically on first startup).

## Installation

```bash
npm install
```

## Starting the Server

```bash
node server.js
# or
npm start
```

If you are using a Node.js version between 22.5 and a later 22.x release and encounter an error related to `node:sqlite`, start the server with:

```bash
node --experimental-sqlite server.js
```

By default, the server runs on port **3000**:

* Public page: `http://localhost:3000/`
* Admin area: `http://localhost:3000/verwaltung-7f3k29xa1e8mzq`

## Running Under a Path Prefix (Subpath Deployment)

By default, the application runs from the domain root (`/`). If you want it to run under a subpath—for example, because a reverse proxy serves it at `https://example.com/imiq/`—set the `PATH_PREFIX` environment variable:

```bash
PATH_PREFIX=/imiq node server.js
```

The application will then be available at:

* Public page: `http://localhost:3000/imiq/`
* API: `http://localhost:3000/imiq/api/faqs`
* Admin area: `http://localhost:3000/imiq/verwaltung-7f3k29xa1e8mzq/`

If `PATH_PREFIX` is not set, everything runs from `/` as usual.

**Reverse proxy note (nginx example):** Make sure the proxy does **not** strip the path prefix so that it matches `PATH_PREFIX`:

```nginx
location /imiq/ {
    proxy_pass http://127.0.0.1:3000/imiq/;
    proxy_set_header Host $host;
}
```

## Important: Change the Secret Admin Path

The admin area has **no login**—its only protection is that the URL is secret. Before deploying to production, make sure to change the default value:

```bash
ADMIN_SECRET="my-own-long-random-path-93kd" node server.js
```

Alternatively, set your own value directly in `server.js` by changing the `ADMIN_SECRET` constant. Use a long, random string that cannot be guessed, and do not link to it publicly.

**Security note:** Using a "secret URL instead of a login" is convenient, but it is less secure than proper authentication (for example, if the URL is accidentally shared or appears in server logs, browser history, or analytics tools). For production deployments, it is strongly recommended to also:

* Always use HTTPS (for example, through a reverse proxy such as nginx with Let's Encrypt) so the URL is not transmitted in plain text.
* Change the admin path periodically.
* Optionally enable HTTP Basic Authentication or IP whitelisting at the reverse proxy level.

## Deployment

Any Node.js hosting provider (e.g. your own server, Docker, Render, Railway, etc.) will work. Important steps:

1. Run `npm install --production`
2. Set the `ADMIN_SECRET` environment variable (see above)
3. Ensure the `data/` directory is writable (persistent storage for the SQLite database)
4. Run the application behind a reverse proxy with HTTPS enabled
