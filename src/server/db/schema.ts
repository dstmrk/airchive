import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The tables of Better Auth. The property names are the field names of Better
 * Auth, and the adapter reads them. The column names use snake_case.
 *
 * `getAuthTables` of `better-auth/db` gives the list of the fields for the
 * options of `src/server/auth.ts`. A new plugin of Better Auth can add a table
 * or a field: compare this file with that list after each change of the
 * options. Refer to paragraph 4.2 of `docs/architecture.md`.
 *
 * A table of the data of a person has `owner_id`. These tables belong to
 * Better Auth, thus `user_id` is the owner.
 */

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	createdAt: timestamp("created_at")
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at")
		.notNull()
		.$defaultFn(() => new Date()),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at")
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at").notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at")
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at").notNull(),
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at")
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at")
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** The counters of the rate limit. Refer to `rateLimit` in `auth.ts`. */
export const rateLimit = sqliteTable(
	"rate_limit",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		count: integer("count").notNull(),
		lastRequest: integer("last_request").notNull(),
	},
	(table) => [uniqueIndex("rate_limit_key_idx").on(table.key)],
);
