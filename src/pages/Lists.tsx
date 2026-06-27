import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Heart, List, BookOpen, Loader2, Sparkles } from 'lucide-react';

interface ListItem {
  id?: string;
  anime_id: number;
  title: string;
  image_url: string;
  note: string;
}

interface AnimeList {
  id: string;
  user_id: string;
  username: string;
  title: string;
  description: string;
  is_public: boolean;
  likes: number;
  created_at: string;
  items?: ListItem[];
}

export function Lists() {
  const { user } = useAuth();
  
  // States
  const [allLists, setAllLists] = useState<AnimeList[]>([]);
  const [likedListIds, setLikedListIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  
  // Search anime states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [itemNote, setItemNote] = useState('');

  // Fetch all public lists
  const fetchLists = async () => {
    setLoading(true);
    try {
      const { data: listsData, error: listsError } = await supabase
        .from('anime_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;
      
      const loadedLists: AnimeList[] = listsData || [];
      
      // Load items for each list
      for (const list of loadedLists) {
        const { data: itemsData } = await supabase
          .from('anime_list_items')
          .select('*')
          .eq('list_id', list.id)
          .order('position', { ascending: true });
        list.items = itemsData || [];
      }
      
      setAllLists(loadedLists);
    } catch (err) {
      console.error('Error fetching lists:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user liked list IDs
  const fetchUserLikes = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('list_likes')
        .select('list_id')
        .eq('user_id', user.id);
      if (!error && data) {
        setLikedListIds(data.map((l: any) => l.list_id));
      }
    } catch (err) {
      console.error('Error fetching user likes:', err);
    }
  };

  // Load lists on mount
  useEffect(() => {
    fetchLists();
  }, []);

  // Sync user likes
  useEffect(() => {
    if (user) {
      fetchUserLikes();
    } else {
      setLikedListIds([]);
    }
  }, [user]);

  // Real-time subscription for lists changes
  useEffect(() => {
    const channel = supabase
      .channel('public:anime_lists')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'anime_lists',
        },
        async (payload) => {
          const updatedList = payload.new as AnimeList;
          const { data: itemsData } = await supabase
            .from('anime_list_items')
            .select('*')
            .eq('list_id', updatedList.id)
            .order('position', { ascending: true });
          
          updatedList.items = itemsData || [];

          setAllLists(prev =>
            prev.map(l => (l.id === updatedList.id ? updatedList : l))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anime_lists',
        },
        async (payload) => {
          const newList = payload.new as AnimeList;
          const { data: itemsData } = await supabase
            .from('anime_list_items')
            .select('*')
            .eq('list_id', newList.id)
            .order('position', { ascending: true });
          
          newList.items = itemsData || [];

          setAllLists(prev => {
            if (prev.some(l => l.id === newList.id)) return prev;
            return [newList, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'anime_lists',
        },
        (payload) => {
          const oldList = payload.old as { id: string };
          setAllLists(prev => prev.filter(l => l.id !== oldList.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Search anime via Jikan
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await res.json();
        setSearchResults(data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Add anime item to draft list
  const addAnimeToDraft = (anime: any) => {
    if (listItems.some(item => item.anime_id === anime.mal_id)) {
      alert('This anime is already in your list!');
      return;
    }
    const newItem: ListItem = {
      anime_id: anime.mal_id,
      title: anime.title,
      image_url: anime.images?.webp?.image_url || anime.images?.jpg?.image_url || '',
      note: itemNote
    };
    setListItems([...listItems, newItem]);
    setSearchQuery('');
    setSearchResults([]);
    setItemNote('');
  };

  // Remove anime item from draft
  const removeAnimeFromDraft = (animeId: number) => {
    setListItems(listItems.filter(item => item.anime_id !== animeId));
  };

  // Handle save list to Supabase
  const handleSaveList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Please login to create a list!');
    if (!newTitle.trim()) return alert('List title is required!');
    if (listItems.length === 0) return alert('Please add at least one anime to your list!');

    try {
      // 1. Insert List header
      const { data: listData, error: listError } = await supabase
        .from('anime_lists')
        .insert({
          user_id: user.id,
          username: user.username,
          title: newTitle.trim(),
          description: newDesc.trim(),
          is_public: newIsPublic,
          likes: 0
        })
        .select()
        .single();

      if (listError) throw listError;

      // 2. Insert items
      const itemsToInsert = listItems.map((item, index) => ({
        list_id: listData.id,
        anime_id: item.anime_id,
        title: item.title,
        image_url: item.image_url,
        note: item.note,
        position: index
      }));

      const { error: itemsError } = await supabase
        .from('anime_list_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Reset form
      setNewTitle('');
      setNewDesc('');
      setListItems([]);
      setCreating(false);
      fetchLists();
    } catch (err) {
      console.error('Error saving list:', err);
      alert('Failed to save your list.');
    }
  };

  // Like / Unlike list
  const handleLikeList = async (listId: string) => {
    if (!user) {
      alert('Please sign in to like playlists!');
      return;
    }

    try {
      const isAlreadyLiked = likedListIds.includes(listId);

      if (isAlreadyLiked) {
        // Unlike list (delete from list_likes; trigger handles count)
        const { error } = await supabase
          .from('list_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('list_id', listId);

        if (error) throw error;

        setLikedListIds(prev => prev.filter(id => id !== listId));
        setAllLists(prev =>
          prev.map(l => (l.id === listId ? { ...l, likes: Math.max(0, (l.likes || 0) - 1) } : l))
        );
      } else {
        // Like list (insert into list_likes; trigger handles count)
        const { error } = await supabase
          .from('list_likes')
          .insert({ user_id: user.id, list_id: listId });

        if (error) throw error;

        setLikedListIds(prev => [...prev, listId]);
        setAllLists(prev =>
          prev.map(l => (l.id === listId ? { ...l, likes: (l.likes || 0) + 1 } : l))
        );
      }
    } catch (err) {
      console.error('Error updating like status:', err);
    }
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <List size={32} color="var(--accent-primary)" />
            Custom Playlists
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Browse curated anime recommendations and custom lists created by the community.
          </p>
        </div>
        {user && !creating && (
          <button 
            onClick={() => setCreating(true)} 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', fontWeight: 800 }}
          >
            <Plus size={16} /> CREATE LIST
          </button>
        )}
      </div>

      {/* CREATE NEW LIST FORM */}
      {creating && (
        <div className="glass" style={{ padding: '2rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
            <Sparkles size={20} /> Create Curated Playlist
          </h2>
          
          <form onSubmit={handleSaveList} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>List Title</label>
              <input 
                type="text"
                placeholder="e.g. Top 10 Slice of Life Masterpieces"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-tertiary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Description</label>
              <textarea 
                placeholder="Write a brief overview of what this playlist represents..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={2}
                style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-tertiary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="newIsPublic"
                checked={newIsPublic} 
                onChange={e => setNewIsPublic(e.target.checked)} 
                style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
              <label htmlFor="newIsPublic" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                Make this playlist public
              </label>
            </div>

            {/* List items builder */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '0 0 1rem 0' }}>Add Anime & Notes</h3>
              
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                  <input 
                    type="text"
                    placeholder="Search anime to add..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ padding: '0.6rem 1rem 0.6rem 2.25rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-tertiary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', width: '100%' }}
                  />
                  <Search size={14} color="var(--text-secondary)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  
                  {/* Results Dropdown */}
                  {searchQuery.trim().length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-color-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', marginTop: '0.25rem', zIndex: 10, maxHeight: '220px', overflowY: 'auto' }}>
                      {searching && (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <Loader2 className="animate-spin" size={18} style={{ margin: '0 auto' }} />
                        </div>
                      )}
                      {!searching && searchResults.map(anime => (
                        <div 
                          key={anime.mal_id}
                          onClick={() => addAnimeToDraft(anime)}
                          style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-color-tertiary)'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <img src={anime.images?.jpg?.image_url} alt="" style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '0.25rem' }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{anime.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <input 
                  type="text" 
                  placeholder="Optional review/note for this show..." 
                  value={itemNote}
                  onChange={e => setItemNote(e.target.value)}
                  style={{ flex: 1.5, minWidth: '200px', padding: '0.6rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color-tertiary)', border: '1px solid var(--border-color)', color: 'white', outline: 'none' }}
                />
              </div>

              {/* Draft Items list */}
              {listItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {listItems.map((item, idx) => (
                    <div key={item.anime_id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-color-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 900, minWidth: '20px' }}>#{idx + 1}</span>
                      <img src={item.image_url} alt="" style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: '0.25rem' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                        {item.note && <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Note: {item.note}</p>}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeAnimeFromDraft(item.anime_id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', border: '1px dashed var(--border-color)', borderRadius: '0.5rem' }}>
                  Your playlist is empty. Add shows using the input above.
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => {
                  setCreating(false);
                  setListItems([]);
                }}
                className="hover-scale"
                style={{ padding: '0.5rem 1.25rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700 }}
              >
                CANCEL
              </button>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ padding: '0.5rem 1.5rem', fontWeight: 800 }}
              >
                SAVE PLAYLIST
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CURATED LISTS BROWSER */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
          <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
        </div>
      ) : allLists.length === 0 ? (
        <div className="glass" style={{ padding: '5rem 2rem', borderRadius: '1.25rem', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <BookOpen size={48} style={{ color: 'var(--border-color)', marginBottom: '1.25rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem' }}>No Playlists Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Be the first to create and share your favorite anime playlists!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {allLists.map(list => (
            <div key={list.id} className="glass hover-scale" style={{ border: '1px solid var(--border-color)', borderRadius: '1.25rem', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 950, margin: 0 }}>{list.title}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span>By</span>
                    <Link to={`/user/${list.username}`} style={{ color: 'var(--accent-primary)', fontWeight: 800, textDecoration: 'none' }} className="hover-underline">
                      {list.username}
                    </Link>
                    <span>•</span>
                    <span>{new Date(list.created_at).toLocaleDateString()}</span>
                  </div>
                  {list.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.75rem', lineHeight: 1.5, margin: '0.75rem 0 0 0' }}>{list.description}</p>}
                </div>
                
                <button 
                  onClick={() => handleLikeList(list.id)}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    padding: '0.4rem 0.8rem', 
                    borderRadius: '2rem', 
                    backgroundColor: likedListIds.includes(list.id) ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)', 
                    border: likedListIds.includes(list.id) ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)', 
                    color: likedListIds.includes(list.id) ? '#f472b6' : 'rgba(255, 255, 255, 0.7)', 
                    fontWeight: 800, 
                    fontSize: '0.75rem', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s' 
                  }}
                  className="hover-scale"
                >
                  <Heart size={14} fill={likedListIds.includes(list.id) ? "#f472b6" : "none"} color="#f472b6" />
                  <span>{likedListIds.includes(list.id) ? 'LIKED' : 'LIKE'} ({list.likes})</span>
                </button>
              </div>

              {/* List items scrollable strip */}
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'thin' }}>
                {list.items?.map((item, idx) => (
                  <div key={item.anime_id} style={{ width: '130px', flexShrink: 0, position: 'relative' }}>
                    <Link to={`/watch/${item.anime_id}`} style={{ textDecoration: 'none', color: 'white' }} className="hover-scale">
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: '0.35rem', left: '0.35rem', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontSize: '0.75rem', fontWeight: 900 }}>
                          {idx + 1}
                        </div>
                      </div>
                      <h4 style={{ fontSize: '0.75rem', fontWeight: 800, margin: '0.5rem 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                    </Link>
                    {item.note && (
                      <div 
                        title={item.note} 
                        style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
