import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SEED_PASSWORD_ALAN",
  "SEED_PASSWORD_JAZIEL",
  "SEED_PASSWORD_LEO",
] as const;

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("Missing required environment variables:");
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error(
    "\nSet these in .env.local (see .env.local.example) before running the seed script."
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const partners = [
  { name: "Alan", email: "alan@ajlgroup.com", password: process.env.SEED_PASSWORD_ALAN! },
  { name: "Jaziel", email: "jaziel@ajlgroup.com", password: process.env.SEED_PASSWORD_JAZIEL! },
  { name: "Leo", email: "leo@ajlgroup.com", password: process.env.SEED_PASSWORD_LEO! },
];

async function seed() {
  let hadFailure = false;

  for (const partner of partners) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: partner.email,
      password: partner.password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error(`Error creating ${partner.name}:`, authError?.message ?? "unknown error");
      hadFailure = true;
      continue;
    }

    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      name: partner.name,
      email: partner.email,
    });

    if (profileError) {
      console.error(`Error creating profile for ${partner.name}:`, profileError.message);
      hadFailure = true;
      continue;
    }

    console.log(`Created ${partner.name} (${partner.email})`);
  }

  console.log("\nSeed complete. Change passwords after first login!");

  if (hadFailure) {
    console.error("\nSeed finished with errors — see above.");
    process.exit(1);
  }
}

seed();
