# Supabase Auth Setup

## Steps

1. Go to https://supabase.com/dashboard/project/jzhxdwriskdxcivirbip/authentication
2. Under **Providers → Email**: Enable "Enable Email Sign Up"
3. Under **Providers → Email → SMTP Settings**: Configure SMTP for password reset emails (or use Supabase built-in)
4. Under **Authentication → URL Configuration**:
   - Site URL: your frontend URL
   - Redirect URLs: your frontend URL + /auth/callback

## SQL Policy

Run this in Supabase SQL Editor to restrict `auth.users` visibility to admin users:

```sql
CREATE POLICY "Admin can view all auth.users" ON auth.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role_ids && ARRAY[(SELECT id FROM roles WHERE is_admin = TRUE)])
  );
```