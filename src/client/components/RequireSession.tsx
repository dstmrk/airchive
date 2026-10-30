import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useText } from "../i18n/I18nProvider.tsx";
import { authClient } from "../lib/auth-client.ts";

/** It shows its children to a signed-in person, and sends each other person to the sign-in. */
export function RequireSession({
	children,
}: Readonly<{ children: ReactNode }>) {
	const text = useText();
	const { data: session, isPending } = authClient.useSession();
	if (isPending) {
		return <p className="p-4 text-muted-foreground">{text.loading}</p>;
	}
	if (!session) {
		return <Navigate to="/sign-in" />;
	}
	return children;
}
