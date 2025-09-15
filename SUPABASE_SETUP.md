# Farm2Go Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click "New Project"
3. Choose your organization
4. Set project name: `farm2go`
5. Set database password (save this securely)
6. Choose your region
7. Click "Create new project"

## 2. Get Your Project Credentials

1. Go to your project dashboard
2. Click on "Settings" in the left sidebar
3. Click on "API"
4. Copy your:
   - **Project URL** (looks like: `https://your-project-ref.supabase.co`)
   - **Anon public** key (starts with `eyJ...`)

## 3. Configure Environment Variables

1. Open `.env.local` in your project root
2. Replace the placeholder values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Set Up Database Schema

1. In your Supabase dashboard, go to "SQL Editor"
2. Copy the contents of `supabase/schema.sql`
3. Paste it into the SQL Editor
4. Click "Run" to execute the schema

This will create:
- `profiles` table for user information
- `products` table for farm products
- `orders` table for buyer orders
- `transactions` table for payments
- Row Level Security policies
- Database triggers and functions

## 5. Configure Authentication

1. In Supabase dashboard, go to "Authentication" → "Settings"
2. Enable email confirmations if desired
3. Configure redirect URLs for password reset:
   - Add `farm2go://reset-password` for mobile
   - Add your web domain if deploying to web

## 6. Test the Setup

1. Restart your Expo development server: `npm start`
2. Try registering a new user
3. Check the Supabase dashboard:
   - "Authentication" → "Users" should show your new user
   - "Table Editor" → "profiles" should show the user profile

## 7. Database Structure

### Tables Created:

- **profiles**: User information (farmer/buyer details)
- **products**: Farm products with pricing and availability
- **orders**: Purchase orders between buyers and farmers
- **transactions**: Payment tracking

### User Types:
- `farmer`: Can create products, manage orders
- `buyer`: Can browse products, place orders
- `admin`: Full access to manage users and moderate content

## 8. Security Features

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Admins have special permissions
- Automatic profile creation on user registration

## 9. Troubleshooting

### Common Issues:

1. **Environment variables not working:**
   - Make sure `.env.local` is in project root
   - Restart Expo development server
   - Variables must start with `EXPO_PUBLIC_`

2. **Database connection fails:**
   - Check your project URL and API key
   - Ensure your Supabase project is active

3. **Registration fails:**
   - Check if database schema was applied correctly
   - Look at Supabase dashboard logs in "Logs" section

4. **User can't login:**
   - Check if email confirmation is required
   - Verify user exists in Authentication → Users

## 10. Next Steps

With Supabase connected, you can now:
- Register and login users
- Store user profiles with farmer/buyer specific data
- Build product management features
- Implement order processing
- Add real-time features using Supabase realtime

## Production Checklist

Before going live:
- [ ] Set up proper email templates
- [ ] Configure custom SMTP for emails
- [ ] Set up backup policies
- [ ] Configure production environment variables
- [ ] Set up monitoring and alerts
- [ ] Review security policies
- [ ] Test all user flows