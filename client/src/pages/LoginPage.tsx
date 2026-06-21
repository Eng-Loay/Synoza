import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { PasswordInput } from '../components/PasswordInput';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const saved = JSON.parse(localStorage.getItem('synoza_user') || '{}');
      navigate(saved.role === 'ADMIN' ? '/admin' : '/student');
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SERVER_OFFLINE') {
        setError(t('serverOffline'));
      } else if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(t('invalidCredentials'));
      } else {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen auth-bg flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Activity className="text-white" size={28} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('login')}</h1>
            <p className="text-sm text-slate-500 mt-2">{t('tagline')}</p>
          </div>

          <div className="card p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm border border-red-100 dark:border-red-900/50 animate-slide-down">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{t('email')}</label>
                <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <PasswordInput
                label={t('password')}
                value={password}
                onChange={setPassword}
                required
                autoComplete="current-password"
              />
              <button type="submit" className="btn-primary w-full py-3 mt-2" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('loading')}
                  </span>
                ) : (
                  t('login')
                )}
              </button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-6">
              {t('noAccount')}{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">{t('register')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
