# airchive

Every flight has a story.

airchive turns your boarding passes into a paper keepsake of each flight. You add a
`.pkpass` file, a screenshot of the barcode or the data of the flight. airchive shows a
classic paper boarding pass, a map of the route and a replay of the flight.

The project is at the start. The repository holds the scaffold only.
[`docs/architecture.md`](docs/architecture.md) gives the decisions and the plan.

## Development

You need Node 22.12 or later.

```bash
npm install
npm run dev
```

`npm run dev` starts Vite and the Worker on <http://localhost:5173>. The Worker runs in
`workerd`, the runtime of Cloudflare, with a local D1 database.

## License

MIT. Refer to [`LICENSE`](LICENSE).
