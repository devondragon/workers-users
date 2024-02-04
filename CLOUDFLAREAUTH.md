# Setup Cloudflare Authentication

To use Cloudflare Wrangler you will need to setup the Authentication information for your Cloudflare account in your environment.

1. Create API Token

First you'll need to create a [Cloudflare API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) using the steps available at that link.

For this project you will need to grand the token the following permissions:

| **Scope** | **Entity**         | **Permissions** |
| --------- | ------------------ | --------------- |
| Account   | D1                 | Edit            |
| Account   | Cloudflare Pages   | Edit            |
| Account   | Workers Tail       | Read            |
| Account   | Workers KV Storage | Edit            |
| Account   | Workers Scripts    | Edit            |
| Account   | Account Settings   | Read            |
| User      | Memberships        | Read            |
| User      | User Details       | Read            |
| Zone      | Workers Routes     | Edit            |

You can grant access to all accounts and all zones, or specifically select what you need for this project.

2. You'll also need to get your [Cloudflare Account ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/).

3. Setup Authentication in Environment Variables

Now that you have those you'll need to either setup your Cloudflare authentication information globally or locally within the project.  You can read about [using System Environment Variables for your Cloudflare Authentication information](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/).

High level, if you're only working with one Cloudflare account, you can setup the Account ID and API Token as environment variables in your shell environment, using .zshrc or the equivalent for your shell:

```bash
export CLOUDFLARE_ACCOUNT_ID=<YOUR_ACCOUNT_ID_VALUE>
export CLOUDFLARE_API_TOKEN=<YOUR_API_TOKEN_VALUE>
```

You can also set, or override, those values in a .env file in the top level of your project:

```bash
CLOUDFLARE_ACCOUNT_ID=<YOUR_ACCOUNT_ID_VALUE>
CLOUDFLARE_API_TOKEN=<YOUR_API_TOKEN_VALUE>
```

4. Validate access is working

You can test this by running the following command which should return a message stating you are logged in and showing an account name and account ID:

```bash
npx wrangler whoami
```
