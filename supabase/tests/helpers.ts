import pg from "pg";

export type Actor =
  | { kind: "anon" }
  | { kind: "service" }
  | { kind: "user"; id: string };

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const user = (id: string): Actor => ({ kind: "user", id });

/**
 * Runs one statement as the given API role, the way PostgREST would: inside a
 * transaction with `SET LOCAL ROLE` and the JWT claims. Always rolled back, so
 * tests never leak state into each other.
 */
export async function as<T extends pg.QueryResultRow = pg.QueryResultRow>(
  client: pg.Client,
  actor: Actor,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const role =
    actor.kind === "anon" ? "anon" : actor.kind === "service" ? "service_role" : "authenticated";
  const claims =
    actor.kind === "user" ? { sub: actor.id, role } : { role };
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims),
    ]);
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    await client.query("rollback");
  }
}

/** Runs several statements as one actor inside a single (rolled back) transaction. */
export async function asSteps(
  client: pg.Client,
  actor: Actor,
  steps: [string, unknown[]?][],
): Promise<pg.QueryResultRow[][]> {
  const role = actor.kind === "anon" ? "anon" : actor.kind === "service" ? "service_role" : "authenticated";
  const claims = actor.kind === "user" ? { sub: actor.id, role } : { role };
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const out: pg.QueryResultRow[][] = [];
    for (const [sql, params] of steps) out.push((await client.query(sql, params ?? [])).rows);
    return out;
  } finally {
    await client.query("rollback");
  }
}

/**
 * Several statements, each as its own actor, inside ONE rolled-back transaction: for flows that
 * cross users (a code created by one student and redeemed from another session).
 */
export type StepParams = unknown[] | ((previous: pg.QueryResultRow[][]) => unknown[]);

export async function asActors(
  client: pg.Client,
  steps: [Actor, string, StepParams?][],
): Promise<pg.QueryResultRow[][]> {
  await client.query("begin");
  try {
    const out: pg.QueryResultRow[][] = [];
    for (const [actor, sql, params] of steps) {
      const role = actor.kind === "anon" ? "anon" : actor.kind === "service" ? "service_role" : "authenticated";
      const claims = actor.kind === "user" ? { sub: actor.id, role } : { role };
      await client.query("reset role");
      await client.query(`set local role ${role}`);
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const values = typeof params === "function" ? params(out) : (params ?? []);
      out.push((await client.query(sql, values)).rows);
    }
    return out;
  } finally {
    await client.query("rollback");
  }
}

/** Expects the statement to be rejected by Postgres (RLS violation, missing grant, RPC check). */
export async function expectDenied(
  client: pg.Client,
  actor: Actor,
  sql: string,
  params: unknown[] = [],
  pattern?: RegExp,
): Promise<string> {
  try {
    await as(client, actor, sql, params);
  } catch (error) {
    const message = (error as Error).message;
    if (pattern && !pattern.test(message)) {
      throw new Error(`Denied, but with unexpected message: ${message}`);
    }
    return message;
  }
  throw new Error(`Expected denial but statement succeeded: ${sql}`);
}

export async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}
