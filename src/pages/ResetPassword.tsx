import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function ResetPassword() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the forgot-password page which now handles the entire flow
    navigate('/forgot-password', { replace: true });
  }, [navigate]);

  return null;
}
