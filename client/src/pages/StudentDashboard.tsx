import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Play, BarChart3, ClipboardList, ChevronRight, FolderOpen, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

interface Case {
  id: string;
  titleEn: string;
  titleAr: string;
  patientName: string;
  specialty: { nameEn: string; nameAr: string };
  difficulty: { nameEn: string; nameAr: string; color: string };
  category?: { nameEn: string; nameAr: string } | null;
}

interface CategoryNode {
  id: string;
  nameEn: string;
  nameAr: string;
  description?: string | null;
  children: CategoryNode[];
  _count?: { cases: number; children: number };
}

interface CategoryDetail {
  id: string;
  nameEn: string;
  nameAr: string;
  parent?: { id: string; nameEn: string; nameAr: string; parentId: string | null } | null;
  children: Array<CategoryNode & { _count?: { cases: number; children: number } }>;
  _count?: { cases: number };
}

interface Stats {
  totalSessions: number;
  completedStations: number;
  averageScore: number;
}

export default function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';

  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [rootCategories, setRootCategories] = useState<CategoryNode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetail | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; nameEn: string; nameAr: string }>>([]);

  useEffect(() => {
    api.get('/categories').then((r) => setRootCategories(r.data.categories));
  }, []);

  useEffect(() => {
    setLoading(true);
    const categoryId = selectedCategory?.id;
    Promise.all([
      api.get('/cases', { params: { search, ...(categoryId ? { categoryId } : {}) } }),
      api.get('/student/overview'),
    ])
      .then(([casesRes, statsRes]) => {
        setCases(casesRes.data.cases);
        setStats(statsRes.data.stats);
      })
      .finally(() => setLoading(false));
  }, [search, selectedCategory?.id]);

  const openCategory = async (id: string, fromRoot = false) => {
    const res = await api.get(`/categories/${id}`);
    const category: CategoryDetail = res.data.category;
    setSelectedCategory(category);

    setBreadcrumb((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === id);
      if (existingIndex >= 0) return prev.slice(0, existingIndex + 1);
      const next = { id: category.id, nameEn: category.nameEn, nameAr: category.nameAr };
      return fromRoot ? [next] : [...prev, next];
    });
  };

  const goBack = () => {
    if (breadcrumb.length <= 1) {
      setSelectedCategory(null);
      setBreadcrumb([]);
      return;
    }
    const newCrumbs = breadcrumb.slice(0, -1);
    setBreadcrumb(newCrumbs);
    openCategory(newCrumbs[newCrumbs.length - 1].id);
  };

  const startStation = async (caseId: string) => {
    const res = await api.post('/sessions/start', { caseId, language: isAr ? 'AR' : 'EN' });
    navigate(`/simulation/${res.data.session.id}`);
  };

  const visibleCategories = selectedCategory ? selectedCategory.children : rootCategories;
  const showCases = selectedCategory !== null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('welcomeBack')}, {user?.firstName}!
          </h1>
          <p className="text-slate-500 mt-1">{t('chooseExamArea')}</p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: t('totalSessions'), value: stats.totalSessions, icon: ClipboardList, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300' },
              { label: t('completedStations'), value: stats.completedStations, icon: BarChart3, color: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300' },
              { label: t('avgScore'), value: `${stats.averageScore}%`, icon: BarChart3, color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon size={22} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {selectedCategory && (
            <button onClick={goBack} className="btn-secondary flex items-center gap-2 justify-center sm:w-auto">
              <ArrowLeft size={18} /> {t('back')}
            </button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input-field !pl-11 w-full"
              placeholder={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {breadcrumb.length > 0 && (
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mb-6">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setBreadcrumb([]);
              }}
              className="hover:text-primary"
            >
              {t('departments')}
            </button>
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-2">
                <ChevronRight size={14} />
                {i === breadcrumb.length - 1 ? (
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {isAr ? crumb.nameAr : crumb.nameEn}
                  </span>
                ) : (
                  <button type="button" onClick={() => openCategory(crumb.id)} className="hover:text-primary">
                    {isAr ? crumb.nameAr : crumb.nameEn}
                  </button>
                )}
              </span>
            ))}
          </nav>
        )}

        {!selectedCategory && (
          <div className="card p-5 sm:p-6 mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-cyan-500/5">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-3">{t('howToStart')}</h2>
            <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
              <li>{t('howToStartStep1')}</li>
              <li>{t('howToStartStep2')}</li>
              <li>{t('howToStartStep3')}</li>
            </ol>
          </div>
        )}

        {!selectedCategory && !loading && cases.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">{t('quickStart')}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {cases.slice(0, 6).map((c) => (
                <div key={c.id} className="card p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <span className="badge text-white" style={{ backgroundColor: c.difficulty.color }}>
                      {isAr ? c.difficulty.nameAr : c.difficulty.nameEn}
                    </span>
                    <span className="text-xs text-slate-500">{isAr ? c.specialty.nameAr : c.specialty.nameEn}</span>
                  </div>
                  <h3 className="font-semibold mb-1 text-slate-900 dark:text-white">
                    {isAr ? c.titleAr : c.titleEn}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">{c.patientName}</p>
                  <button
                    onClick={() => startStation(c.id)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Play size={16} /> {t('startStation')}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {!selectedCategory && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">{t('departments')}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {rootCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => openCategory(cat.id, true)}
                  className="card p-5 text-left hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <FolderOpen className="text-primary" size={22} />
                    </div>
                    <ChevronRight className="text-slate-400 group-hover:text-primary" size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{isAr ? cat.nameAr : cat.nameEn}</h3>
                  {cat.description && <p className="text-sm text-slate-500 mt-1">{cat.description}</p>}
                  <p className="text-xs text-slate-400 mt-2">
                    {(cat._count?.children ?? cat.children.length) > 0
                      ? `${cat._count?.children ?? cat.children.length} ${t('subcategories')}`
                      : t('openCategory')}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {selectedCategory && visibleCategories.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">{t('subcategories')}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => openCategory(cat.id)}
                  className="card p-5 text-left hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-3">
                      <FolderOpen className="text-violet-600" size={22} />
                    </div>
                    <ChevronRight className="text-slate-400 group-hover:text-primary" size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{isAr ? cat.nameAr : cat.nameEn}</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    {(cat._count?.cases ?? 0) > 0
                      ? `${cat._count?.cases} ${t('stations')}`
                      : (cat._count?.children ?? 0) > 0
                        ? `${cat._count?.children} ${t('subcategories')}`
                        : t('openCategory')}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {showCases && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
              {t('stations')} — {isAr ? selectedCategory!.nameAr : selectedCategory!.nameEn}
            </h2>
            {loading ? (
              <p className="text-slate-500">{t('loading')}</p>
            ) : cases.length === 0 ? (
              <div className="card p-8 text-center text-slate-500">{t('noStationsInCategory')}</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {cases.map((c) => (
                  <div key={c.id} className="card p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <span className="badge text-white" style={{ backgroundColor: c.difficulty.color }}>
                        {isAr ? c.difficulty.nameAr : c.difficulty.nameEn}
                      </span>
                      <span className="text-xs text-slate-500">{isAr ? c.specialty.nameAr : c.specialty.nameEn}</span>
                    </div>
                    <h3 className="font-semibold mb-1 text-slate-900 dark:text-white">
                      {isAr ? c.titleAr : c.titleEn}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">{c.patientName}</p>
                    <button
                      onClick={() => startStation(c.id)}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <Play size={16} /> {t('startStation')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-4 mt-4">
          <Link to="/student/results" className="text-sm text-primary hover:underline">
            {t('myResults')}
          </Link>
          <Link to="/student/profile" className="text-sm text-primary hover:underline">
            {t('profile')}
          </Link>
        </div>
      </div>
    </div>
  );
}
