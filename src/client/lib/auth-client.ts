import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The client of Better Auth. The API and the client have one origin, thus the
 * client needs no `baseURL`: it uses the origin of the page and `/api/auth`.
 */
export const authClient = createAuthClient({
	plugins: [magicLinkClient()],
});
