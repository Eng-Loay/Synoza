import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', university: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        university: user.university || '',
      });
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.put('/auth/profile', form);
    updateUser(res.data.user);
    setMessage('Profile updated');
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.put('/auth/change-password', passwords);
    setPasswords({ currentPassword: '', newPassword: '' });
    setMessage('Password changed');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{t('profile')}</h1>
        {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">{message}</div>}

        <form onSubmit={saveProfile} className="card p-6 space-y-4 mb-6">
          <h2 className="font-semibold">{t('updateProfile')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field" placeholder={t('firstName')} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="input-field" placeholder={t('lastName')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <input className="input-field" placeholder={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input-field" placeholder={t('university')} value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
          <button type="submit" className="btn-primary">{t('save')}</button>
        </form>

        <form onSubmit={changePassword} className="card p-6 space-y-4">
          <h2 className="font-semibold">{t('changePassword')}</h2>
          <input type="password" className="input-field" placeholder={t('currentPassword')} value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
          <input type="password" className="input-field" placeholder={t('newPassword')} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
          <button type="submit" className="btn-primary">{t('changePassword')}</button>
        </form>
      </div>
    </div>
  );
}
