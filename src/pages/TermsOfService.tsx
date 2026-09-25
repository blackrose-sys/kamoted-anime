import { Link } from 'react-router-dom';
import { Shield, FileText, AlertTriangle, Users, Globe, Scale } from 'lucide-react';

export function TermsOfService() {
  const sectionStyle: React.CSSProperties = {
    marginBottom: '2.5rem',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '1.15rem',
    fontWeight: 900,
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--accent-primary)',
  };

  const textStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: '0.88rem',
    lineHeight: 1.8,
    fontWeight: 500,
  };

  return (
    <main className="container fade-in" style={{ flex: 1, padding: '8rem 1.5rem 4rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>Terms of Service</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
          Last updated: September 2026 • Effective immediately
        </p>
      </div>

      <div style={{
        backgroundColor: 'rgba(245, 158, 11, 0.04)',
        border: '1px solid rgba(245, 158, 11, 0.15)',
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '2.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        fontSize: '0.85rem',
        color: '#fef08a',
        fontWeight: 600,
        lineHeight: 1.6
      }}>
        <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>By creating an account or using Kamoted, you agree to these Terms of Service and our <Link to="/privacy" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Privacy Policy</Link>. If you do not agree, do not use this platform.</span>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}><FileText size={18} /> 1. Acceptance of Terms</h2>
        <p style={textStyle}>
          These Terms of Service ("Terms") govern your access to and use of the Kamoted platform ("Service"), including its website, applications, and all related services. By registering, accessing, or using the Service, you agree to be bound by these Terms. We reserve the right to update these Terms at any time without prior notice.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}><Users size={18} /> 2. User Accounts</h2>
        <p style={textStyle}>
          You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials. You must not share your account with others. You must be at least 13 years old to use this Service. We reserve the right to suspend or terminate accounts that violate these Terms, engage in abusive behavior, or compromise the security of the platform.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}><Shield size={18} /> 3. Acceptable Use</h2>
        <p style={textStyle}>
          You agree NOT to: attempt to gain unauthorized access to the platform or its systems; engage in any form of DDoS attacks, hacking, or exploitation; use automated bots or scrapers; harass, abuse, or threaten other users; impersonate other users or staff; upload malicious content; circumvent security measures; or use the platform for any illegal purpose. Violation of these rules will result in immediate account termination and potential legal action.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}><Globe size={18} /> 4. Content & Third-Party Services</h2>
        <p style={textStyle}>
          Kamoted aggregates and links to content provided by third-party services. We do not host, upload, or store any anime content on our servers. We are not responsible for the availability, accuracy, or legality of third-party content. All anime titles, images, and metadata are the property of their respective owners and licensors. User-generated content (comments, lists, etc.) remains the property of the user, but you grant Kamoted a non-exclusive license to display it.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}><Scale size={18} /> 5. Limitation of Liability</h2>
        <p style={textStyle}>
          The Service is provided "as is" without warranties of any kind. Kamoted shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. We do not guarantee uninterrupted service availability. Use the Service at your own risk.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}><Shield size={18} /> 6. Security</h2>
        <p style={textStyle}>
          We implement industry-standard security measures including encrypted communications (HTTPS/TLS), secure authentication via Supabase, rate limiting, and content security policies. However, no system is 100% secure. You are responsible for keeping your account credentials safe. Report any security vulnerabilities to the admin immediately.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}><AlertTriangle size={18} /> 7. Termination & Bans</h2>
        <p style={textStyle}>
          We reserve the right to ban, suspend, or terminate any user account at our sole discretion, with or without notice, for any reason including but not limited to: violation of these Terms, abusive behavior, spamming, or compromising the security or integrity of the platform. Banned users will be notified of the reason and duration of their ban.
        </p>
      </div>

      <div style={{ 
        borderTop: '1px solid var(--border-color)', 
        paddingTop: '2rem', 
        marginTop: '2rem',
        color: 'var(--text-secondary)',
        fontSize: '0.82rem',
        fontWeight: 500
      }}>
        <p>If you have questions about these Terms, please <Link to="/contact" style={{ color: 'var(--accent-primary)' }}>contact us</Link>.</p>
        <p style={{ marginTop: '0.5rem' }}>
          <Link to="/privacy" style={{ color: 'var(--accent-primary)' }}>Privacy Policy</Link> • <Link to="/terms" style={{ color: 'var(--accent-primary)' }}>Terms of Service</Link>
        </p>
      </div>
    </main>
  );
}
