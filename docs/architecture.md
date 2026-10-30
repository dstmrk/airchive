# airchive — Architecture Decision Record

Status: **accepted**. Date: 2026-10-29.

This document records the architecture decisions. The owner made these decisions before
the start of the code. The document is in ASD-STE100 Simplified Technical English.

The code implements paragraphs 2, 4, 5.1, 5.2 and 7. Each other paragraph gives a
decision for a later slice. Paragraph 8 gives the list of those slices.

---

## 1. Context

airchive turns a boarding pass into a **paper boarding pass**, with the real data of the
flight. The result is a keepsake of the flight. A map shows the route, and the function
**relive your flight** moves an aircraft along that route.

These constraints control all the decisions in this document:

| Constraint | Decision |
|---|---|
| Cost | Zero. The application runs on the free plans of Cloudflare and Resend. |
| Users | Public. Each person makes an account and holds a private archive. |
| Project | A hobby project of one person. The code stays small. |
| Device | Mobile first. A boarding pass arrives on a telephone. |
| Data | A boarding pass holds personal data. The application keeps the minimum. Refer to paragraph 3.2. |

## 2. Stack

| Layer | Decision | Reason |
|---|---|---|
| Hosting | Cloudflare Workers, free plan | No pause for inactivity, no clause against commercial use, one vendor for the data and the files. |
| HTTP server | Hono | It runs on Workers with no adapter. |
| Client | Vite, React 19, TanStack Router | A single-page application. The Worker supplies its files. |
| User interface | Tailwind CSS v4, shadcn/ui | The repository contains the components. |
| Database | Cloudflare D1 (SQLite) | Refer to paragraph 2.3. |
| Files | Cloudflare R2 | The logo and the icon of an airline only. Refer to paragraph 3.2. |
| Schema and migrations | Drizzle and drizzle-kit | The same tools as Yume. |
| Authentication | Better Auth, magic link, Resend | Refer to paragraph 4. |
| Map | react-map-gl on MapLibre GL, OpenFreeMap tiles | Refer to paragraph 5.5. |
| Tests | Vitest | |
| Lint and format | Biome | One tool in the place of ESLint and Prettier. |

Each package arrives with the slice that uses it. The authentication added Better Auth
and Drizzle. The flight table added Zod and TanStack Query. The map added `maplibre-gl`
and `react-map-gl`.

The structure of the repository comes from Yume (`dstmrk/yume`). The map component comes
from prezzi-carburante (`dstmrk/prezzi-carburante`). The rules of the process come from
ScontrinoZero (`dstmrk/scontrinozero`).

### 2.1 Why not Next.js

Next.js on Workers needs the adapter OpenNext. The adapter adds a layer between the code
and the runtime, and some functions of Next.js arrive late in it. Hono runs on Workers
directly.

The only function of Next.js that airchive needs is the preview of a shared link. A
crawler reads no JavaScript, thus the page of a shared flight needs its tags on the
server. Paragraph 5.3 gives the solution with Hono. That solution is one small handler.

### 2.2 Why one Worker

One Worker supplies the API and the files of the client from one origin. The plugin of
Cloudflare for Vite runs the Worker in `workerd` during `vite dev`. Thus development and
production use the same runtime and the same origin.

`wrangler.jsonc` gives these rules:

- `assets.not_found_handling` is `single-page-application`. A path that is not a file
  gives `index.html`, and TanStack Router shows the page.
- `assets.run_worker_first` holds `/api/*`. A request to the API goes to the Worker
  first. Without this item, an unknown path of the API gives `index.html`.
- The Worker gives JSON for each path of the API, also for an unknown path.

### 2.3 Why D1

SQLite was the first choice of the owner. The functions of Workers have no persistent
file system, thus a local SQLite file is not possible. D1 is SQLite as a service of
Cloudflare. Drizzle supports D1, and the free plan is sufficient for this application.

The team examined these alternatives:

| Alternative | Reason for the refusal |
|---|---|
| Vercel with Turso and Vercel Blob | Three vendors. The plan Hobby forbids commercial use. |
| Vercel with Supabase | Postgres, not SQLite. A free project stops after a week with no activity. |
| A home server | The owner maintains the hardware. A public application needs a server that is always available. |

The route `GET /api/health` sends `SELECT 1` to D1. Thus the scaffold examines the
binding `DB` before the first table exists.

## 3. Data

### 3.1 The sources of a flight

A person adds a flight in one of three ways, in this order:

1. **A `.pkpass` file.** The file is a zip archive with `pass.json`. Since iOS 12, many
   airlines add the semantic tags (`departureAirportCode`, `originalDepartureDate` and
   others). Those tags give the most data: times, terminal, gate, colours.
2. **A barcode in an image or in a PDF file.** Each boarding pass holds a barcode in the
   format IATA BCBP (Resolution 792). The barcode gives the name, the booking reference,
   the airports, the flight, the date and the seat. It gives no time and no year.
3. **Manual input.** For a flight with no boarding pass.

Android has no file format for a pass. Google Wallet makes a pass on the server with its
API, and a person cannot export that pass. Thus the barcode is the source for a person
with Android.

The three ways fill **one form**. The person examines the data, completes the missing
items and saves. Thus the validation is in one place. The manual input is the first
slice, because it needs no parser.

### 3.1.1 The fields of a flight

`src/shared/flight.ts` holds one Zod schema. The form and the API both apply it.

| Field | Required | Rule |
|---|---|---|
| `airlineCode`, `flightNumber` | yes | The form has one field, for example `AZ 784`. The code is IATA (2 characters, one letter or more) or ICAO (3 letters). The number has no leading zeros. |
| `airlineName` | no | Text. A code goes to a new airline over time (`AZ` was Alitalia, it is ITA since 2021), thus the name stays on the flight. |
| `origin`, `destination` | yes | IATA codes of the dataset of paragraph 3.4. They are different. |
| `departureDate` | yes | The local day of the boarding pass, from 1950. |
| `departureTime`, `arrivalDate`, `arrivalTime` | no | Local "wall clock" times of each airport. The arrival is not before the departure date. |
| `seat`, `cabinClass`, `passengerName`, `bookingReference` | no | `cabinClass` is `economy`, `premium_economy`, `business` or `first`. |

The times are local times, as the boarding pass gives them, not UTC. The time zone of
each airport converts them when the replay of paragraph 5.6 needs UTC. A barcode gives a
date and no time, thus the date of a flight stays correct with no time.

The schema keeps no field for the real times or a real track yet. The slice that uses
them adds them.

### 3.2 The private data

A boarding pass holds the name, the booking reference and sometimes the number of a
frequent flyer programme. The barcode can also open the booking on the site of the
airline. Therefore these rules apply:

- The client reads the file in the browser. The file does not go to the server.
- The server receives only the fields that the person examined in the form.
- R2 holds only the graphic items of a `.pkpass` file: `logo.png`, `icon.png` and the
  colours of `pass.json`. Those items hold no personal data.
- The public view of a flight does not show the name or the booking reference by default.
- The deletion of an account deletes the rows in D1 and the objects in R2.

### 3.3 One owner for each row

Each table of the data has the column `owner_id`. Each query of the server gives that
condition. A person reads and writes only the rows of their own account.

### 3.4 The airports

`src/server/airports/airports.json` holds approximately 9,400 airports: the IATA code,
the name, the city, the country, the coordinates and the IANA time zone. `npm run
airports:build` writes it from two sources:

| Source | Licence | Role |
|---|---|---|
| mwgg/Airports | MIT | The base. It gives the time zone, and it keeps the closed airports, for example Berlin Tegel (TXL). |
| OurAirports | Public domain | It adds each code that mwgg does not have. It removes the closed airports, thus it cannot be the base. |

The time zone of an airport of OurAirports comes from its coordinates, with
`@photostructure/tz-lookup` in the script only. The application does not load that
package.

**The file never removes a code.** A saved flight holds only the codes of its airports.
The script reads the previous file and keeps each of its codes. A flight with a code
that is not in the file cannot be saved.

The Worker reads the file one time, when the isolate starts. `GET /api/airports?q=`
gives the 10 best airports for a text: the exact code, then a city that starts with the
text, then a word of the name or of the city. The route needs no session, because the
data is public. The client does not load the file: on a telephone, 200 KB of data for
three letters is too much. The startup of the Worker was approximately 60 ms of CPU on a
local machine, with the file. The limit of Cloudflare is 1 second.

## 4. Authentication

A person signs in with a **magic link**. Better Auth makes the link, and Resend sends the
email. The domain of the email must be verified in Resend. A new email address makes a
new account: the application has no separate registration.

The team examined these alternatives:

| Alternative | Reason for the refusal |
|---|---|
| Email and password | The verification and the reset of a password need an email also. The hash of a password uses much CPU, and the free plan of Workers gives approximately 10 ms of CPU for each request. |
| Google and Apple | Sign in with Apple needs the Apple Developer Program, which costs money. |
| Cloudflare Access | Access is for a private application with known users. It is not a registration for the public. |

A person with no Google account can use the application. The application keeps no
password.

`src/server/auth.ts` makes Better Auth for each request, because a Worker receives its
bindings with each request. These rules apply:

- A link is valid for 15 minutes and opens one session one time.
  `MAGIC_LINK_TTL_MINUTES` in `src/shared/auth.ts` gives the value. A test compares
  each text that names it.
- D1 keeps the hash of the token, not the token. A copy of the database gives no link
  that opens an account.
- The callback of a link must be on the origin of the application. Better Auth refuses
  another origin before it sends the email. This refusal prevents an open redirect.
- One address can ask for 3 links in a minute. The counters are in D1, because the
  memory of a Worker is not shared between its isolates. The address comes from the
  header `cf-connecting-ip`. A person can still receive links from many addresses:
  that risk is accepted for now.
- `GET /api/me` gives the person of the session, or 401. The middleware
  `requireSession` of `src/server/app.ts` protects each route of the data.

Better Auth skips the check of the origin when `NODE_ENV` is `test`. `auth.ts` sets
`disableOriginCheck: false`, thus the tests examine the check of production.

### 4.1 The variables and the secrets

| Name | Kind | Production | Development |
|---|---|---|---|
| `BETTER_AUTH_URL` | variable | `wrangler.jsonc` | `.dev.vars`: `http://localhost:5173` |
| `EMAIL_FROM` | variable | `wrangler.jsonc` | `wrangler.jsonc` |
| `BETTER_AUTH_SECRET` | secret | the settings of the Worker in the dashboard | `.dev.vars` |
| `RESEND_API_KEY` | secret | the settings of the Worker in the dashboard | empty: the Worker writes the link to the log |

With no `BETTER_AUTH_SECRET`, each route of `/api/auth` gives 503. With no
`RESEND_API_KEY`, development writes the link to the log, and production refuses the
request. Production never writes a link to the log, because a link opens an account.

`.dev.vars.example` holds the name of each secret with no value. `npm run cf-typegen`
reads that file, thus `Env` holds each secret also in the CI.

The domain is a subdomain of a domain of the owner for now. A change of domain changes
`BETTER_AUTH_URL`, `EMAIL_FROM` and the verification in Resend, and each session ends.
The owner buys the final domain before the public links of paragraph 5.3.

### 4.2 The tables and the migrations

`src/server/db/schema.ts` holds the tables of Better Auth with Drizzle. `npm run
db:generate` writes a SQL migration to `drizzle/`. The deploy command applies the
migrations to the remote database before `wrangler deploy`.

A plugin of Better Auth can need a new table or a new field. `getAuthTables` of
`better-auth/db` gives the list for the options of `auth.ts`. Compare that list with
`schema.ts` after each change of the options.

## 5. User interface

### 5.1 The tokens

`src/client/styles/app.css` holds all the tokens, in the `@theme` directive of Tailwind
CSS v4. The scaffold gives three colours of paper and ink. The design of the paper
boarding pass adds its tokens to that file.

### 5.2 The languages

The interface is in English. Italian is the next language.

- `src/client/i18n/locale.ts` gives the supported locales and `pickLocale`.
  `pickLocale` reads `navigator.languages` and compares the primary subtag only.
- `src/client/i18n/en.ts` holds the English text. Its keys give the type `Messages`.
- `src/client/i18n/messages.ts` holds one catalogue for each locale, with the type
  `Record<Locale, Messages>`. Thus a missing catalogue or a missing key is a compile
  error.
- A component reads the text with `useText()`. A component holds no text for the user.

To add a language, add its tag to `LOCALES` and its catalogue to `messages`. The project
uses no i18n library: two typed objects are sufficient.

The text of an email is on the server, in `src/server/email-text.ts`, because the Worker
sends the email.

`index.html` holds the title and the description in English. A crawler reads no
JavaScript, thus those two items cannot come from the catalogue.

### 5.3 The page of a shared flight

A person can share one flight with a public link. The preview of that link needs the
tags of Open Graph in the HTML, because a crawler reads no JavaScript. Therefore:

- A route of Hono supplies the page of a shared flight. It adds the tags to `index.html`
  with `HTMLRewriter`.
- A second route makes the image of the preview with Satori. The image is the paper
  boarding pass.

The compatibility of Satori with the Worker must be examined in that slice.

### 5.4 The paper boarding pass

The application has **one design**: a classic paper boarding pass with a stub. The logo
and the colour of the airline are accents on that design. The design does not copy the
boarding pass of a real airline, because that copy is a legal risk.

The design is a theme: the colours, the fonts and the texture are tokens. A second design
is then a second set of tokens, not a second component.

The typography has two fonts, both under the SIL Open Font License:

- **Barlow** for the labels and the text: regular, medium and semibold. The owner chose
  it on a mockup over Inter and DM Sans. Its narrow shapes recall the signs of an
  airport, and it sits well next to a monospace font.
- **JetBrains Mono** for the codes: the airports, the flight, the seat, the times, the
  dates and the booking reference. Yume uses the same font and the same files.

`src/client/fonts/` holds the files and their licences. Each file holds all the Latin
characters, thus no word mixes two fonts. `pyftsubset` of `fonttools` makes each Barlow
file from the release of Google Fonts, with the same Unicode ranges as Yume and the
features `kern`, `liga` and `tnum`.

The component is `src/client/components/PaperPass.tsx`, and `src/client/lib/pass.ts`
gives each text. Its layout follows the width of its container, with a container query:

- Under 640 px the pass is vertical: the stub is below the body, with a horizontal
  perforation. A printed pass at the width of a telephone has text of 6 or 7 px.
- From 640 px the stub is on the right, as on a printed pass. The image of a shared
  flight (paragraph 5.3) uses this layout.

The date is the local day of the boarding pass, for example `12 MAY 2024`, with the
month of the locale. An arrival on a later day shows `+1` after the time. A value that
the flight does not have shows `—`.

`/flights/:id` shows the pass. The form is at `/flights/:id/edit`.

### 5.5 The map

The page of a flight shows the route under the pass. The map uses `react-map-gl` on
MapLibre GL, the standard React binding of MapLibre.

The team examined the component mapcn of prezzi-carburante. It has 2,700 lines with
markers, popups, clusters and themes. airchive needs a line and two points, thus
`src/client/components/FlightMap.tsx` uses `react-map-gl` directly in about 150 lines.

These rules apply:

- The tiles come from OpenFreeMap: no key, commercial use permitted. The terms of CARTO,
  the default of mapcn, are not clear for a public application. The style is one URL,
  thus a change of the provider is a change of one line.
- The bundle supplies the worker of MapLibre, not a CDN, as in prezzi-carburante.
- `src/client/lib/paper-map-style.ts` changes the colours of the style `positron` before
  the map loads it: paper land, grey-green water, sepia boundaries and labels. The rules
  use the type and the name of each layer, thus a new layer of OpenFreeMap gets the
  colour of its kind. `app.css` holds the colours as tokens `--color-map-*`.
- The route is the great circle of `src/client/lib/great-circle.ts`, a dashed line in
  the accent of the pass. The longitudes are continuous across the antimeridian, thus
  Tokyo to Los Angeles is one line over the Pacific.
- The codes of the airports on the map use JetBrains Mono, as on the pass.
- The credit to OpenFreeMap, OpenMapTiles and OpenStreetMap is a line under the map. The
  control of MapLibre opened at load and covered a third of the map on a telephone.
- The page loads the map lazily. MapLibre is approximately 300 KB with gzip, and the
  archive does not load it.
- `cooperativeGestures` is on: one finger scrolls the page, two fingers move the map.

### 5.6 Relive your flight

The route is the **great circle** between the two airports. It is not the real track of
the aircraft. The duration comes from the times of the `.pkpass` file, or from an
estimate from the distance. The person can correct the duration.

A pure function `position(t)` gives the latitude, the longitude and the bearing for
`t` from 0 to 1. Each mode of the playback is a different speed of `t`:

- real time (1×),
- a set of faster speeds,
- a fixed duration, for example 30 seconds,
- a timeline that the person can drag.

The owner selects the speeds on a mockup. If the user selects `prefers-reduced-motion`,
the playback does not start automatically.

The schema keeps optional fields for the real times and for a real track. An API of
flights (for example AeroDataBox) or a real ADS-B track (for example OpenSky) can fill
them in a later slice. A real track is free only for a flight of the last 30 days, thus
the great circle stays the base for an old flight.

## 6. Repository layout

```text
src/
  client/          the single-page application
    i18n/          the locales and the catalogues of text
    styles/        app.css, the tokens of the theme
    main.tsx       the entry point of the client
    router.tsx     the routes of the client
    lib/           the logic of the client, each file with a test file
    components/    the components that more than one page uses, and PaperPass
    fonts/         the font files and their licences
  server/          the Worker
    airports/      the dataset of the airports and its search
    db/schema.ts   the tables, with Drizzle
    test/d1.ts     a real D1 database for the tests
    app.ts         the routes of Hono
    auth.ts        Better Auth for one request
    flights.ts     the routes of /api/flights
    session.ts     the guard requireSession
    email.ts       the email of the magic link, with the API of Resend
    index.ts       the entry point of the Worker
  shared/          the code of the client and of the Worker
drizzle/           the SQL migrations, from drizzle-kit
scripts/airports/  the script that writes airports.json
index.html         the page of the client
wrangler.jsonc     the configuration of the Worker and of its bindings
worker-configuration.d.ts   the types of `Env`, from `wrangler types`
```

The logic of the client goes in a `.ts` file with a test file. The project has no
library for the tests of a component, thus a `.tsx` file holds only the elements and the
state.

`src/shared/` holds the code that the client and the Worker both use.

The tests of the server use `getPlatformProxy` of wrangler for a real D1 database in
memory, with each migration applied. Thus a test examines the SQL of production.

## 7. Deployment

The owner does each operation in the dashboard of Cloudflare. No person needs
`wrangler` on a local computer.

- **The database.** The owner made the D1 database `airchive` in the dashboard.
  `wrangler.jsonc` holds its identifier in `database_id`. The identifier is not a
  secret.
- **The deployment.** Workers Builds, the integration of Cloudflare with GitHub,
  deploys the Worker `airchive` after each merge on `main`. The build command is
  `npm run build`. The deploy command is `npm run deploy`: it applies the migrations to
  the remote database, then it runs `wrangler deploy`.
- **The examination.** After a deployment, `GET /api/health` must give `ok`. The route
  examines that D1 answers and that each table of `schema.ts` exists. A deployment that
  skipped the migrations gives 503, and the log names the missing tables.

The first deployment of the authentication used `npx wrangler deploy` as the deploy
command. The Worker then ran on an empty database, `/api/health` gave `ok`, and each
sign-in failed with 500. The check of the tables prevents that silent state.

An error that no route handles goes to `app.onError` of Hono. The log line gives the
message of each cause, the deepest last, because a D1 error holds "no such table" in a
cause. It gives only the first line of each message: Drizzle writes the parameters of a
query on the next lines, and a parameter can hold an email address. `onAPIError` of
Better Auth writes the errors inside its endpoints with the same function.

The name of the Worker in the dashboard must be the same as `name` in
`wrangler.jsonc`.

The preview builds of Workers Builds are off (Settings → Build → Branch control). The
command `wrangler preview` needs a `previews` block with a separate D1 database. The
magic link also needs the exact origin in `BETTER_AUTH_URL`, and the origin of a
preview changes with each branch. The CI of GitHub builds each pull request, thus a
preview gives no necessary examination now.

The secrets go to the settings of the Worker in the dashboard, not to the
repository. Paragraph 4.1 gives the list.

## 8. The slices after the scaffold

Each slice is one pull request, and a person can accept or refuse it from one result.
Each slice has a GitHub issue. The issue gives the scope, the result for the acceptance
and the open checks.

| Order | Slice | Issue |
|---|---|---|
| 1 | Authentication: Better Auth, magic link, Resend | #3 |
| 2 | The deployment | #4 |
| 3 | The table `flight` with Drizzle, and the manual form | #5 |
| 4 | The paper boarding pass, with the mockup of the fonts | #6 |
| 5 | The map and the great circle | #7 |
| 6 | Relive your flight | #8 |
| 7 | The parser of `.pkpass` files | #9 |
| 8 | The parser of BCBP barcodes from an image or a PDF file | #10 |
| 9 | The public page of a shared flight, with the preview | #11 |
| 10 | The Italian catalogue | #12 |

The deployment comes after the authentication and before the data. A real environment
shows early the problems that `wrangler dev` does not show: the CPU limit of the free
plan, the domain of Resend and the limits of D1.
