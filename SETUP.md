# The Inkwell app: setup guide

Follow these in order. Budget about 45 minutes. Everything here is free.

You will create three accounts (GitHub, Supabase, Vercel), paste one SQL file, copy two values, and add two users. The app is then live at a web address you can open on any phone or computer.

> **What each service does**
> - **GitHub** stores the code. Vercel reads it from here.
> - **Supabase** is the database, the login system, and the photo storage.
> - **Vercel** hosts the app at a public web address.

---

## Part 1: Put the code on GitHub

1. Go to https://github.com and click **Sign up** (or sign in). Pick any username.
2. Open **GitHub Desktop**: download from https://desktop.github.com, install it, and sign in with the account from step 1.
3. In GitHub Desktop: **File → Add local repository**, click **Choose…**, pick the folder `C:\Users\EL3pr\Projects\inkwell`, click **Add repository**.
4. Click **Publish repository** (top bar). Keep the name `inkwell`, tick **Keep this code private**, click **Publish repository**.

The code is now on GitHub. Later, whenever the code changes, GitHub Desktop will show the changes: type a short summary, click **Commit to main**, then **Push origin**. Vercel redeploys automatically.

---

## Part 2: Create the database (Supabase)

1. Go to https://supabase.com and click **Start your project**. Sign up with GitHub (click **Continue with GitHub**) or email.
2. Click **New project**.
   - **Name:** `inkwell`
   - **Database password:** click **Generate a password**, then copy it somewhere safe (you rarely need it, but don't lose it).
   - **Region:** pick the one closest to you (for the US, `East US` or `West US`).
   - Click **Create new project**. Wait about two minutes for the green "Project is ready" status.
3. **Paste the schema.** In the left sidebar click **SQL Editor** (icon looks like a terminal). Click **New query**. On your computer open the file `supabase\schema.sql` in Notepad, select all (Ctrl+A), copy (Ctrl+C). Back in the browser, click inside the big editor box, paste (Ctrl+V), then click the green **Run** button (bottom right). You should see "Success. No rows returned". If you see a red error, copy the whole message and send it to me.
4. **Turn off public sign-ups** so only you two can get in. Sidebar → **Authentication** → **Sign In / Providers** (sometimes labelled **Providers**). Click **Email**. Turn **OFF** the switch "Allow new users to sign up". Leave "Confirm email" on or off; it doesn't matter because you create accounts by hand. Click **Save**.
5. **Create your two accounts.** Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
   - Type your email and choose a password (8+ characters). Tick **Auto Confirm User**. Click **Create user**.
   - Repeat for your wife's email and her password. Tell her the password; she can't change it herself in version 1 (you can reset it here anytime: click the user → **Reset password**).
6. **Copy the two values the app needs.** Sidebar → **Project Settings** (gear icon at the bottom) → **API Keys**. You need:
   - **Project URL**: `https://` + your project ref + `.supabase.co`. It is shown under **Project Settings → Data API**, and it is also the middle part of the dashboard's web address.
   - **Publishable key**: on the **API Keys** page, the row named `default` under **Publishable key** (starts with `sb_publishable_`). Click the copy icon next to it. Never use the **Secret keys** row.

   (Older dashboards call these "Project URL" and "anon public" key under **Project Settings → API**. Either kind of key works.)

   Keep this tab open; you'll paste both into Vercel next.

> **Important free-tier note:** Supabase pauses free projects that get no traffic for 7 days. Opening the app once a week keeps it awake. If it ever pauses, open https://supabase.com/dashboard, click the project, and click **Restore project**. Nothing is lost.

---

## Part 3: Put the app online (Vercel)

1. Go to https://vercel.com and click **Sign Up** → **Continue with GitHub**. Approve the access it asks for.
2. Click **Add New…** → **Project**. Find `inkwell` in the list and click **Import**. If you don't see it, click **Adjust GitHub App Permissions** and grant access to the `inkwell` repository.
3. On the "Configure Project" screen:
   - **Framework Preset** should say **Vite** automatically. Leave Build settings alone.
   - Open **Environment Variables**. Add two, one at a time:

     | Key | Value |
     |---|---|
     | `VITE_SUPABASE_URL` | the Project URL from Supabase |
     | `VITE_SUPABASE_ANON_KEY` | the publishable key from Supabase |

   - Click **Deploy**. Wait about a minute until you see confetti.
4. Click **Continue to Dashboard**, then click the **Visit** button (or the address under **Domains**, something like `inkwell-xxxx.vercel.app`). That is your app. Bookmark it.
5. Optional, nicer address: in the project's **Settings → Domains**, click **Edit** on the `.vercel.app` domain and rename it to something like `the-inkwell.vercel.app` if it's free.

---

## Part 4: Log in on your phone and add it to the home screen

1. Open the Vercel address on your phone's browser (Safari on iPhone, Chrome on Android).
2. Sign in with the email and password you created in Part 2, step 5.
3. Add to home screen:
   - **iPhone:** tap the **Share** button (square with an arrow), scroll, tap **Add to Home Screen**, tap **Add**.
   - **Android:** tap the **⋮** menu, tap **Add to Home screen** or **Install app**, confirm.
4. From now on open it from the home-screen icon. It opens full-screen like a real app and stays signed in.
5. On a laptop just open the same address in any browser and sign in.

**Your wife:** she does the same with her own email and password. You can both be signed in at once; changes show up on the other phone within a second or two.

---

## Part 5: Load your pieces in bulk

1. Open the app → **More → Import / Export** (on a laptop, **Import / Export** in the sidebar).
2. Click **Download sample CSV** and open it in Excel or Google Sheets. (There's also a copy at `sample-import.csv` in the project folder.)
3. Fill one row per design. Columns:

   | Column | What to put | Example |
   |---|---|---|
   | `number` | pegboard slot number, whole number, unique | `42` |
   | `name` | design name | `Midnight Galaxy` |
   | `type` | `pen` or `keychain` | `pen` |
   | `tier` | `standard` or `premium` | `premium` |
   | `price` | leave **blank** to use the tier price; type a number to override | `22` |
   | `quantity` | how many you have | `6` |
   | `shop_safe` | `yes` or `no` (`no` = licensed characters, don't list on TikTok Shop) | `yes` |
   | `notes` | anything | `small bubble near clip` |

4. Save as CSV (in Excel: **File → Save As → CSV UTF-8**).
5. Back in the app click **Choose CSV file…**, pick it, check the preview (new rows in white, updates in pink, problems listed in red), then click **Import**.
6. Re-importing the same file later is safe: rows with an existing number update that design, so you can fix names or quantities in bulk.

**Photos** are added per design: open the design, tap **Take photo** (camera) or **Upload**. Photos are compressed on the phone before upload, so 300 photos use well under the free limit.

---

## Part 6: Pre-launch test checklist

Do this on your phone with your wife on hers, a few days before Thanksgiving weekend.

- [ ] Both of you can sign in from the home-screen icon.
- [ ] Settings → set the real Standard and Premium prices → Save. Inventory prices update.
- [ ] Import your CSV. Count on the Dashboard matches your pegboard.
- [ ] Add a photo to one design with the camera. It appears on the other phone within a few seconds.
- [ ] Search the inventory by number and by name. Filters work (tier, type, Shop-safe, in stock).
- [ ] Live mode: Start Live, tap a number, enter a handle, Claim. The other phone sees the claim and the stock drop.
- [ ] Claim the same number again until it says **Sold out**. It refuses to oversell.
- [ ] Tap **Undo** on a claim. Stock goes back up.
- [ ] Owes me: Mark paid moves it to To ship. Release puts the piece back in stock.
- [ ] To ship: Mark shipped. The Dashboard "To ship" count drops.
- [ ] Sales → Add sale with channel TikTok Shop, status Paid. It appears in To ship.
- [ ] End Live. The Live appears under Past Lives with the right total.
- [ ] Import / Export → Export sales and Export inventory open in Excel.
- [ ] Turn on airplane mode, open the app: it still opens (cached) and shows a red connection bar. Turn airplane mode off: it recovers.
- [ ] Try the app address in a private/incognito window without signing in: you only see the login screen.

---

## Everyday reference

| I want to… | Where |
|---|---|
| Change prices | Settings |
| Add a design | Inventory → + Add design |
| Retire a sold-out design and reuse its number | Open the design → Archive |
| Record a TikTok Shop order | Sales → + Add sale (status Paid) |
| Record a market sale | Sales → + Add sale, channel Market, status Shipped |
| See who hasn't paid | Owes me |
| See what to pack | To ship |
| Fix a mistake on a sale | Sales → tap the sale → edit or Cancel |
| Reset a password | Supabase → Authentication → Users → click user → Reset password |
| Add a third person later | Supabase → Authentication → Users → Add user |

## When something goes wrong

- **"Connection problem" red bar:** your phone is offline, or the Supabase project is paused (see the free-tier note in Part 2). Open the Supabase dashboard and restore it.
- **Photo upload fails:** check the phone has signal; try Upload instead of Take photo. Max 2 MB after compression, which is never hit in practice.
- **"Only N left in stock":** two people claimed the last piece at the same moment. The second one loses; nothing is double-sold.
- **I changed code and want it online:** GitHub Desktop → Commit → Push. Vercel rebuilds in about a minute.

## Trying the app without any accounts (demo mode)

Create a file named `.env` in the project folder containing `VITE_DEMO=true`, then run `npm run dev` and open the address it prints. Any email and password signs in. The data is fake and resets on reload. Delete that line when you're done.
