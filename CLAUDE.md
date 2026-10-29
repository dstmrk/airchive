# CLAUDE.md

Rules for work in this repository. This file is in ASD-STE100 Simplified Technical
English.

## The project

airchive turns a boarding pass into a paper boarding pass, with the real data of the
flight. A map shows the route, and the function "relive your flight" moves an aircraft
along it. The application is public: each person holds a private archive.

Read [`docs/architecture.md`](docs/architecture.md) before you write code. That document
contains the stack, the decisions and the list of the slices.

## Language rules

| Item | Language |
|---|---|
| Documents (`*.md`) | English. Use ASD-STE100 Simplified Technical English. |
| User interface text | English now. Italian is the next locale. |
| Code, identifiers, comments | English. |
| Commit messages, PR text | English. |

ASD-STE100 gives these rules for the documents:

- Write one instruction in one sentence.
- Keep procedural sentences to a maximum of 20 words. Keep descriptive sentences to a
  maximum of 25 words.
- Keep a maximum of 6 sentences in a descriptive paragraph.
- Use the active voice.
- Use the simple present tense when it is possible.
- Do not use the `-ing` form as a noun.
- Use the same word for the same thing. Do not use two words for one thing.
- Use `must` for a requirement. Use `can` for a possibility. Do not use `should`.
- Do not use idioms and do not use technical slang.

Put each text of the interface in the catalogues of `src/client/i18n/`. A component
reads the text with `useText()`. Do not write text for the user in a component or in the
server code. Paragraph 5.2 of `docs/architecture.md` gives the rules.

## Stack

- TypeScript, Cloudflare Workers
- Server: Hono. One Worker supplies the API and the client files from one origin.
- Client: Vite, React 19, TanStack Router
- User interface: Tailwind CSS v4, shadcn/ui
- Database: Cloudflare D1 (SQLite)
- Tests: Vitest. Lint and format: Biome.

The project has one `package.json`. Do not add a monorepo tool.

Write the extension in a relative import: `import { x } from "./x.ts"`.

`worker-configuration.d.ts` comes from `wrangler types`. After a change to
`wrangler.jsonc`, run `npm run cf-typegen`. The CI fails when that file is old.

## Rules for the work

These rules apply to each task. The section Hooks gives the rules that a hook makes
mechanical.

1. **Ask when a requirement is not clear.** Do not write code with an assumption. Give
   two or three options with your recommendation and the cost of each one. Ask one
   question at a time. Do not ask a question that the repository can answer.
2. **Write the test first.** Write the test before the implementation. Each file with
   logic has a test file.
3. **Examine the edge cases after each implementation.** Make a list of the edge cases.
   Add a test for each one. Do these operations before the commit.
4. **Make one slice verifiable alone.** A slice is ready when one result shows that it
   is correct: a test, a screen or a request. If a slice starts to change items that are
   not related, stop. Then divide the slice.
5. **Find the cause of a correction.** If the user corrects you, find the reason for the
   error. Then prevent the same error.
6. **Write the lesson, then make it mechanical.** If you solve a difficult problem, write
   the lesson in this file or in the correct skill. Do this operation without a request
   from the user. Then change the rule into a hook or a test when it is possible.
7. **Remove an internal path that is obsolete.** Remove the call sites, the tests and the
   dead columns. Do not write a compatibility layer. Do not write an `if (legacy)`
   branch. A migration in `drizzle/` that ran one time is immutable: add a new migration.
   A fallback for an error at runtime is not a compatibility layer.
8. **Use the packages that the project has.** Read the documents and the types of an
   installed package first. Do not assume that a package cannot do the operation.
9. **Keep the work minimal.** Write the smallest change that gives the requested result.
   Do not add a function, an option or a package for a future requirement. Add it with
   the requirement.
10. **Give the decisions in the pull request.** The body of the pull request gives the
    decisions that the request did not specify, from the least sure to the most sure.
    It also gives the lines added and deleted for code, tests and documents, and each
    new binding, route, table or dependency.

## Rules for the data

A boarding pass holds personal data. These rules prevent the most dangerous defects:

1. **The file of a boarding pass stays in the browser.** The client reads a `.pkpass`
   file, an image or a PDF file. The server receives only the fields that the person
   examined. Do not send the file to the server.
2. **R2 holds no personal data.** It holds only the logo, the icon and the colours of an
   airline.
3. **Each table of the data has `owner_id`.** Each query gives that condition.
4. **The public view hides the name and the booking reference** by default.

Paragraph 3.2 of `docs/architecture.md` gives the reasons.

## Rules for the user interface

- The interface is mobile first. Design for a width of 360 pixels first.
- Keep all the tokens in `src/client/styles/app.css`. Use the `@theme` directive of
  Tailwind CSS v4.
- Keep the shadcn/ui components in `src/client/components/ui/`. Do not change these
  files.
- Keep the font files in the repository. Do not use an external CDN for a font.
- If the user selects `prefers-reduced-motion`, do not start an animation automatically.

The project has no `jsdom` and no library for the tests of a component. Therefore keep
the logic of the client in a `.ts` file, with a test file. Then a `.tsx` file holds only
the elements and the state.

## Commands

Run these commands before each commit:

```bash
npm test          # Vitest, one time
npm run typecheck # tsc -b, for the client, the Worker and the configuration
npm run check     # Biome, examination only
npm run fix       # Biome, it writes the corrections
```

Biome writes tab indentation. Run `npm run fix` after you add a file. Biome does not
examine `.claude/`, `drizzle/` or `worker-configuration.d.ts`.

Run these commands for development:

```bash
npm run dev        # Vite and the Worker in workerd, on the port 5173
npm run build      # the client in dist/client, the Worker in dist/airchive
npm run cf-typegen # writes worker-configuration.d.ts from wrangler.jsonc
```

`npm run dev` makes a local D1 database in `.wrangler/`. That directory stays out of git.

The workflow `.github/workflows/ci.yml` runs the tests, the check of the generated
types, the typecheck, Biome, the build and the test suites of the hooks. It runs for
each pull request and for each push to `main`. It deploys nothing.

## Git

- Do work on a feature branch. Do not commit to `main`.
- Write a commit message in the imperative form. Give the reason for the change.
- Do not commit a private file: a database file, `data/`, `.wrangler/`, a `.pkpass`
  file, `.env` or `.dev.vars`.

## Hooks

The directory `.claude/hooks/` holds the hooks. The file `.claude/settings.json` starts
them. A hook makes a rule of this file mechanical. Thus the rule stays active when the
context of a session becomes long.

| Hook | Effect |
|---|---|
| `block-commit-on-main.sh` | It blocks a commit on `main`. Refer to the section Git. |
| `block-push-to-main.sh` | It blocks a push to `main`. Refer to the section Git. |
| `block-private-data-commit.sh` | It blocks `git add` of a private file and `git add --force`. Refer to the section Git. |

A hook is code. Each hook has a test suite in the same directory. A hook that stops the
block must make a test fail. Run each suite after a change to a hook:

```bash
bash .claude/hooks/test-block-commit-on-main.sh
bash .claude/hooks/test-block-push-to-main.sh
bash .claude/hooks/test-block-private-data-commit.sh
```

## Questions

Ask the user before you do these operations:

- add a new dependency
- add a binding to `wrangler.jsonc`
- change a decision in `docs/architecture.md`
