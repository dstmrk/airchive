import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useText } from "./i18n/I18nProvider.tsx";
import { authClient } from "./lib/auth-client.ts";
import { linkErrorKey, requestErrorKey } from "./lib/sign-in.ts";

type State =
	| { kind: "idle" }
	| { kind: "sending" }
	| { kind: "sent" }
	| { kind: "failed"; status: number | undefined };

export function SignInPage() {
	const text = useText();
	const { error } = useSearch({ from: "/sign-in" });
	const [email, setEmail] = useState("");
	const [state, setState] = useState<State>({ kind: "idle" });

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setState({ kind: "sending" });
		const result = await authClient.signIn.magicLink({
			email,
			callbackURL: "/",
			errorCallbackURL: "/sign-in",
		});
		setState(
			result.error
				? { kind: "failed", status: result.error.status }
				: { kind: "sent" },
		);
	}

	if (state.kind === "sent") {
		return (
			<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
				<h1 className="font-semibold text-2xl">{text.signInSentTitle}</h1>
				<p className="text-muted-foreground">{text.signInSentBody}</p>
			</main>
		);
	}

	const linkError = state.kind === "idle" ? linkErrorKey(error ?? null) : null;
	const message =
		state.kind === "failed"
			? text[requestErrorKey(state.status)]
			: linkError && text[linkError];

	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
			<div className="flex flex-col gap-1">
				<h1 className="font-semibold text-2xl">{text.signInTitle}</h1>
				<p className="text-muted-foreground">{text.signInLead}</p>
			</div>
			<form onSubmit={submit} className="flex flex-col gap-3">
				<label htmlFor="email" className="font-medium text-sm">
					{text.signInEmailLabel}
				</label>
				<input
					id="email"
					type="email"
					autoComplete="email"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					className="h-11 rounded-md border border-foreground/20 bg-white px-3 text-base"
				/>
				<button
					type="submit"
					disabled={state.kind === "sending"}
					className="h-11 rounded-md bg-foreground px-4 font-medium text-background disabled:opacity-50"
				>
					{state.kind === "sending" ? text.signInSending : text.signInSubmit}
				</button>
				{message && (
					<p role="alert" className="text-red-700 text-sm">
						{message}
					</p>
				)}
			</form>
		</main>
	);
}
