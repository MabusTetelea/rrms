/**
 * Account management from the command line — there's no self-signup, so this
 * is how operators get in.
 *
 *   npm run user -- add anna@linella.md "Anna Rusu" admin
 *   npm run user -- list
 *   npm run user -- passwd anna@linella.md
 *   npm run user -- disable anna@linella.md
 *   npm run user -- enable anna@linella.md
 *   npm run user -- demo          # the two beta quick-login accounts
 *
 * Passwords are generated, printed once, and never stored in the clear. Nothing
 * takes a password as an argument, so none of this lands in shell history.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { generatePassword, hashPassword } from "../src/lib/auth/password";
import { QUICK_LOGIN_ACCOUNTS } from "../src/lib/auth/quick-login";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function add(email: string, name: string, role: string) {
  if (!email || !name) {
    throw new Error('Usage: add <email> "<name>" [operator|admin]');
  }
  const finalRole = role === "admin" ? "admin" : "operator";
  const password = generatePassword();

  await db.insert(users).values({
    email: normalizeEmail(email),
    name,
    role: finalRole,
    passwordHash: await hashPassword(password),
  });

  console.log(`\nCreated ${finalRole}: ${normalizeEmail(email)}`);
  console.log(`Password: ${password}`);
  console.log("Write it down — it isn't stored and can't be shown again.\n");
}

async function list() {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.email));

  if (rows.length === 0) {
    console.log('No accounts yet. Create one with: npm run user -- add <email> "<name>" admin');
    return;
  }

  console.table(
    rows.map((r) => ({
      email: r.email,
      name: r.name,
      role: r.role,
      status: r.active ? "active" : "disabled",
      lastLogin: r.lastLoginAt?.toISOString().slice(0, 16).replace("T", " ") ?? "never",
    })),
  );
}

async function passwd(email: string) {
  const password = generatePassword();
  const result = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(users.email, normalizeEmail(email)))
    .returning({ email: users.email });

  if (result.length === 0) throw new Error(`No account for ${email}`);

  console.log(`\nNew password for ${result[0].email}: ${password}\n`);
}

async function setActive(email: string, active: boolean) {
  const result = await db
    .update(users)
    .set({ active, updatedAt: new Date() })
    .where(eq(users.email, normalizeEmail(email)))
    .returning({ email: users.email });

  if (result.length === 0) throw new Error(`No account for ${email}`);
  console.log(`${result[0].email} is now ${active ? "active" : "disabled"}.`);
  if (!active) console.log("Existing sessions stop working on their next request.");
}

/** Creates (or resets) the beta quick-login accounts. */
async function demo() {
  for (const account of QUICK_LOGIN_ACCOUNTS) {
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    const name = account.role === "admin" ? "Demo Admin" : "Demo Operator";

    await db
      .insert(users)
      .values({ email: account.email, name, role: account.role, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash, name, role: account.role, active: true, updatedAt: new Date() },
      });

    console.log(`${account.role.padEnd(8)} ${account.email}  ${password}`);
  }
  console.log(
    "\nThese are the accounts behind the quick-login buttons.\n" +
      "Set ENABLE_QUICK_LOGIN=true to show them, and remove them before real data.\n",
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "add":
      await add(args[0], args[1], args[2]);
      break;
    case "list":
      await list();
      break;
    case "passwd":
      await passwd(args[0]);
      break;
    case "disable":
      await setActive(args[0], false);
      break;
    case "enable":
      await setActive(args[0], true);
      break;
    case "demo":
      await demo();
      break;
    default:
      console.log(
        [
          "Commands:",
          '  add <email> "<name>" [operator|admin]',
          "  list",
          "  passwd <email>",
          "  disable <email>",
          "  enable <email>",
          "  demo",
        ].join("\n"),
      );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
