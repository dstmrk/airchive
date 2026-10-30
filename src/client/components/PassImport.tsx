import { type ChangeEvent, useId, useState } from "react";
import type { Airport } from "../../shared/airport.ts";
import { useText } from "../i18n/I18nProvider.tsx";
import type { Messages } from "../i18n/messages.ts";
import { apiRequest } from "../lib/api.ts";
import {
	type ImportError,
	importFile,
	MAX_IMAGE_BYTES,
} from "../lib/pkpass/import.ts";
import type { ImportedValues } from "../lib/pkpass/to-form.ts";

const ERROR_TEXT: Record<ImportError, keyof Messages> = {
	file_too_large: "importFileTooLarge",
	not_a_pass: "importNotAPass",
	pass_json_too_large: "importNotAPass",
	not_boarding_pass: "importNotBoardingPass",
	no_flight_data: "importNoFlightData",
	pdf_not_supported: "importPdf",
	no_barcode: "importNoBarcode",
};

/** ZXing is large: only the import of an image loads it. */
async function readBarcode(bytes: Uint8Array): Promise<string | null> {
	const { readBarcodeImage } = await import("../lib/barcode/image.ts");
	return readBarcodeImage(bytes);
}

async function findAirport(code: string): Promise<Airport | null> {
	const results = await apiRequest<Airport[]>(
		`/api/airports?q=${encodeURIComponent(code)}`,
	);
	return results.find((airport) => airport.iata === code) ?? null;
}

export type ImportedPass = {
	values: ImportedValues;
	airports: { origin: Airport | null; destination: Airport | null };
};

/**
 * The import of a `.pkpass` file or of an image of a barcode. The browser
 * reads the file; it does not go
 * to the server. Paragraph 3.2 of `docs/architecture.md` gives the rules.
 */
export function PassImport({
	onImported,
}: Readonly<{ onImported: (pass: ImportedPass) => void }>) {
	const text = useText();
	const id = useId();
	const [state, setState] = useState<"idle" | "reading" | "done" | ImportError>(
		"idle",
	);

	async function onChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		// A second choice of the same file must work again.
		event.target.value = "";
		if (!file) {
			return;
		}
		if (file.size > MAX_IMAGE_BYTES) {
			setState("file_too_large");
			return;
		}
		setState("reading");
		const result = await importFile(new Uint8Array(await file.arrayBuffer()), {
			findAirport,
			today: new Date().toISOString().slice(0, 10),
			readBarcode,
		});
		if ("error" in result) {
			setState(result.error);
			return;
		}
		setState("done");
		onImported(result);
	}

	return (
		<div className="flex flex-col gap-2 rounded-[14px] border border-foreground/15 border-dashed p-4">
			<label
				htmlFor={id}
				className="flex h-11 cursor-pointer items-center justify-center rounded-md bg-pass-accent px-4 font-medium text-paper"
			>
				{state === "reading" ? text.importReading : text.importPass}
			</label>
			<input
				id={id}
				type="file"
				// No `accept`: Safari on iOS greys out a .pkpass file for
				// ".pkpass,application/vnd.apple.pkpass". The content decides,
				// in importFile: a zip, a PDF file or an image.
				onChange={onChange}
				disabled={state === "reading"}
				className="sr-only"
			/>
			<p className="text-muted-foreground text-xs">
				{text.importHint} {text.importPrivacy}
			</p>
			{state === "done" && (
				<p role="status" className="font-medium text-sm">
					{text.importDone}
				</p>
			)}
			{state !== "idle" && state !== "reading" && state !== "done" && (
				<p role="alert" className="text-red-700 text-sm">
					{text[ERROR_TEXT[state]]}
				</p>
			)}
		</div>
	);
}
