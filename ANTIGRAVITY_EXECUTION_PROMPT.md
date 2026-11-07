# Antigravity execution prompt for PriceTracked

> **Historical design/execution brief — not the current agent workflow.** This
> file records the original Arena prompt used for the visual and bug-fix pass.
> Current repository rules (branch mirroring, commit versioning, gates only on
> request) live in `AGENTS.md` and take precedence. Product behaviour documents
> are `README.md` and `PROJECT-INFO.md`.

You are working on the existing `abustark/pricetracked` repository.

## Mission

Work on the Arena branch first. Diagnose and fix all confirmed bugs, visual issues, authentication issues, Vercel environment issues, responsive issues, and accessibility problems. Do not push anything until the implementation is complete and all validation checks pass.

This is an existing product. Improve it carefully instead of rebuilding it from scratch.

## Repository and branch rules

- Repository: `https://github.com/abustark/pricetracked`
- Required branch: `arena/01a030cf-pricetracked`
- Work only on `arena/01a030cf-pricetracked`.
- Do not switch to `main` for implementation.
- Do not create another branch.
- Do not push to `main`.
- Do not merge or open a pull request automatically.
- Do not push intermediate or partially tested code.
- Push only the final tested result to:

```bash
git push origin arena/01a030cf-pricetracked
```

Before changing anything, run:

```bash
git status --short --branch
git branch --show-current
git log --oneline --decorate -5
git remote -v
```

Preserve any legitimate existing work. Do not delete, rename, or reset the repository destructively without understanding the current changes.

## Skills and guidelines to use

Use the relevant installed skills as review and implementation lenses:

- `design-taste-frontend`
- `design-taste-frontend-v1`
- `gpt-taste`
- `redesign-existing-projects`
- `high-end-visual-design`
- `minimalist-ui`
- `stitch-design-taste`
- `brandkit`
- `image-to-code`
- `imagegen-frontend-mobile`
- `web-design-guidelines`
- `emil-design-eng`
- `apple-design`
- `improve-animations`
- `review-animations`
- `find-animation-opportunities`
- `animation-vocabulary`
- `ask-sonner`
- `prototype`
- `full-output-enforcement`

Do not combine conflicting aesthetics blindly. Use one coherent direction:

> Calm, premium, minimalist consumer utility UI with Apple-style restraint, PriceTracked teal branding, and ecommerce product clarity.

Use `prototype` only for isolated high-impact component variants, such as the account menu. Do not create multiple competing full homepage designs inside production code.

## Existing product functionality to preserve

Do not break:

- Google authentication
- Anonymous browser watchlists
- Guest-to-account watchlist claiming
- Product URL tracking
- Amazon, Flipkart, Myntra, AJIO and generic public ecommerce parsing
- MongoDB persistence
- Scheduled cron scans
- Product detail pages
- Price history and chart rendering
- Rescan
- Reset history and destructive confirmation
- Theme switching
- Loading and error states

Do not remove working backend behavior merely to simplify the UI.

# Phase 0: baseline and diagnosis

Do this first. Do not start Phase 1 until this audit is complete.

### Inspect the source

Read at minimum:

- `app/page.tsx`
- `app/products/[id]/page.tsx`
- `components/AuthButton.tsx`
- `components/ThemeToggle.tsx`
- `components/TrackForm.tsx`
- `components/ProductList.tsx`
- `components/ProductImage.tsx`
- `components/PriceChart.tsx`
- `app/globals.css`
- `auth.ts`
- `lib/viewer.ts`
- `lib/scanner.ts`
- all product API routes

### Inspect both deployments

Check:

- Current Arena preview deployment
- Current production deployment

Confirm whether they are running the same source version. Do not assume they are identical.

If a deployment is protected by Vercel Authentication, do not request passwords, tokens, cookies or secrets in chat. Report that it is protected and continue the source audit.

### Baseline checks

Run:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

If the project has a development server, run it on `0.0.0.0` and verify:

- `/`
- `/api/products`
- invalid product ID returns 404

### Record the baseline

Create a concise findings table:

| Area | Current behavior | Confirmed issue | Severity | Planned fix |
| --- | --- | --- | --- | --- |

Include:

- Authentication
- Vercel environment configuration
- Homepage hierarchy
- Paste form
- Header/account control
- Mobile layout
- Desktop layout
- Product cards
- Product detail
- Chart
- Loading/errors
- Dark mode
- Accessibility
- Performance
- Guest data ownership

Stop after Phase 0 and report the result before continuing if there is a product decision that cannot be inferred from the repository.

# Critical Vercel and authentication issue

The Preview deployment previously showed only a yellow circle / setup indicator because the Preview environment did not contain the Google OAuth variables.

Production currently has encrypted variables such as:

```text
NEXTAUTH_URL
GOOGLE_CLIENT_SECRET
GOOGLE_CLIENT_ID
AUTH_SECRET
AUTH_URL
CRON_SECRET
MONGODB_DB
MONGODB_URI
```

Preview and Development may be empty.

## Important security rule

Do not try to copy encrypted Production values with `vercel env pull` and then pipe them to Preview. Vercel may return empty placeholders for encrypted/sensitive values. Never add those empty placeholders to Preview.

Do not print, commit, store, or request secret values in chat.

If Vercel environment access is available, inspect names only:

```bash
vercel env ls production
vercel env ls preview
vercel env ls development
```

If Production values cannot be exported, instruct the repository owner to add the original values to Preview using the Vercel dashboard or secure CLI prompts.

Required Preview variables:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AUTH_SECRET
MONGODB_URI
MONGODB_DB
CRON_SECRET
```

Do not blindly copy:

```text
AUTH_URL
NEXTAUTH_URL
```

These may point to the Production domain. The application already uses `trustHost: true`; if an explicit Preview URL is required, it must be the Preview deployment URL.

The Google OAuth callback for the Preview deployment must be registered in Google Cloud Console:

```text
https://pricetracked-7p2fx7grr-abustarks-projects.vercel.app/api/auth/callback/google
```

After variables are correctly configured, redeploy Preview and verify that:

- `Sign in` is visible
- Clicking it opens Google OAuth
- Callback returns to PriceTracked
- The authenticated avatar appears
- The account menu opens
- Sign out works

If credentials are missing, the application must show a clear non-interactive `Sign-in setup` state, not an unexplained yellow avatar-like circle.

# Phase 1: authentication and account experience

Implement only after Phase 0.

### Account control

Desktop:

```text
Brand        navigation              avatar / name / theme
```

Mobile:

```text
PriceTracked                                  avatar / theme
```

Requirements:

- No large username pill on mobile
- Avatar remains top-right
- Avatar is a real accessible disclosure control
- Account menu contains name, email and Sign out
- Theme control remains separate
- Icon-only controls have accessible labels
- Menu works with keyboard and Escape where applicable
- Menu does not cover focused content
- Use a native `<details>` pattern or an accessible client component
- Do not create a large modal for account details

### Guest-to-account migration

Verify the current anonymous cookie and claim flow.

Required behavior:

```text
Guest browser watchlist
        ↓ Google sign-in
Authenticated account watchlist
```

Verify:

- Guest products are private to the browser
- Products are claimed after sign-in
- Duplicate normalized URLs merge
- Existing samples are preserved
- The anonymous cookie does not expose another user's products
- The migration confirmation is concise

If migration fails, do not hide the failure as an empty watchlist.

# Phase 2: paste-first homepage

The homepage is a utility, not a long marketing landing page.

Recommended structure:

```text
Header

Track prices before you buy.
Paste a product link to see its price history.

Add a product
Paste a product link
Start with any public product page.

[ https://store.com/product… ] [Paste]
[ Track price ]

Watchlist
Your tracked products.

Footer
```

Requirements:

- The URL input should be visible quickly
- One short hero title
- One short hero description
- One tracker-card description
- No repeated benefit paragraphs
- No fake statistics
- No duplicate CTA section
- No decorative content before the form
- Preserve `type="url"`
- Preserve `inputMode="url"`
- Add/keep `name="url"`
- Add/keep `autoComplete="url"`
- Keep a clickable label
- Placeholder should show an example and end with `…`
- Paste must not be blocked
- Track button stays at least 44px high
- Status feedback should not create a large idle gap
- Keep typed URL after a failed scan
- Focus the input after an error

Recommended copy:

```text
Track prices before you buy.
Paste a product link to see its price history.

Add a product
Paste a product link
Start with any public product page.

Reading product price…
Opening price history…
Connection failed. Try again.
```

# Phase 3: cards and detail page

## Product cards

Use this hierarchy:

```text
[image] Product title                         >
        Store · status
        Current price
        ₹12,994
```

Requirements:

- Entire card is tappable
- Two-line title clamp on mobile
- Long titles do not push prices off-screen
- Large prices do not overflow
- Status labels stay short:
  - `2h ago`
  - `Needs attention`
  - `Paused`
  - `Waiting`
- Images use a fixed container
- `object-fit: contain`
- Explicit image dimensions prevent layout shift
- Missing and broken images use the same fallback
- Arrow is secondary

## Detail page order

```text
Back to watchlist

Product identity
Current price
Price signal

Rescan / Reset history

Price statistics
Price history
Recent scans
```

Requirements:

- Product identity comes before actions
- Current price is the dominant value
- MRP is secondary
- Reset is clearly destructive and confirmed
- Metadata chips remain short
- Mobile statistics use compact 2-column cards
- Recent scan labels stay concise
- Empty history has a composed state
- Loading detail matches the final page structure

# Phase 4: chart and performance

Requirements:

- Downsample large histories to roughly 150-250 visual points
- Preserve first, latest, highest and lowest observations
- Keep Recent scans as the exact-value fallback
- Add an accessible chart summary
- Keep chart around 250-280px on mobile
- Legend can wrap without clipping
- Do not rely only on hover `<title>` tooltips for mobile
- Keep chart rendering server-compatible where possible
- Avoid unnecessary client components
- Keep animations compositor-friendly

Use a concise visible summary where useful:

```text
₹12,994 now · low ₹9,999 · high ₹15,499
```

Do not present generated historical baselines as real observed store history. Label inferred/baseline data clearly.

# Phase 5: motion, feedback and polish

Use Emil's animation decision framework.

Only animate when it communicates:

- User feedback
- State change
- Spatial continuity
- Important first-time guidance

Do not animate repeated navigation or ordinary typing.

Recommended:

- Button press: 100-160ms
- Small popover: 125-200ms
- Drawer/modal: under 300ms when possible
- Animate only `transform` and `opacity`
- Use explicit transition properties
- Preserve `prefers-reduced-motion`
- Avoid bouncing cards and floating decoration

Use concise Sonner-style toasts for occasional events if the project already supports it:

```text
Product added
Watchlist saved to your account
History reset
```

Keep errors inline near the relevant control.

# Phase 6: accessibility and responsive audit

Validate these widths:

```text
320px
360px
375px
390px
414px
768px
1024px
1280px
1440px+
```

Validate both:

- Light mode
- Dark mode

Validate these states:

- Signed out
- Signed in
- Google sign-in unavailable
- Empty watchlist
- Populated watchlist
- Long product title
- Missing image
- Broken image
- Large price
- Paused product
- Scan loading
- Scan success
- Scan error
- Empty price history
- Populated price history
- Reset confirmation
- Guest-to-account migration
- Database unavailable

Confirm:

- No horizontal scrolling
- No clipping
- No overlapping controls
- No excessive first-screen text
- Paste box appears quickly
- Avatar/theme controls remain top-right
- Minimum touch targets are approximately 44px
- Focus rings are visible
- Skip link works
- Form controls have labels
- Async status is announced
- Errors provide a next step
- Images have dimensions
- Product titles wrap safely
- Prices never overflow
- Chart labels remain readable
- Dark mode has sufficient contrast
- Vercel Toolbar is not mistaken for application UI

# Phase 7: final validation and push

Run sequentially, not in parallel with the development server:

```bash
npm run lint
npm run typecheck
npm run build
```

Run a final smoke test:

```bash
npm run dev -- --hostname 0.0.0.0
```

Verify:

- Homepage returns 200
- `/api/products` returns the correct unauthenticated response
- Invalid product route returns 404
- Authenticated product ownership is enforced
- Guest product ownership is enforced
- Production and Preview environment scopes are correct

Before pushing, inspect:

```bash
git status --short --branch
git diff --check
git diff --stat
git diff
```

Do not include:

- `.env.local`
- Secret values
- Temporary screenshots
- Browser caches
- Large generated artifacts
- Unrelated files

Only after the full implementation and audit are complete:

```bash
git add <intended-files>
git commit -m "Complete PriceTracked UX and reliability improvements"
git push origin arena/01a030cf-pricetracked
```

After pushing, report:

- Commit hash
- Files changed
- Tests passed
- Vercel Preview URL
- Any remaining environment-only blocker
- Whether the user must redeploy or configure Vercel variables

Do not push to `main` and do not claim authentication is working until the Preview environment has valid Google OAuth, Auth.js, and MongoDB configuration.
