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
-- 3. Create Comments Table
-- ===================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  anime_id INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookups by anime + episode
CREATE INDEX IF NOT EXISTS idx_comments_anime_episode ON comments(anime_id, episode, created_at DESC);

-- ===================================================
-- 4. Create Public Profiles Table
-- ===================================================
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
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
-- 5. Enable Row Level Security (RLS)
-- ===================================================
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===================================================
-- 6. Create RLS Policies
-- ===================================================

-- A. Watch History Policies
DROP POLICY IF EXISTS "Users can manage their own history" ON watch_history;
CREATE POLICY "Users can manage their own history" ON watch_history FOR ALL USING (auth.uid() = user_id);

-- B. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- C. Watchlists Policies (customizable privacy)
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

-- D. Comments Policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
CREATE POLICY "Users can insert their own comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- ===================================================
-- 7. Create Chat Messages Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  message TEXT NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 500),
  reactions JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add reactions column to existing tables (idempotent)
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb NOT NULL;

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for Chat Messages
DROP POLICY IF EXISTS "Chat messages are viewable by everyone" ON public.chat_messages;
CREATE POLICY "Chat messages are viewable by everyone" ON public.chat_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can post chat messages" ON public.chat_messages;
CREATE POLICY "Users can post chat messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own chat messages" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update reactions on any message" ON public.chat_messages;
CREATE POLICY "Users can update reactions on any message" ON public.chat_messages FOR UPDATE USING (true) WITH CHECK (true);

-- Index for fast chat loads
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);


-- ===================================================
-- 8. New Feature Expansions (Wave 1, 2, 3)
-- ===================================================

-- Streak columns and preferences on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_last_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS genre_prefs JSONB DEFAULT '[]'::jsonb;

-- Follows table
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follows viewable by all" ON public.follows;
CREATE POLICY "Follows viewable by all" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own follows" ON public.follows;
CREATE POLICY "Users manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- Custom lists
CREATE TABLE IF NOT EXISTS public.anime_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  likes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anime_list_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES public.anime_lists(id) ON DELETE CASCADE NOT NULL,
  anime_id INT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  note TEXT,
  position INT DEFAULT 0
);

ALTER TABLE public.anime_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anime_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lists viewable if public" ON public.anime_lists;
CREATE POLICY "Lists viewable if public" ON public.anime_lists FOR SELECT USING (is_public OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own lists" ON public.anime_lists;
CREATE POLICY "Users manage own lists" ON public.anime_lists FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "List items viewable by all" ON public.anime_list_items;
CREATE POLICY "List items viewable by all" ON public.anime_list_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own list items" ON public.anime_list_items;
CREATE POLICY "Users manage own list items" ON public.anime_list_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.anime_lists WHERE id = list_id AND user_id = auth.uid())
);

-- Timestamped comments
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS timestamp_sec INT;

-- Watch rooms
CREATE TABLE IF NOT EXISTS public.watch_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  anime_id INT NOT NULL,
  episode INT NOT NULL DEFAULT 1,
  is_playing BOOLEAN DEFAULT false,
  current_time FLOAT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.watch_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Watch rooms viewable by all" ON public.watch_rooms;
CREATE POLICY "Watch rooms viewable by all" ON public.watch_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create rooms" ON public.watch_rooms;
CREATE POLICY "Anyone can create rooms" ON public.watch_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Host can update room" ON public.watch_rooms;
CREATE POLICY "Host can update room" ON public.watch_rooms FOR UPDATE USING (auth.uid() = host_id);


