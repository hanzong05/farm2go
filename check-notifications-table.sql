-- Check current notifications table status
-- Run this first to see what's wrong with your notifications table

-- 1. Check if table exists
SELECT
    CASE
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications')
        THEN '✅ Table exists'
        ELSE '❌ Table missing'
    END AS table_status;

-- 2. Check table structure (if it exists)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check constraints
SELECT constraint_name, constraint_type, is_deferrable, initially_deferred
FROM information_schema.table_constraints
WHERE table_name = 'notifications'
AND table_schema = 'public';

-- 4. Check specific check constraint details
SELECT
    cc.constraint_name,
    cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.table_constraints tc
    ON cc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'notifications'
AND tc.table_schema = 'public';

-- 5. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications';

-- 6. Try to count rows
SELECT
    CASE
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications')
        THEN (SELECT COUNT(*)::text || ' notifications exist' FROM notifications)
        ELSE 'Table does not exist'
    END AS row_count;