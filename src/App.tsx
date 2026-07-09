import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Watch } from './pages/Watch';
import { Browse } from './pages/Browse';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Verify } from './pages/Verify';
import { Profile } from './pages/Profile';
import { UserProfile } from './pages/UserProfile';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Calendar } from './pages/Calendar';
import { News } from './pages/News';
import { WatchRoom } from './pages/WatchRoom';
import { Lists } from './pages/Lists';
import { Contact } from './pages/Contact';
import { AmbientPlayer } from './components/AmbientPlayer';
import { AuthProvider } from './context/AuthContext';
import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

function MobileNativeBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    // Customize Status Bar styling on mobile
    const setupStatusBar = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#030303' });
      } catch (err) {
        console.log('Status bar setup not supported on this platform:', err);
      }
    };

    // Handle physical Android back button
    let backListener: any;
    const setupBackButton = async () => {
      try {
        backListener = await CapApp.addListener('backButton', () => {
          if (window.location.pathname === '/') {
            CapApp.exitApp();
          } else {
            navigate(-1);
          }
        });
      } catch (err) {
        console.log('Back button handler not supported on this platform:', err);
      }
    };

    if ((window as any).Capacitor) {
      setupStatusBar();
      setupBackButton();
    }

    return () => {
      if (backListener) {
        backListener.remove();
      }
    };
  }, [navigate]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <MobileNativeBridge />
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/user/:username" element={<UserProfile />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/news" element={<News />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/room/:roomId" element={<WatchRoom />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
          <Footer />
          <AmbientPlayer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
