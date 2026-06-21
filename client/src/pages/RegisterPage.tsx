import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { PasswordInput } from '../components/PasswordInput';
import api from '../lib/api';

interface UniversityOption {
  id: string;
  nameEn: string;
  nameAr: string;
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    university: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/site/public')
      .then((r) => setUniversities(r.data.universities || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/student');
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen auth-bg flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Activity className="text-white" size={28} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('register')}</h1>
          </div>

          <div className="card p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100 animate-slide-down">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('firstName')}</label>
                  <input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('lastName')}</label>
                  <input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
                <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <PasswordInput
                label={t('password')}
                value={form.password}
                onChange={(password) => setForm({ ...form, password })}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('phone')}</label>
                <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01024828652" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('university')}</label>
                <select className="input-field" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })}>
                  <option value="">--</option>
                  {universities.map((u) => (
                    <option key={u.id} value={isAr ? u.nameAr : u.nameEn}>
                      {isAr ? u.nameAr : u.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full py-3 mt-2" disabled={loading}>
                {loading ? t('loading') : t('register')}
              </button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-6">
              {t('haveAccount')}{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">{t('login')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
