/**
 * A parser of CSV (RFC 4180) for `airports.csv` of OurAirports. A quoted
 * field can hold a comma, a line break and two quotes for one quote. The first
 * row gives the keys of each object.
 */
export function parseCsv(text: string): Record<string, string>[] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				i += 1;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") {
				i += 1;
			}
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	const [header, ...body] = rows;
	if (header === undefined) {
		return [];
	}
	return body.map((cells) =>
		Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])),
	);
}
