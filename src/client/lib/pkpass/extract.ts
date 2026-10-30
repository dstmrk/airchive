import { Unzip, type UnzipFile, UnzipInflate } from "fflate";

/**
 * The reading of a `.pkpass` file in the browser. The file is not trusted:
 * a person can give any file, also one made to attack the reader. Paragraph
 * 3.2 of `docs/architecture.md` gives the rules; these are the limits.
 */

/** A real pass is approximately 50 to 500 KB with its images. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** A real pass.json is a few KB. */
const MAX_PASS_JSON_BYTES = 1024 * 1024;
/** A real pass holds approximately 10 to 30 entries. */
const MAX_ENTRIES = 200;
/**
 * The archive goes to the decoder in small chunks. The synchronous decoder
 * expands each chunk at once, and DEFLATE can expand 1 KB to approximately
 * 1 MB. Small chunks thus keep each step small, and the limit of
 * MAX_PASS_JSON_BYTES stops a zip bomb before it fills the memory.
 */
const CHUNK_BYTES = 1024;

export type PkpassErrorCode =
	| "file_too_large"
	| "not_a_pass"
	| "pass_json_too_large";

export class PkpassError extends Error {
	constructor(readonly code: PkpassErrorCode) {
		super(`The file is not a usable pass: ${code}.`);
		this.name = "PkpassError";
	}
}

/**
 * It gives the parsed object of `pass.json`. It decompresses no other entry,
 * it counts the bytes during the decompression (the size that the archive
 * declares can be false), and it never writes a file or follows a path.
 */
export async function readPassJson(
	bytes: Uint8Array,
): Promise<Record<string, unknown>> {
	if (bytes.length > MAX_FILE_BYTES) {
		throw new PkpassError("file_too_large");
	}

	const chunks: Uint8Array[] = [];
	let total = 0;
	let entries = 0;
	let found = false;
	let finished = false;
	let failure: PkpassError | null = null;

	const unzip = new Unzip();
	unzip.register(UnzipInflate);
	unzip.onfile = (file: UnzipFile) => {
		entries += 1;
		if (entries > MAX_ENTRIES) {
			failure ??= new PkpassError("not_a_pass");
			return;
		}
		// The exact name only: "evil/pass.json" is not the pass.
		if (file.name !== "pass.json") {
			return;
		}
		if (found) {
			failure ??= new PkpassError("not_a_pass");
			return;
		}
		found = true;
		file.ondata = (error, data, final) => {
			if (error) {
				failure ??= new PkpassError("not_a_pass");
				return;
			}
			total += data.length;
			if (total > MAX_PASS_JSON_BYTES) {
				failure ??= new PkpassError("pass_json_too_large");
				file.terminate();
				return;
			}
			chunks.push(data);
			finished ||= final;
		};
		try {
			file.start();
		} catch {
			// An unknown method of compression.
			failure ??= new PkpassError("not_a_pass");
		}
	};

	try {
		for (
			let offset = 0;
			offset < bytes.length && failure === null;
			offset += CHUNK_BYTES
		) {
			const end = Math.min(offset + CHUNK_BYTES, bytes.length);
			unzip.push(bytes.subarray(offset, end), end === bytes.length);
		}
	} catch {
		failure ??= new PkpassError("not_a_pass");
	}
	if (failure !== null) {
		throw failure;
	}
	if (!found || !finished) {
		throw new PkpassError("not_a_pass");
	}

	const json = new Uint8Array(total);
	let position = 0;
	for (const chunk of chunks) {
		json.set(chunk, position);
		position += chunk.length;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(json));
	} catch {
		throw new PkpassError("not_a_pass");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new PkpassError("not_a_pass");
	}
	return parsed as Record<string, unknown>;
}
