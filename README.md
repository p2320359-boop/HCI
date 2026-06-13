# Aemona v3

Aemona v3 is the current integrated prototype for emotional check-ins, guided reflection, entries, tools, and pattern exploration.

## Login status

Currently supported and working:

- Email registration and login
- Beta access code

For testing, **Beta access code is recommended** because it is the quickest way to enter the prototype and keeps the test flow simple.

Phone and Apple login are not currently supported as stable login methods.

## Run locally

Requirements: Node.js 18 or newer.

1. Clone the repository and enter the v3 application:

   ```bash
   git clone https://github.com/xiaotui0116/aemona.git
   cd aemona/v3
   npm ci
   ```

2. Create `.env` from `.env.example`:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env`.

3. Start the server:

   ```bash
   npm start
   ```

4. Open:

   ```text
   http://localhost:3000
   ```

## Required configuration

Firebase values are required for Email and Google login. Enable both providers in Firebase Authentication and add the local or deployed hostname to Firebase Authorized Domains.

Set `BETA_ACCESS_CODE` in `.env` to enable the recommended beta-code testing flow.

Never commit `.env`. It is intentionally ignored by Git.

## Validation

```bash
npm test
```

The v3 package excludes `.env`, dependencies, editor files, unused development
dependencies, and removed tool files.
