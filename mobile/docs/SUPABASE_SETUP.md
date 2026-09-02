# Supabase Connection Setup Guide

Follow these steps to connect the JD Car Rental project to your real Supabase project.

## 1. Get Your Supabase Keys
1. Log in to the [Supabase Dashboard](https://app.supabase.com/).
2. Select your project.
3. Go to **Project Settings** (gear icon) > **API**.
4. Copy the following:
   - **Project URL**
   - **anon public key**

> [!IMPORTANT]
> **NEVER** use the `service_role` key in the web or mobile applications. This key bypasses Row Level Security (RLS) and should only be used in secure backend environments.

## 2. Configure Web App (.env)
1. Navigate to the `/web` directory.
2. Open the `.env` file (created from `.env.example`).
3. Paste your keys:
   ```env
   VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key"
   ```
4. Restart the web development server:
   ```bash
   # Press Ctrl+C then
   npm run dev
   ```

## 3. Configure Mobile App (.env)
1. Navigate to the `/mobile` directory.
2. Open the `.env` file (created from `.env.example`).
3. Paste your keys:
   ```env
   EXPO_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
   EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
   ```
4. Restart the Expo development server:
   ```bash
   # Press Ctrl+C then
   npx expo start
   ```

## 4. Troubleshooting
- **Connection Errors**: Ensure the keys match exactly and do not have trailing spaces.
- **RLS Issues**: If you can't see data, make sure you have applied the SQL schema and policies from `/supabase/schema.sql` and `/supabase/phase3_update.sql`.
- **404 profiles Error**: If you see a blank page or 404 error for the profiles table, run the repair script: `/supabase/fix_profiles_table.sql`.
- **Rate Limits (429)**: If you get rate limited during registration, go to **Authentication > Settings** in Supabase and disable **Confirm email**.
- **Environment Not Updating**: Stop the process and run the dev command again.

## 5. Maintenance & Admin Setup
1. **Apply All Schema Files**: Run files in this order in the SQL Editor:
   - `schema.sql`
   - `phase3_update.sql`
   - `phase4_update.sql`
   - `phase5_update.sql`
   - `fix_profiles_table.sql`
2. **Create Admin**:
   - Register an account normally.
   - In Supabase **Table Editor**, go to `profiles`.
   - Find your user and change `role` from `customer` to `admin`.
3. **Storage**: Ensure the `payment-proofs` bucket is created in the **Storage** tab.

## 6. Seeding Sample Accounts (Development Only)
For testing, you can create predefined Admin and Customer accounts using a local script.

1. Navigate to `/scripts`.
2. Create a `.env` file based on `.env.example`.
3. Go to **Supabase Dashboard > Project Settings > API**.
4. Copy the **service_role** key (secret).
   > [!CAUTION]
   > **NEVER** use the `service_role` key in your frontend apps. It is only for this local script.
5. In your terminal, run:
   ```bash
   # From the project root
   node --env-file=scripts/.env scripts/create-sample-accounts.mjs
   ```
6. **Verify**:
   - Check **Authentication > Users** for the new accounts.
   - Check **Table Editor > profiles** to ensure the roles are correctly set.

## 7. Manual Role Promotion
If you need to make an existing user an Admin manually:
1. Go to **Table Editor > profiles**.
2. Find the user by email or ID.
3. Edit the `role` cell and type `admin`.
4. Click **Save**.

## 8. Security Check
- Verify that `.env` is listed in your `.gitignore` files.
- Confirm that no full keys are printed in the browser console.
