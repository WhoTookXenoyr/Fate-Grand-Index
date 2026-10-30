# Putting Fate/Grand Index online (Cloudflare Pages)

This is a one-time setup, about 30–45 minutes, all of it by clicking in websites. When it's done, every merge into `main` updates the site on its own.

What you end up with:

- **The site:** `https://<your-project>.pages.dev`. You can add a domain of your own later.
- **The app:** on that site, Chrome and Edge show an install button, and on an iPhone it's Share → Add to Home Screen.
- **Accounts and friends:** they live in a small database on Cloudflare.

It all fits Cloudflare's free plan. That plan allows 100,000 requests to the server a day and 5 GB of database. A friend group uses a tiny part of it.

You need:

- a Cloudflare account (free);
- for Discord sign-in, a Discord account;
- for Google sign-in, a Google account.

## 0. Before you start

Merge the pull requests in order: #11 (0.24.0), #12 (0.25.0), then #13 (0.26.0). The site is built from what's on `main`, and the `site/` folder it serves only exists from 0.26.0 on.

To try it before merging, skip ahead. Cloudflare also builds every branch as a *preview* (see step 7).

## 1. Create the Pages project

1. Go to <https://dash.cloudflare.com> and sign up or sign in.
2. In the left menu, open **Workers & Pages** and click **Create**. Pick **Pages**, not a Worker: in the newer layout it's the small line at the bottom, "Looking to deploy Pages? **Get started**". Then **Connect to Git** (or "Import an existing Git repository").
   - If the address you get ends in `.workers.dev`, or **Settings → Bindings** says "Bindings cannot be added to a Worker that only has static assets", it made a Worker. A Worker ignores the `functions/` folder, so accounts can't work there. Delete it (its Settings, at the bottom) and start again with Pages.
3. Connect your GitHub account when it asks. Pick **WhoTookXenoyr/Fate-Grand-Index**.
4. **Project name:** this becomes the address, so something like `fate-grand-index` gives `fate-grand-index.pages.dev`.
5. **Production branch:** `main`.
6. **Build settings:**
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **`site`**
   - Root directory: *(leave empty)*
7. Click **Save and Deploy**. The first deploy works, but signing in won't until steps 2–4 are done.

The repository never contains passwords or secrets, so it's fine that it's public. The secrets go into Cloudflare in step 4.

## 2. The database (required)

1. In the left menu, go to **Storage & Databases → D1 SQL Database** (in some layouts it's under **Workers & Pages → D1**). Click **Create**.
2. Name it **`fgi`** and create it.
3. Go back to your Pages project, then **Settings → Bindings**. Click **Add → D1 database**:
   - Variable name: **`DB`**
   - D1 database: **fgi**
   - Do this for **Production**. For Preview, see step 7.

You don't type any SQL. The site makes its own tables the first time someone uses it.

## 3. Pictures (optional: R2)

Pictures people upload, like the wiki images pasted into a stage, have to be stored somewhere.

- **Without this step**, they go into the database. That's free with no card, and each picture can be up to about 1.9 MB. The site already shrinks pictures to 1100 pixels, so that's plenty.
- **With R2** (Cloudflare's file storage, free up to 10 GB), there's more room. But Cloudflare asks for a card or PayPal on file before you can turn R2 on, even if you never pay anything. If you'd like that:
  1. Go to **R2 Object Storage** and create a bucket named **`fgi-pics`**.
  2. In the Pages project, go to **Settings → Bindings → Add → R2 bucket**. Set the variable name to **`PICS`** and the bucket to **fgi-pics**.

You can add R2 later. Pictures already uploaded stay where they are, and new ones go to R2.

## 4. The password secret (required for email + password)

1. In the Pages project, go to **Settings → Variables and Secrets → Add**.
2. Type: **Secret**. Name: **`PEPPER`**. Value: a long random string, 40 characters or more. Your password manager's "generate password" works well.
3. **Keep a copy somewhere safe and never change it.** Every account's password depends on it. A different `PEPPER` means no one can sign in with their password any more (recovery codes too). Discord and Google sign-in would still work.

## 5. Discord sign-in (optional)

1. Go to <https://discord.com/developers/applications> and click **New Application**. Name it "Fate/Grand Index".
2. Open **OAuth2** in its menu:
   - Copy the **Client ID**.
   - Click **Reset Secret** and copy the **Client Secret**. It's shown once.
   - Under **Redirects**, add `https://<your-project>.pages.dev/api/auth/discord/callback` and click **Save Changes**.
3. In the Pages project, go to **Settings → Variables and Secrets**. Add two secrets: **`DISCORD_CLIENT_ID`** and **`DISCORD_CLIENT_SECRET`**.

## 6. Google sign-in (optional)

1. Go to <https://console.cloud.google.com> and create a project named "Fate Grand Index".
2. Open **APIs & Services → OAuth consent screen**. In newer layouts it's called **Google Auth Platform**.
   - Fill in the app name, your support email and your contact email.
   - Audience: **External**.
   - Then **publish** the app ("In production"). It only asks for name, email and profile, so Google doesn't need to review it. While it's left on "Testing", only test users you add by hand can sign in.
3. Go to **Clients** (or **Credentials → Create credentials → OAuth client ID**):
   - Type: **Web application**
   - Authorized redirect URI: `https://<your-project>.pages.dev/api/auth/google/callback`
   - Copy the **Client ID** and the **Client secret**.
4. In the Pages project, go to **Settings → Variables and Secrets**. Add **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`**.

## 7. Deploy again, and try it

Bindings and secrets only reach a new deploy:

1. Go to **Deployments**.
2. On the latest one, open the **⋯** menu and choose **Retry deployment**.

Then:

1. Open `https://<your-project>.pages.dev`, then **Sign in → Create an account**. Save the recovery code it shows you.
2. **Moving your roster from the file:** your current roster lives in the file you've been opening, and the site can't see it. In the file, use **Export → Full backup**. On the site, use **Import** and choose that backup, then sign in (or sign in first, the order doesn't matter).
3. On your phone, open the site, sign in, and install it from the browser's menu (or Share → Add to Home Screen on an iPhone).

**Previews.** Every branch and pull request gets its own address, like `release-0-26-0.<your-project>.pages.dev`.

- Add bindings and secrets for **Preview** too, but give previews a database of their own (create `fgi-preview` and bind it as `DB` for Preview). That way trying something out never touches your friends' accounts.
- Discord and Google only send people back to addresses you've listed in step 5 or 6, so on a preview use email + password, or add the preview's callback addresses as well.

## Your own domain (optional)

The site can have an address of its own, like `fategrandindex.com`. Nothing in the code needs to change: the server works out its address from each request.

1. **Get the domain.** Cloudflare sells them at cost (**Domain Registration → Register**, a card is needed). Bought elsewhere: for the bare domain, switch its nameservers to Cloudflare's; for a subdomain only, a CNAME to `<your-project>.pages.dev` at the seller is enough.
2. In the Pages project: **Custom domains → Set up a domain**. Do this before touching DNS by hand, or the domain answers with error 522.
3. **SSL/TLS → Edge Certificates → Always Use HTTPS**: on. The certificate itself is Cloudflare's and renews on its own.
4. **www**: add a DNS record `CNAME www → <your domain>`, proxied (orange cloud), then **Rules → Redirect Rules** with the template "Redirect from WWW to root", status 301, **Preserve query string** ticked (shared roster links are `/?roster=…`). Don't make www a second address of the site: browsers keep rosters per address, so people would end up with two.
5. **Discord and Google**: add `https://<your domain>/api/auth/discord/callback` and `/api/auth/google/callback` next to the `.pages.dev` ones.
6. Optionally send the `.pages.dev` address to the domain with **Bulk Redirects** (301, subpath matching, preserve path and query). Leave **Include subdomains** off, so the preview addresses keep working.
7. Leave AAAA, CAA and HTTPS records alone: a proxied record answers on IPv6 by itself, Cloudflare makes the HTTPS record, and a CAA record that leaves out Cloudflare's certificate companies stops the certificate from renewing.

Switch before friends start using the site: everything a browser kept on the old address stays on the old address (signing in on the new one brings back whatever synced), and the app has to be installed again from the new one.

## Things to know

- **Sharing the link:** friends just need the address. Accounts are free, and a friend code works like the game's.
- **Backups:** your roster is in every browser you've synced, and **Export → Full backup** still works. Cloudflare keeps D1 backups for a while too (D1 → your database → **Time Travel**).
- **Deleting accounts:** anyone can delete their own account from the account window, and everything of theirs on the server goes with it. You don't need to do anything for that.
- **Who can see what:** a roster is visible to friends unless its owner picks "Only me". A shared link only works while its owner has "anyone with my link" on.
- **If the server is down or you're offline,** the site and app still open, and everything is saved in the browser. It syncs when it's back.

## Trying it on a computer (for development)

```sh
cd tools/dev && npm install && cd ../..
python3 tools/build.py
python3 tools/dev/serve.py --seeded          # http://localhost:8788 with the sample roster
python3 tests/api/test_api.py                 # the server
python3 tests/api/test_hosted_ui.py           # the site in a browser
```
