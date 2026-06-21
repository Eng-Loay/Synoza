import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  Users, FileText, BarChart3, ClipboardList,
  TrendingUp, Activity, CheckCircle2, BookOpen, FolderTree, Plus, Trash2,
  Globe, GraduationCap, Pencil, X, Eye, ExternalLink, RefreshCw,
} from 'lucide-react';
import api, { pingServer } from '../lib/api';
import { DashboardLayout } from '../components/DashboardLayout';
import type { SiteSettings } from '../components/SiteFooter';

type Tab = 'overview' | 'users' | 'cases' | 'results' | 'knowledge' | 'site';

interface CategoryRow {
  id: string;
  nameEn: string;
  nameAr: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  parent?: { id: string; nameEn: string; nameAr: string } | null;
  _count?: { items: number; cases: number; children: number };
}

interface KnowledgeRow {
  id: string;
  categoryId: string;
  titleEn: string;
  titleAr: string;
  content: string;
  type: string;
  isActive: boolean;
}

interface UniversityRow {
  id: string;
  nameEn: string;
  nameAr: string;
  logoUrl?: string | null;
  website?: string | null;
  sortOrder: number;
  isActive: boolean;
}

const statMeta: Record<string, { label: string; icon: typeof Users; color: string; bg: string }> = {
  users: { label: 'Total Users', icon: Users, color: 'text-blue-600', bg: 'bg-blue-500' },
  cases: { label: 'Clinical Cases', icon: FileText, color: 'text-violet-600', bg: 'bg-violet-500' },
  sessions: { label: 'Sessions', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-500' },
  completedSessions: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500' },
  averageScore: { label: 'Avg Score', icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-500' },
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recentSessions, setRecentSessions] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeRow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categoryForm, setCategoryForm] = useState({
    nameEn: '', nameAr: '', description: '', parentId: '', sortOrder: 0,
  });
  const [knowledgeForm, setKnowledgeForm] = useState({
    titleEn: '', titleAr: '', content: '', type: 'QUESTION',
  });
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [uniForm, setUniForm] = useState({ nameEn: '', nameAr: '', logoUrl: '', website: '', sortOrder: 0, isActive: true });
  const [editingUniId, setEditingUniId] = useState<string | null>(null);
  const [viewingUni, setViewingUni] = useState<UniversityRow | null>(null);
  const [uniLoading, setUniLoading] = useState(false);
  const [uniError, setUniError] = useState('');
  const [uniSaving, setUniSaving] = useState(false);
  const [siteSaved, setSiteSaved] = useState(false);

  const loadSiteContent = async () => {
    setUniLoading(true);
    setUniError('');
    try {
      const ping = await pingServer();
      if (!ping.online) {
        setUniError('Backend server is offline. Stop any duplicate server, then from the Synoza folder run: npm run dev');
        return;
      }

      const [uniRes, settingsRes] = await Promise.all([
        api.get('/admin/universities'),
        api.get('/admin/site-settings'),
      ]);
      setUniversities(uniRes.data.universities || []);
      setSiteSettings(settingsRes.data.settings);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 403) {
          setUniError('Admin access required. Log in with admin@synoza.com / Admin@123456');
        } else if (!err.response) {
          setUniError('Cannot reach the API server. Run npm run dev from C:\\Users\\Eng-Loay\\Desktop\\Synoza (not from server/ alone).');
        } else {
          setUniError(String(err.response.data?.error || 'Could not load site content.'));
        }
      } else {
        setUniError('Could not load site content.');
      }
    } finally {
      setUniLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'overview') {
      api.get('/admin/stats').then((r) => {
        setStats(r.data.stats);
        setRecentSessions(r.data.recentSessions || []);
      });
    }
    if (tab === 'users') api.get('/admin/users').then((r) => setUsers(r.data.users));
    if (tab === 'cases') api.get('/admin/cases').then((r) => setCases(r.data.cases));
    if (tab === 'results') api.get('/admin/results').then((r) => setResults(r.data.results));
    if (tab === 'knowledge') {
      api.get('/admin/categories').then((r) => {
        setCategories(r.data.categories);
        if (!selectedCategoryId && r.data.categories.length > 0) {
          setSelectedCategoryId(r.data.categories[0].id);
        }
      });
    }
    if (tab === 'site') {
      void loadSiteContent();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'knowledge' && selectedCategoryId) {
      api.get(`/admin/categories/${selectedCategoryId}/knowledge`).then((r) => setKnowledgeItems(r.data.items));
    }
  }, [tab, selectedCategoryId]);

  const navItems = [
    { id: 'overview', label: t('statistics'), icon: BarChart3 },
    { id: 'users', label: t('users'), icon: Users },
    { id: 'cases', label: t('cases'), icon: FileText },
    { id: 'results', label: t('results'), icon: ClipboardList },
    { id: 'knowledge', label: t('knowledgeBase'), icon: BookOpen },
    { id: 'site', label: 'Site Content', icon: Globe },
  ];

  const addCategory = async () => {
    await api.post('/admin/categories', {
      ...categoryForm,
      parentId: categoryForm.parentId || null,
    });
    setCategoryForm({ nameEn: '', nameAr: '', description: '', parentId: '', sortOrder: 0 });
    const r = await api.get('/admin/categories');
    setCategories(r.data.categories);
  };

  const addKnowledge = async () => {
    if (!selectedCategoryId) return;
    await api.post('/admin/knowledge', { ...knowledgeForm, categoryId: selectedCategoryId, isActive: true });
    setKnowledgeForm({ titleEn: '', titleAr: '', content: '', type: 'QUESTION' });
    const r = await api.get(`/admin/categories/${selectedCategoryId}/knowledge`);
    setKnowledgeItems(r.data.items);
  };

  const deleteKnowledge = async (id: string) => {
    await api.delete(`/admin/knowledge/${id}`);
    setKnowledgeItems((items) => items.filter((i) => i.id !== id));
  };

  const deleteCategory = async (id: string) => {
    await api.delete(`/admin/categories/${id}`);
    const r = await api.get('/admin/categories');
    setCategories(r.data.categories);
    if (selectedCategoryId === id) setSelectedCategoryId(r.data.categories[0]?.id || '');
  };

  const resetUniForm = () => {
    setUniForm({ nameEn: '', nameAr: '', logoUrl: '', website: '', sortOrder: 0, isActive: true });
    setEditingUniId(null);
    setViewingUni(null);
  };

  const saveUniversity = async () => {
    setUniSaving(true);
    setUniError('');
    const payload = {
      ...uniForm,
      logoUrl: uniForm.logoUrl || null,
      website: uniForm.website || null,
    };
    try {
      if (editingUniId) {
        await api.put(`/admin/universities/${editingUniId}`, payload);
      } else {
        await api.post('/admin/universities', payload);
      }
      resetUniForm();
      const r = await api.get('/admin/universities');
      setUniversities(r.data.universities || []);
    } catch {
      setUniError('Could not save university. Check required fields and try again.');
    } finally {
      setUniSaving(false);
    }
  };

  const editUniversity = (uni: UniversityRow) => {
    setViewingUni(null);
    setEditingUniId(uni.id);
    setUniForm({
      nameEn: uni.nameEn,
      nameAr: uni.nameAr,
      logoUrl: uni.logoUrl || '',
      website: uni.website || '',
      sortOrder: uni.sortOrder,
      isActive: uni.isActive,
    });
  };

  const viewUniversity = (uni: UniversityRow) => {
    setEditingUniId(null);
    setViewingUni(uni);
  };

  const deleteUniversity = async (id: string) => {
    const uni = universities.find((u) => u.id === id);
    if (!window.confirm(`Delete "${uni?.nameEn || 'this university'}"?`)) return;
    setUniError('');
    try {
      await api.delete(`/admin/universities/${id}`);
      setUniversities((list) => list.filter((u) => u.id !== id));
      if (editingUniId === id) resetUniForm();
      if (viewingUni?.id === id) setViewingUni(null);
    } catch {
      setUniError('Could not delete university.');
    }
  };

  const saveSiteSettings = async () => {
    if (!siteSettings) return;
    const r = await api.put('/admin/site-settings', siteSettings);
    setSiteSettings(r.data.settings);
    setSiteSaved(true);
    setTimeout(() => setSiteSaved(false), 2000);
  };

  return (
    <DashboardLayout
      title={t('adminPanel')}
      subtitle="Manage users, cases, results & site content"
      navItems={navItems}
      activeId={tab}
      onNavChange={(id) => setTab(id as Tab)}
      homeLink="/admin"
    >
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {Object.entries(stats).map(([key, value]) => {
              const meta = statMeta[key] || { label: key, icon: BarChart3, color: 'text-slate-600', bg: 'bg-slate-500' };
              const Icon = meta.icon;
              return (
                <div key={key} className="stat-card group hover:shadow-md transition-shadow">
                  <div className={`absolute top-0 right-0 w-20 h-20 ${meta.bg} rounded-full opacity-10 -translate-y-1/3 translate-x-1/3`} />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{meta.label}</p>
                      <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">
                        {typeof value === 'number' ? (key === 'averageScore' ? `${Math.round(value * 10) / 10}%` : value) : value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 ${meta.color}`}>
                      <Icon size={22} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t('recentSessions')}</h2>
            </div>
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Case</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-slate-400 py-8">No sessions yet</td></tr>
                  ) : (
                    recentSessions.map((s) => {
                      const user = s.user as Record<string, string>;
                      const caseData = s.case as Record<string, string>;
                      return (
                        <tr key={s.id as string}>
                          <td className="font-medium">{user?.firstName} {user?.lastName}</td>
                          <td>{caseData?.titleEn}</td>
                          <td className="text-slate-500">{new Date(s.startedAt as string).toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t('users')}</h2>
            <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{users.length} total</span>
          </div>
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>University</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id as string}>
                    <td className="font-medium">{u.firstName as string} {u.lastName as string}</td>
                    <td>{u.email as string}</td>
                    <td><span className="badge bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{u.role as string}</span></td>
                    <td className="text-slate-500">{(u.university as string) || '—'}</td>
                    <td>
                      <span className={`badge ${u.isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cases' && (
        <div className="grid gap-3">
          {cases.map((c) => (
            <div key={c.id as string} className="card card-interactive p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                  <FileText className="text-violet-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{c.titleEn as string}</p>
                  <p className="text-sm text-slate-500">{c.patientName as string}</p>
                </div>
              </div>
              <span className={`badge ${c.isPublished ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {c.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'results' && (
        <div className="card overflow-hidden animate-fade-in">
            <div className="table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Case</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const session = r.session as Record<string, unknown>;
                  const user = (session?.user as Record<string, string>) || {};
                  const caseData = (session?.case as Record<string, string>) || {};
                  return (
                    <tr key={r.id as string}>
                      <td className="font-medium">{user.firstName} {user.lastName}</td>
                      <td>{caseData.titleEn}</td>
                      <td><span className="font-bold text-primary">{r.totalScore as number}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <FolderTree className="text-primary" size={20} />
                <h2 className="font-semibold text-slate-900 dark:text-white">{t('categories')}</h2>
              </div>
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedCategoryId === cat.id
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{cat.nameEn} / {cat.nameAr}</p>
                    <p className="text-xs text-slate-500">
                      {cat.parent ? `${cat.parent.nameEn} → ` : ''}{cat._count?.items ?? 0} items · {cat._count?.children ?? 0} sub
                    </p>
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <p className="text-sm font-medium">{t('addCategory')}</p>
                <input className="input-field" placeholder="Name (English)" value={categoryForm.nameEn} onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })} />
                <input className="input-field" placeholder="الاسم (عربي)" value={categoryForm.nameAr} onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })} />
                <select className="input-field" value={categoryForm.parentId} onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value })}>
                  <option value="">{t('rootCategory')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameEn} / {c.nameAr}</option>
                  ))}
                </select>
                <input className="input-field" placeholder={t('description')} value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={addCategory} className="btn-primary flex items-center gap-2"><Plus size={16} /> {t('add')}</button>
                  {selectedCategoryId && (
                    <button onClick={() => deleteCategory(selectedCategoryId)} className="btn-secondary text-red-600 flex items-center gap-2">
                      <Trash2 size={16} /> {t('delete')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-1">{t('knowledgeForAI')}</h2>
            <p className="text-sm text-slate-500 mb-4">{t('knowledgeForAIDesc')}</p>

            <select className="input-field mb-4" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameEn} / {c.nameAr}</option>
              ))}
            </select>

            <div className="space-y-3 mb-6 max-h-72 overflow-y-auto">
              {knowledgeItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">{t('noKnowledgeYet')}</p>
              ) : (
                knowledgeItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="badge bg-blue-50 text-blue-700 text-xs mb-1">{item.type}</span>
                        <p className="font-medium">{item.titleEn}</p>
                        <p className="text-sm text-slate-500">{item.titleAr}</p>
                        <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">{item.content}</p>
                      </div>
                      <button onClick={() => deleteKnowledge(item.id)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <p className="text-sm font-medium">{t('addKnowledge')}</p>
              <input className="input-field" placeholder="Title (English)" value={knowledgeForm.titleEn} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, titleEn: e.target.value })} />
              <input className="input-field" placeholder="العنوان (عربي)" value={knowledgeForm.titleAr} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, titleAr: e.target.value })} />
              <select className="input-field" value={knowledgeForm.type} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, type: e.target.value })}>
                <option value="QUESTION">Question</option>
                <option value="TOPIC">Topic</option>
                <option value="GUIDELINE">Guideline</option>
                <option value="TEACHING">Teaching</option>
              </select>
              <textarea className="input-field min-h-[100px]" placeholder={t('knowledgeContent')} value={knowledgeForm.content} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })} />
              <button onClick={addKnowledge} className="btn-primary flex items-center gap-2"><Plus size={16} /> {t('add')}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'site' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="text-primary" size={20} />
              <h2 className="font-semibold text-slate-900 dark:text-white">Partner Universities</h2>
              <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 ml-auto">{universities.length}</span>
              <button
                type="button"
                onClick={() => void loadSiteContent()}
                disabled={uniLoading}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary/40 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={15} className={uniLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {uniError && (
              <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {uniError}
              </div>
            )}

            {viewingUni && (
              <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">University Details</p>
                    <p className="font-semibold text-slate-900 dark:text-white mt-1">{viewingUni.nameEn}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{viewingUni.nameAr}</p>
                  </div>
                  <button type="button" onClick={() => setViewingUni(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Sort order</p>
                    <p className="font-medium">{viewingUni.sortOrder}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Visibility</p>
                    <p className="font-medium">{viewingUni.isActive ? 'Visible on site' : 'Hidden'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Logo URL</p>
                    <p className="font-medium break-all">{viewingUni.logoUrl || '—'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500">Website</p>
                    {viewingUni.website ? (
                      <a href={viewingUni.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline break-all">
                        {viewingUni.website} <ExternalLink size={13} />
                      </a>
                    ) : (
                      <p className="font-medium">—</p>
                    )}
                  </div>
                </div>
                {viewingUni.logoUrl && (
                  <img src={viewingUni.logoUrl} alt={viewingUni.nameEn} className="mt-3 h-12 object-contain" />
                )}
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => editUniversity(viewingUni)} className="btn-secondary text-xs py-1.5 px-3">
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteUniversity(viewingUni.id)} className="text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div className="table-scroll mb-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name (EN)</th>
                    <th>Name (AR)</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uniLoading ? (
                    <tr><td colSpan={6} className="text-center text-slate-400 py-8">Loading universities...</td></tr>
                  ) : universities.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-slate-400 py-8">No universities yet. Add one below or run db:seed.</td></tr>
                  ) : (
                    universities.map((uni, index) => (
                      <tr key={uni.id}>
                        <td className="text-slate-500">{index + 1}</td>
                        <td className="font-medium max-w-[140px] truncate" title={uni.nameEn}>{uni.nameEn}</td>
                        <td className="text-slate-600 dark:text-slate-300 max-w-[140px] truncate" title={uni.nameAr}>{uni.nameAr}</td>
                        <td>{uni.sortOrder}</td>
                        <td>
                          <span className={`badge text-xs ${uni.isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            {uni.isActive ? 'Visible' : 'Hidden'}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => viewUniversity(uni)} className="p-2 text-slate-500 hover:text-primary rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800" title="View">
                              <Eye size={15} />
                            </button>
                            <button type="button" onClick={() => editUniversity(uni)} className="p-2 text-slate-500 hover:text-primary rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800" title="Edit">
                              <Pencil size={15} />
                            </button>
                            <button type="button" onClick={() => deleteUniversity(uni.id)} className="p-2 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{editingUniId ? 'Edit University' : 'Add University'}</p>
                {(editingUniId || viewingUni) && (
                  <button onClick={resetUniForm} className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700">
                    <X size={14} /> Cancel
                  </button>
                )}
              </div>
              <input className="input-field" placeholder="Name (English)" value={uniForm.nameEn} onChange={(e) => setUniForm({ ...uniForm, nameEn: e.target.value })} />
              <input className="input-field" placeholder="الاسم (عربي)" value={uniForm.nameAr} onChange={(e) => setUniForm({ ...uniForm, nameAr: e.target.value })} />
              <input className="input-field" placeholder="Logo URL (optional)" value={uniForm.logoUrl} onChange={(e) => setUniForm({ ...uniForm, logoUrl: e.target.value })} />
              <input className="input-field" placeholder="Website URL (optional)" value={uniForm.website} onChange={(e) => setUniForm({ ...uniForm, website: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" className="input-field" placeholder="Sort order" value={uniForm.sortOrder} onChange={(e) => setUniForm({ ...uniForm, sortOrder: parseInt(e.target.value) || 0 })} />
                <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input type="checkbox" checked={uniForm.isActive} onChange={(e) => setUniForm({ ...uniForm, isActive: e.target.checked })} />
                  Visible on site
                </label>
              </div>
              <button onClick={() => void saveUniversity()} disabled={!uniForm.nameEn || !uniForm.nameAr || uniSaving} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> {uniSaving ? 'Saving...' : editingUniId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="text-primary" size={20} />
              <h2 className="font-semibold text-slate-900 dark:text-white">Footer & CTA</h2>
            </div>
            {siteSettings && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Footer tagline (EN)</label>
                  <input className="input-field" value={siteSettings.footerTaglineEn} onChange={(e) => setSiteSettings({ ...siteSettings, footerTaglineEn: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Footer tagline (AR)</label>
                  <input className="input-field" value={siteSettings.footerTaglineAr} onChange={(e) => setSiteSettings({ ...siteSettings, footerTaglineAr: e.target.value })} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Contact phone</label>
                    <input className="input-field" value={siteSettings.contactPhone} onChange={(e) => setSiteSettings({ ...siteSettings, contactPhone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Contact email</label>
                    <input className="input-field" value={siteSettings.contactEmail || ''} onChange={(e) => setSiteSettings({ ...siteSettings, contactEmail: e.target.value || null })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">CTA title (EN)</label>
                  <input className="input-field" value={siteSettings.ctaTitleEn} onChange={(e) => setSiteSettings({ ...siteSettings, ctaTitleEn: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">CTA title (AR)</label>
                  <input className="input-field" value={siteSettings.ctaTitleAr} onChange={(e) => setSiteSettings({ ...siteSettings, ctaTitleAr: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">CTA subtitle (EN)</label>
                  <input className="input-field" value={siteSettings.ctaSubtitleEn} onChange={(e) => setSiteSettings({ ...siteSettings, ctaSubtitleEn: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">CTA subtitle (AR)</label>
                  <input className="input-field" value={siteSettings.ctaSubtitleAr} onChange={(e) => setSiteSettings({ ...siteSettings, ctaSubtitleAr: e.target.value })} />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={saveSiteSettings} className="btn-primary">{t('save')}</button>
                  {siteSaved && <span className="text-sm text-emerald-600">Saved!</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
