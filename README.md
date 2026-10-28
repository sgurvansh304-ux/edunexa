# EduNexa — starter website

A responsive single-page educational website starter with persistent navigation, class/exam sections, resource browsing, Supabase authentication, Cloudflare Turnstile CAPTCHA, and admin resource management.

## Important before launch

- This is a starter project, not a fully populated question bank.
- Real accounts, email verification, saved progress and admin tools require the Supabase setup below.
- The question library starts empty. Add content you own or are licensed to publish; verify answers and exam year/board labels.
- The current mock-test section is a resource library scaffold. A full exam engine (question-by-question timer, autosave, scoring, review flags) is a next development stage.
- Do not promise absolute security. Use provider security controls, test RLS policies, enable MFA for administrators, and keep dependencies updated.
- The email shown in the footer (`hello@edunexa.example`) is a placeholder. Replace it before launch.

## 1. Create a Supabase project (free tier availability/limits may change)

1. Go to https://supabase.com/ and create a project.
2. In **Project Settings → API** (or the project's Connect panel), copy the project URL and the public publishable/anon key.
3. Open **SQL Editor**, paste all of `schema.sql`, and run it.
4. In **Authentication → Providers / Sign In** enable Email and set your desired email verification policy.
5. In **Authentication → URL Configuration**, add your final deployed site URL to Site URL and allowed Redirect URLs. During development, add `http://localhost:8788` if needed.
6. In **Authentication → CAPTCHA** (wording can vary), enable Cloudflare Turnstile and configure the Turnstile secret key. This is important: Supabase must verify the CAPTCHA token server-side.
7. In the same dashboard, configure SMTP for reliable production email delivery. Default/test email delivery may be restricted.
8. After your first account signs up and verifies its email, use the admin SQL snippet at the bottom of `schema.sql` in SQL Editor to promote that account. Replace the placeholder email with the verified admin email. Never give students admin access.

## 2. Configure Cloudflare Turnstile

1. Open https://dash.cloudflare.com/ and find **Turnstile**.
2. Create a widget for your deployment hostname (and localhost while developing).
3. Copy its **site key** to `CONFIG.turnstileSiteKey` in `app.js`.
4. Put its **secret key only in Supabase Auth CAPTCHA settings**. Never put the secret in `app.js`, HTML, or a public repository.
5. Make sure the same Turnstile integration is enabled in Supabase Auth. The frontend sends the CAPTCHA token with signup/sign-in requests.

## 3. Configure the frontend

Edit the `CONFIG` object at the top of `app.js`:

```js
const CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY",
  turnstileSiteKey: "YOUR_TURNSTILE_SITE_KEY"
};
```

The Supabase publishable/anon key is intended for the browser when Row Level Security (RLS) is configured correctly. Never use a `service_role` or secret key in browser code.

## 4. Test locally

You need a local static web server; opening `index.html` directly as a file may prevent some browser features.

With Node.js installed:

```bash
npx serve . -l 8788
```

Or use Python:

```bash
python -m http.server 8788
```

Then open the local address shown in the terminal. Add that origin and redirect URL to the Supabase/Turnstile development settings. On an Android phone, you can edit the files with a code editor and use a GitHub repository to deploy; some setup steps are easier in a desktop browser.

## 5. Deploy free with Cloudflare Pages

1. Create a GitHub repository named `edunexa` and upload all project files, including `index.html`, `styles.css`, `app.js`, `schema.sql`, and this README.
2. Open https://dash.cloudflare.com/ → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** (the menu wording may change).
3. Connect GitHub and select the `edunexa` repository.
4. For a plain static site, choose no build command and set the output directory to `/` if the dashboard supports the repository root. If it requires a build output directory, use a dedicated folder such as `public` and put `index.html`, `styles.css`, and `app.js` inside it.
5. Deploy. Cloudflare assigns a public `*.pages.dev` URL. The proposed `edunexa.pages.dev` is only available if not already claimed; otherwise choose the available project name.
6. Add the final URL to Supabase's Site URL and allowed redirect URLs, and add the hostname to the Turnstile widget.
7. Test on a logged-out browser and on mobile.

## 6. Make your first admin account

1. Sign up with the email you control.
2. Verify the email.
3. In Supabase SQL Editor, run the commented promotion query from `schema.sql`, replacing `YOUR_VERIFIED_ADMIN_EMAIL`.
4. Sign out and sign back in. The Admin Workspace should appear.
5. Create a test resource and publish it. Check the public resource pages while signed out.

## Security checklist

- RLS is enabled for profiles, resources and test attempts in `schema.sql`.
- Students can only see their own profile and their own attempts; published resources are public.
- Only the database role `admin` can write to the resource table.
- Role assignment must be performed by the project owner, not from the client.
- CAPTCHA validation happens through Supabase Auth's server-side integration.
- Add rate limits, abuse monitoring, backups and admin MFA before a large public launch.
- Do not store plaintext passwords or private personal information in your own tables.
- Have a privacy policy, terms, contact address and age-appropriate data practices before launch. If serving children, review applicable laws and parental-consent requirements.

## Current limitations / next build stage

This version provides the responsive UI, resource categories, basic account UI and admin CRUD for resources. It does **not yet** include a full timed mock-test engine, question randomization, autosave, detailed progress dashboards, file/PDF uploads, email support inbox, or a polished per-question editor. Those should be implemented and tested before advertising them as available features.
