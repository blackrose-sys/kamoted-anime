-- ===================================================
-- 1. Create Watchlists Table
-- ===================================================
CREATE TABLE IF NOT EXISTS watchlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  anime_id integer not null,
  title text not null,
  image_url text not null,
  status text default 'watching',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(user_id, anime_id)
);

-- ===================================================
-- 2. Create Watch History Table
-- ===================================================
CREATE TABLE IF NOT EXISTS watch_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  anime_id integer not null,
  title text not null,
  image_url text not null,
  last_episode integer not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(user_id, anime_id)
);

-- ===================================================
-- 3. Create Public Profiles Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  watchlist_privacy TEXT DEFAULT 'public' CHECK (watchlist_privacy IN ('public', 'private')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Populate public.profiles with existing users (if any)
INSERT INTO public.profiles (id, email, username, avatar_url, watchlist_privacy)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  'public'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Trigger function to keep auth.users and public.profiles synchronized
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, avatar_url, watchlist_privacy)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'public'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, profiles.username),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===================================================
-- 4. Enable Row Level Security (RLS)
-- ===================================================
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===================================================
-- 5. Create Policies
-- ===================================================

-- Watch History Policies
DROP POLICY IF EXISTS "Users can manage their own history" ON watch_history;
CREATE POLICY "Users can manage their own history" ON watch_history FOR ALL USING (auth.uid() = user_id);

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Watchlists Policies (enforcing customizable privacy settings)
DROP POLICY IF EXISTS "Users can manage their own watchlists" ON watchlists;
DROP POLICY IF EXISTS "Users can insert their own watchlist items" ON watchlists;
DROP POLICY IF EXISTS "Users can update their own watchlist items" ON watchlists;
DROP POLICY IF EXISTS "Users can delete their own watchlist items" ON watchlists;
DROP POLICY IF EXISTS "Watchlists are viewable if public" ON watchlists;

CREATE POLICY "Users can insert their own watchlist items" ON watchlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlist items" ON watchlists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlist items" ON watchlists
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Watchlists are viewable if public" ON watchlists
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = watchlists.user_id 
        AND profiles.watchlist_privacy = 'public'
    )
  );
