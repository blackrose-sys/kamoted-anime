import { Shield, Eye, Cookie, Database, UserCheck, Bell, Trash2, Globe, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PrivacyPolicy() {
  const sections = [
    {
      icon: <Eye size={20} />,
      title: 'Information We Collect',
      content: [
        'Account Information: When you register, we collect your email address, username, and password (securely hashed).',
        'Profile Data: Avatar images you upload, display name preferences, and genre preferences from our anime quiz.',
        'Usage Data: Watch history, watchlist entries, episode progress, comments, and playlist data you create.',
        'Technical Data: Browser type, device information, and IP address for security and analytics purposes.',
      ]
    },
    {
      icon: <Database size={20} />,
      title: 'How We Use Your Data',
      content: [
        'To provide and maintain your account and personalized anime experience.',
        'To track your watch history and episode progress so you can continue where you left off.',
        'To power social features like friend activity feeds, public profiles, and community chat.',
        'To send episode release notifications for anime in your watchlist (if enabled).',
        'To improve our platform through aggregated, anonymized usage analytics.',
      ]
    },
    {
      icon: <UserCheck size={20} />,
      title: 'Data Sharing & Third Parties',
      content: [
        'We do NOT sell your personal data to third parties.',
        'We use Supabase for authentication and database hosting, which processes your data under their privacy policy.',
        'We fetch anime metadata from AniList and Jikan (MyAnimeList) APIs — no personal data is shared with these services.',
        'Your public profile (username, avatar, watchlist if set to public) is visible to other users of the platform.',
      ]
    },
    {
      icon: <Cookie size={20} />,
      title: 'Cookies & Local Storage',
      content: [
        'We use session storage to cache anime data temporarily for performance (auto-expires after 5 minutes).',
        'Authentication tokens are stored securely to keep you signed in across sessions.',
        'We do not use third-party tracking cookies or advertising cookies.',
      ]
    },
    {
      icon: <Shield size={20} />,
      title: 'Data Security',
      content: [
        'Passwords are hashed using industry-standard algorithms and never stored in plain text.',
        'All data transmission is encrypted via HTTPS/TLS.',
        'We use Supabase Row-Level Security (RLS) policies to ensure users can only access their own data.',
        'Avatar uploads are stored in secure cloud storage with access controls.',
      ]
    },
    {
      icon: <Bell size={20} />,
      title: 'Notifications',
      content: [
        'You may receive browser notifications for new episode releases if you enable them.',
        'You can disable notifications at any time through your browser settings.',
        'We do not send marketing emails or spam.',
      ]
    },
    {
      icon: <Trash2 size={20} />,
      title: 'Your Rights & Data Deletion',
      content: [
        'You can view and edit your profile information at any time from your Profile settings.',
        'You can delete individual watch history entries and watchlist items.',
        'You can change your watchlist privacy between public and private.',
        'To request complete account deletion and removal of all associated data, please contact us.',
      ]
    },
    {
      icon: <Globe size={20} />,
      title: 'Children\'s Privacy',
      content: [
        'Kamoted is not directed at children under 13. We do not knowingly collect data from children under 13.',
        'Content on this platform may include anime rated for mature audiences. Parental discretion is advised.',
        'If you believe a child under 13 has provided us with personal data, please contact us for removal.',
      ]
    },
  ];

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem 4rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
      
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '800px', marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.65rem', 
          padding: '0.5rem 1.25rem', 
          borderRadius: '9999px', 
          backgroundColor: 'rgba(245, 158, 11, 0.08)', 
          border: '1px solid rgba(245, 158, 11, 0.2)', 
          marginBottom: '1.5rem',
          fontSize: '0.75rem',
          fontWeight: 900,
          color: 'var(--accent-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>
          <Shield size={14} />
          Legal
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: '0.75rem' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.6, maxWidth: '550px', margin: '0 auto' }}>
          Your privacy matters to us. This policy explains how Kamoted collects, uses, and protects your data.
        </p>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', fontWeight: 600, marginTop: '1rem' }}>
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Policy Sections */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {sections.map((section, idx) => (
          <div 
            key={idx} 
            className="glass"
            style={{ 
              padding: '2rem', 
              borderRadius: '1.25rem', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'rgba(8, 8, 12, 0.55)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '0.65rem', 
                backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                border: '1px solid rgba(245, 158, 11, 0.15)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                flexShrink: 0
              }}>
                {section.icon}
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
                {section.title}
              </h2>
            </div>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.85rem' 
            }}>
              {section.content.map((item, i) => (
                <li 
                  key={i} 
                  style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    alignItems: 'flex-start',
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.65,
                    fontWeight: 500
                  }}
                >
                  <span style={{ 
                    color: 'var(--accent-primary)', 
                    fontSize: '0.5rem', 
                    marginTop: '0.55rem', 
                    flexShrink: 0 
                  }}>●</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Contact Section */}
        <div 
          className="glass"
          style={{ 
            padding: '2rem', 
            borderRadius: '1.25rem', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'rgba(8, 8, 12, 0.55)',
            backdropFilter: 'blur(16px)',
            textAlign: 'center'
          }}
        >
          <div style={{ 
            width: '44px', 
            height: '44px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <Mail size={20} color="black" />
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: '0.5rem' }}>Questions?</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.6, marginBottom: '1.25rem' }}>
            If you have any questions about this Privacy Policy or want to exercise your data rights, feel free to reach out.
          </p>
          <Link 
            to="/contact" 
            className="btn-primary"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.75rem 1.75rem', 
              fontSize: '0.85rem', 
              fontWeight: 900, 
              borderRadius: '0.75rem' 
            }}
          >
            <Mail size={15} /> Contact Us
          </Link>
        </div>
      </div>
    </main>
  );
}
