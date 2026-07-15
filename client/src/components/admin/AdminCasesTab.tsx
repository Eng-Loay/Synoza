import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Trash2, Pencil, Upload, Save, X, ClipboardPaste, Music } from 'lucide-react';
import { AdminStickySaveBar } from './AdminStickySaveBar';
import api from '../../lib/api';
import { ALL_MANEUVERS, DEFAULT_STATION_CONFIG } from '../../lib/stationConfig';

type ManeuverId = 'inspection' | 'palpation' | 'percussion' | 'auscultation';
type MediaType = 'image' | 'video' | 'audio';

interface LookupRow {
  id: string;
  nameEn: string;
  nameAr?: string;
  level?: number;
}

interface CategoryRow {
  id: string;
  nameEn: string;
}

interface CaseListRow {
  id: string;
  titleEn: string;
  titleAr: string;
  patientName: string;
  isPublished: boolean;
  isFreeTier: boolean;
  specialty?: { nameEn: string };
  difficulty?: { nameEn: string };
}

interface VitalSignForm {
  bpValue: string;
  bpNote: string;
  hrValue: string;
  hrNote: string;
  rrValue: string;
  rrNote: string;
  tempValue: string;
  tempNote: string;
  spo2Value: string;
  spo2Note: string;
}

interface ExamImageForm {
  id: string;
  url: string;
  caption: string;
  captionAr: string;
  maneuver: ManeuverId | '';
  mediaType: MediaType;
}

interface LabSectionForm {
  id: string;
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
}

interface RubricItemForm {
  id: string;
  item: string;
  category: string;
}

interface ExaminerQuestionForm {
  id: string;
  question: string;
  sampleAnswer: string;
}

interface PhysicalExamForm {
  inspection: string;
  palpation: string;
  percussion: string;
  auscultation: string;
}

interface CaseFormPayload {
  titleEn: string;
  titleAr: string;
  specialtyId: string;
  difficultyId: string;
  categoryId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientNationality: string;
  chiefComplaint: string;
  medicalHistory: string;
  medicationHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  patientPersonality: string;
  scenarioPrompt: string;
  finalDiagnosis: string;
  teachingPoints: string;
  isPublished: boolean;
  isFreeTier: boolean;
  vitalSigns: VitalSignForm;
  physicalExam: PhysicalExamForm;
  examImages: ExamImageForm[];
  labSections: LabSectionForm[];
  rubricItems: RubricItemForm[];
  examinerQuestions: ExaminerQuestionForm[];
  stationConfig: {
    enabledManeuvers: ManeuverId[];
    enableHistoryExaminer: boolean;
  };
}

const MANEUVERS: Array<{ id: ManeuverId; label: string }> = [
  { id: 'inspection', label: 'Inspection' },
  { id: 'palpation', label: 'Palpation' },
  { id: 'percussion', label: 'Percussion' },
  { id: 'auscultation', label: 'Auscultation' },
];

const RUBRIC_CATEGORIES = ['History', 'Examination', 'Reasoning', 'Investigations', 'Management', 'Communication'];

const EMPTY_VITALS: VitalSignForm = {
  bpValue: '', bpNote: '', hrValue: '', hrNote: '', rrValue: '', rrNote: '',
  tempValue: '', tempNote: '', spo2Value: '', spo2Note: '',
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function emptyForm(specialtyId = '', difficultyId = '', categoryId = ''): CaseFormPayload {
  return {
    titleEn: '',
    titleAr: '',
    specialtyId,
    difficultyId,
    categoryId,
    patientName: '',
    patientAge: 30,
    patientGender: 'Male',
    patientNationality: 'Egyptian',
    chiefComplaint: '',
    medicalHistory: '',
    medicationHistory: '',
    surgicalHistory: '',
    familyHistory: '',
    socialHistory: '',
    patientPersonality: '',
    scenarioPrompt: '',
    finalDiagnosis: '',
    teachingPoints: '',
    isPublished: false,
    isFreeTier: false,
    vitalSigns: { ...EMPTY_VITALS },
    physicalExam: { inspection: '', palpation: '', percussion: '', auscultation: '' },
    examImages: [],
    labSections: [],
    rubricItems: [],
    examinerQuestions: [],
    stationConfig: {
      enabledManeuvers: [...ALL_MANEUVERS],
      enableHistoryExaminer: DEFAULT_STATION_CONFIG.enableHistoryExaminer,
    },
  };
}

function fileToBase64(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 40));
      }
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read-failed'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('read-failed'));
        return;
      }
      onProgress?.(40);
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

function mediaTypeFromFile(file: File): MediaType {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}

function MediaThumbnail({ url, mediaType }: { url: string; mediaType: MediaType }) {
  if (!url) return null;
  if (mediaType === 'image') {
    return (
      <img
        src={url}
        alt=""
        className="h-28 w-full max-w-xs object-cover rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
      />
    );
  }
  if (mediaType === 'video') {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-28 w-full max-w-xs object-cover rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900"
      />
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 max-w-xs">
      <Music size={20} className="text-violet-600 shrink-0" />
      <audio src={url} controls preload="metadata" className="w-full min-w-0 h-8" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      {children}
    </div>
  );
}

export function AdminCasesTab() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseListRow[]>([]);
  const [specialties, setSpecialties] = useState<LookupRow[]>([]);
  const [difficulties, setDifficulties] = useState<LookupRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CaseFormPayload>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [importSource, setImportSource] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');

  const loadLookups = useCallback(async () => {
    const [specRes, diffRes, catRes] = await Promise.all([
      api.get('/cases/specialties'),
      api.get('/cases/difficulties'),
      api.get('/admin/categories'),
    ]);
    const specs = specRes.data.specialties as LookupRow[];
    const diffs = diffRes.data.difficulties as LookupRow[];
    const cats = catRes.data.categories as CategoryRow[];
    setSpecialties(specs);
    setDifficulties(diffs);
    setCategories(cats);
    return { specs, diffs, cats };
  }, []);

  const loadCases = useCallback(async () => {
    const r = await api.get('/admin/cases');
    setCases(r.data.cases);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadCases(), loadLookups()]);
    } catch {
      setError(t('adminCaseLoadError'));
    } finally {
      setLoading(false);
    }
  }, [loadCases, loadLookups, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startCreate = async () => {
    const { specs, diffs, cats } = await loadLookups();
    setEditingId('new');
    setForm(emptyForm(specs[0]?.id ?? '', diffs[0]?.id ?? '', cats[0]?.id ?? ''));
    setError('');
  };

  const startEdit = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/admin/cases/${id}`);
      setEditingId(id);
      setForm(r.data.form as CaseFormPayload);
    } catch {
      setError(t('adminCaseLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setUploadProgress({});
  };

  const saveCase = async () => {
    if (!form.titleEn.trim() || !form.specialtyId || !form.difficultyId) {
      setError(t('adminCaseRequiredFields'));
      return;
    }
    if (form.stationConfig.enabledManeuvers.length === 0) {
      setError(t('adminCaseManeuverRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId === 'new') {
        const r = await api.post('/admin/cases', form);
        setEditingId(r.data.case.id as string);
        setForm(r.data.form as CaseFormPayload);
      } else if (editingId) {
        const r = await api.put(`/admin/cases/${editingId}`, form);
        setForm(r.data.form as CaseFormPayload);
      }
      await loadCases();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || t('adminCaseSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteCase = async (id: string) => {
    if (!window.confirm(t('adminCaseDeleteConfirm'))) return;
    await api.delete(`/admin/cases/${id}`);
    if (editingId === id) cancelEdit();
    await loadCases();
  };

  const uploadMedia = async (imageId: string, file: File) => {
    setError('');
    setUploadProgress((prev) => ({ ...prev, [imageId]: 1 }));
    const detectedType = mediaTypeFromFile(file);
    setForm((prev) => ({
      ...prev,
      examImages: prev.examImages.map((img) =>
        img.id === imageId ? { ...img, mediaType: detectedType } : img,
      ),
    }));
    try {
      const dataBase64 = await fileToBase64(file, (pct) => {
        setUploadProgress((prev) => ({ ...prev, [imageId]: pct }));
      });
      const r = await api.post(
        '/admin/cases/media/upload',
        {
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
          caseSlug: form.titleEn.trim() || 'draft',
        },
        {
          timeout: 120_000,
          onUploadProgress: (event) => {
            if (!event.total) return;
            const pct = 40 + Math.round((event.loaded / event.total) * 60);
            setUploadProgress((prev) => ({ ...prev, [imageId]: Math.min(pct, 99) }));
          },
        },
      );
      setForm((prev) => ({
        ...prev,
        examImages: prev.examImages.map((img) =>
          img.id === imageId
            ? { ...img, url: r.data.url as string, mediaType: detectedType }
            : img,
        ),
      }));
      setUploadProgress((prev) => ({ ...prev, [imageId]: 100 }));
      window.setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[imageId];
          return next;
        });
      }, 600);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || t('adminCaseUploadError'));
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[imageId];
        return next;
      });
    }
  };

  const updateVital = (key: keyof VitalSignForm, value: string) => {
    setForm((prev) => ({ ...prev, vitalSigns: { ...prev.vitalSigns, [key]: value } }));
  };

  const importCaseObject = async () => {
    setImportMessage('');
    setImportError('');
    try {
      const r = await api.post('/admin/cases/import/parse', { source: importSource });
      const mapped = r.data.form as CaseFormPayload;
      setForm((prev) => ({
        ...prev,
        ...mapped,
        titleAr: prev.titleAr.trim() ? prev.titleAr : mapped.titleAr,
        isPublished: prev.isPublished,
        isFreeTier: prev.isFreeTier,
      }));
      setImportMessage(t('adminCaseImportSuccess'));
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setImportError(msg || t('adminCaseImportError'));
    }
  };

  if (editingId) {
    return (
      <div className="space-y-4 pb-2">
        <div className="sticky top-0 z-20 -mx-1 px-1 py-3 mb-2 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingId === 'new' ? t('adminCaseAdd') : t('adminCaseEdit')}
            </h2>
            <p className="text-sm text-slate-500">{t('adminCaseEditorDesc')}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-2">
              <X size={16} /> {t('cancel')}
            </button>
            <button type="button" onClick={saveCase} disabled={saving} className="btn-primary inline-flex items-center gap-2">
              <Save size={16} /> {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Section title={t('adminCaseSectionImport')}>
          <p className="text-sm text-slate-500">{t('adminCaseImportDesc')}</p>
          <textarea
            className="input-field min-h-[220px] font-mono text-xs"
            placeholder={t('adminCaseImportPlaceholder')}
            value={importSource}
            onChange={(e) => setImportSource(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={importCaseObject} className="btn-secondary inline-flex items-center gap-2">
              <ClipboardPaste size={16} /> {t('adminCaseImportFill')}
            </button>
            {importMessage && <p className="text-sm text-emerald-600">{importMessage}</p>}
            {importError && <p className="text-sm text-red-600">{importError}</p>}
          </div>
        </Section>

        <Section title={t('adminCaseSectionBasics')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input-field" placeholder={t('adminCaseTitleEn')} value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
            <input className="input-field" placeholder={t('adminCaseTitleAr')} value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} />
            <select className="input-field" value={form.specialtyId} onChange={(e) => setForm({ ...form, specialtyId: e.target.value })}>
              {specialties.map((s) => <option key={s.id} value={s.id}>{s.nameEn}</option>)}
            </select>
            <select className="input-field" value={form.difficultyId} onChange={(e) => setForm({ ...form, difficultyId: e.target.value })}>
              {difficulties.map((d) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
            </select>
            <select className="input-field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">{t('adminCaseNoCategory')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> {t('adminCasePublished')}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFreeTier} onChange={(e) => setForm({ ...form, isFreeTier: e.target.checked })} /> {t('adminCaseFreeTier')}</label>
            </div>
          </div>
        </Section>

        <Section title={t('adminCaseSectionPatient')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input-field" placeholder={t('adminCasePatientName')} value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
            <input type="number" className="input-field" placeholder={t('adminCasePatientAge')} value={form.patientAge} onChange={(e) => setForm({ ...form, patientAge: Number(e.target.value) })} />
            <input className="input-field" placeholder={t('adminCasePatientGender')} value={form.patientGender} onChange={(e) => setForm({ ...form, patientGender: e.target.value })} />
            <input className="input-field" placeholder={t('adminCasePatientNationality')} value={form.patientNationality} onChange={(e) => setForm({ ...form, patientNationality: e.target.value })} />
            <textarea className="input-field sm:col-span-2 min-h-[80px]" placeholder={t('adminCaseChiefComplaint')} value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} />
          </div>
        </Section>

        <Section title={t('adminCaseSectionHistory')}>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ['medicalHistory', t('adminCaseMedicalHistory')],
              ['medicationHistory', t('adminCaseMedicationHistory')],
              ['surgicalHistory', t('adminCaseSurgicalHistory')],
              ['familyHistory', t('adminCaseFamilyHistory')],
              ['socialHistory', t('adminCaseSocialHistory')],
            ] as const).map(([key, label]) => (
              <textarea
                key={key}
                className="input-field min-h-[100px]"
                placeholder={label}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ))}
          </div>
        </Section>

        <Section title={t('adminCaseSectionVitals')}>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ['bp', 'BP'],
              ['hr', 'HR'],
              ['rr', 'RR'],
              ['temp', t('adminCaseTemp')],
              ['spo2', 'SpO₂'],
            ] as const).map(([code, label]) => {
              const valueKey = `${code}Value` as keyof VitalSignForm;
              const noteKey = `${code}Note` as keyof VitalSignForm;
              return (
                <div key={code} className="grid grid-cols-2 gap-2">
                  <input className="input-field" placeholder={`${label} ${t('adminCaseValue')}`} value={form.vitalSigns[valueKey]} onChange={(e) => updateVital(valueKey, e.target.value)} />
                  <input className="input-field" placeholder={`${label} ${t('adminCaseNote')}`} value={form.vitalSigns[noteKey]} onChange={(e) => updateVital(noteKey, e.target.value)} />
                </div>
              );
            })}
          </div>
        </Section>

        <Section title={t('adminCaseSectionStation')}>
          <p className="text-sm text-slate-500 mb-3">{t('adminCaseStationDesc')}</p>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {t('adminCaseEnabledManeuvers')}
              </p>
              <div className="flex flex-wrap gap-3">
                {MANEUVERS.map((maneuver) => {
                  const checked = form.stationConfig.enabledManeuvers.includes(maneuver.id);
                  return (
                    <label
                      key={maneuver.id}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                        checked
                          ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const enabled = e.target.checked
                            ? [...form.stationConfig.enabledManeuvers, maneuver.id]
                            : form.stationConfig.enabledManeuvers.filter((id) => id !== maneuver.id);
                          setForm({
                            ...form,
                            stationConfig: { ...form.stationConfig, enabledManeuvers: enabled },
                          });
                        }}
                      />
                      <span className="text-sm">{maneuver.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.stationConfig.enableHistoryExaminer}
                onChange={(e) => setForm({
                  ...form,
                  stationConfig: {
                    ...form.stationConfig,
                    enableHistoryExaminer: e.target.checked,
                  },
                })}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t('adminCaseEnableHistoryExaminer')}
              </span>
            </label>
            <p className="text-xs text-slate-500">{t('adminCaseEnableHistoryExaminerHint')}</p>
          </div>
        </Section>

        <Section title={t('adminCaseSectionPhysicalExam')}>
          <div className="grid sm:grid-cols-2 gap-3">
            {MANEUVERS.map((maneuver) => (
              <textarea
                key={maneuver.id}
                className="input-field min-h-[110px]"
                placeholder={maneuver.label}
                value={form.physicalExam[maneuver.id]}
                onChange={(e) => setForm({
                  ...form,
                  physicalExam: { ...form.physicalExam, [maneuver.id]: e.target.value },
                })}
              />
            ))}
          </div>
        </Section>

        <Section title={t('adminCaseSectionMedia')}>
          <div className="space-y-4">
            {form.examImages.map((img) => {
              const progress = uploadProgress[img.id];
              const isUploading = typeof progress === 'number';
              return (
              <div key={img.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className="input-field sm:col-span-2" placeholder={t('adminCaseMediaUrl')} value={img.url} onChange={(e) => setForm({
                    ...form,
                    examImages: form.examImages.map((row) => row.id === img.id ? { ...row, url: e.target.value } : row),
                  })} />
                  <select className="input-field" value={img.maneuver} onChange={(e) => setForm({
                    ...form,
                    examImages: form.examImages.map((row) => row.id === img.id ? { ...row, maneuver: e.target.value as ManeuverId | '' } : row),
                  })}>
                    <option value="">{t('adminCaseMediaNoManeuver')}</option>
                    {MANEUVERS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <select className="input-field" value={img.mediaType} onChange={(e) => setForm({
                    ...form,
                    examImages: form.examImages.map((row) => row.id === img.id ? { ...row, mediaType: e.target.value as MediaType } : row),
                  })}>
                    <option value="image">{t('adminCaseMediaImage')}</option>
                    <option value="video">{t('adminCaseMediaVideo')}</option>
                    <option value="audio">{t('adminCaseMediaAudio')}</option>
                  </select>
                  <input className="input-field" placeholder={t('adminCaseMediaCaptionEn')} value={img.caption} onChange={(e) => setForm({
                    ...form,
                    examImages: form.examImages.map((row) => row.id === img.id ? { ...row, caption: e.target.value } : row),
                  })} />
                  <input className="input-field" placeholder={t('adminCaseMediaCaptionAr')} value={img.captionAr} onChange={(e) => setForm({
                    ...form,
                    examImages: form.examImages.map((row) => row.id === img.id ? { ...row, captionAr: e.target.value } : row),
                  })} />
                </div>
                {img.url && !isUploading && (
                  <div className="space-y-1">
                    <MediaThumbnail url={img.url} mediaType={img.mediaType} />
                    <a href={img.url} target="_blank" rel="noreferrer" className="text-sm text-violet-600 hover:underline inline-block">
                      {t('adminCasePreviewMedia')}
                    </a>
                  </div>
                )}
                {isUploading && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{t('adminCaseUploading')}</span>
                      <span>{progress}%</span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-violet-600 transition-[width] duration-200 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`btn-secondary inline-flex items-center gap-2 ${isUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                    <Upload size={16} />
                    {isUploading ? t('adminCaseUploading') : t('adminCaseUploadFile')}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadMedia(img.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button type="button" className="text-red-600 text-sm ms-auto" onClick={() => setForm({
                    ...form,
                    examImages: form.examImages.filter((row) => row.id !== img.id),
                  })}>
                    <Trash2 size={14} className="inline" /> {t('delete')}
                  </button>
                </div>
              </div>
              );
            })}
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setForm({
                ...form,
                examImages: [...form.examImages, { id: newId('media'), url: '', caption: '', captionAr: '', maneuver: '', mediaType: 'image' }],
              })}
            >
              <Plus size={16} /> {t('adminCaseAddMedia')}
            </button>
          </div>
        </Section>

        <Section title={t('adminCaseSectionLabs')}>
          <div className="space-y-4">
            {form.labSections.map((section) => (
              <div key={section.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className="input-field" placeholder={t('adminCaseLabTitleEn')} value={section.title} onChange={(e) => setForm({
                    ...form,
                    labSections: form.labSections.map((row) => row.id === section.id ? { ...row, title: e.target.value } : row),
                  })} />
                  <input className="input-field" placeholder={t('adminCaseLabTitleAr')} value={section.titleAr} onChange={(e) => setForm({
                    ...form,
                    labSections: form.labSections.map((row) => row.id === section.id ? { ...row, titleAr: e.target.value } : row),
                  })} />
                  <textarea className="input-field min-h-[90px]" placeholder={t('adminCaseLabContentEn')} value={section.content} onChange={(e) => setForm({
                    ...form,
                    labSections: form.labSections.map((row) => row.id === section.id ? { ...row, content: e.target.value } : row),
                  })} />
                  <textarea className="input-field min-h-[90px]" placeholder={t('adminCaseLabContentAr')} value={section.contentAr} onChange={(e) => setForm({
                    ...form,
                    labSections: form.labSections.map((row) => row.id === section.id ? { ...row, contentAr: e.target.value } : row),
                  })} />
                </div>
                <button type="button" className="text-red-600 text-sm" onClick={() => setForm({
                  ...form,
                  labSections: form.labSections.filter((row) => row.id !== section.id),
                })}>
                  <Trash2 size={14} className="inline" /> {t('delete')}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setForm({
                ...form,
                labSections: [...form.labSections, { id: newId('lab'), title: '', titleAr: '', content: '', contentAr: '' }],
              })}
            >
              <Plus size={16} /> {t('adminCaseAddLabSection')}
            </button>
          </div>
        </Section>

        <Section title={t('adminCaseSectionRubric')}>
          <div className="space-y-3">
            {form.rubricItems.map((item) => (
              <div key={item.id} className="grid sm:grid-cols-[1fr_180px_auto] gap-2 items-start">
                <input className="input-field" placeholder={t('adminCaseRubricItem')} value={item.item} onChange={(e) => setForm({
                  ...form,
                  rubricItems: form.rubricItems.map((row) => row.id === item.id ? { ...row, item: e.target.value } : row),
                })} />
                <select className="input-field" value={item.category} onChange={(e) => setForm({
                  ...form,
                  rubricItems: form.rubricItems.map((row) => row.id === item.id ? { ...row, category: e.target.value } : row),
                })}>
                  {RUBRIC_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button type="button" className="text-red-600 p-2" onClick={() => setForm({
                  ...form,
                  rubricItems: form.rubricItems.filter((row) => row.id !== item.id),
                })}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setForm({
                ...form,
                rubricItems: [...form.rubricItems, { id: newId('rubric'), item: '', category: 'History' }],
              })}
            >
              <Plus size={16} /> {t('adminCaseAddRubricItem')}
            </button>
          </div>
        </Section>

        <Section title={t('adminCaseSectionExaminerQuestions')}>
          <p className="text-sm text-slate-500">{t('adminCaseExaminerQuestionsDesc')}</p>
          <div className="space-y-4">
            {form.examinerQuestions.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <textarea
                  className="input-field min-h-[70px]"
                  placeholder={t('adminCaseExaminerQuestion')}
                  value={row.question}
                  onChange={(e) => setForm({
                    ...form,
                    examinerQuestions: form.examinerQuestions.map((q) =>
                      q.id === row.id ? { ...q, question: e.target.value } : q,
                    ),
                  })}
                />
                <textarea
                  className="input-field min-h-[90px]"
                  placeholder={t('adminCaseExaminerSampleAnswer')}
                  value={row.sampleAnswer}
                  onChange={(e) => setForm({
                    ...form,
                    examinerQuestions: form.examinerQuestions.map((q) =>
                      q.id === row.id ? { ...q, sampleAnswer: e.target.value } : q,
                    ),
                  })}
                />
                <button
                  type="button"
                  className="text-red-600 text-sm"
                  onClick={() => setForm({
                    ...form,
                    examinerQuestions: form.examinerQuestions.filter((q) => q.id !== row.id),
                  })}
                >
                  <Trash2 size={14} className="inline" /> {t('delete')}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setForm({
                ...form,
                examinerQuestions: [
                  ...form.examinerQuestions,
                  { id: newId('viva'), question: '', sampleAnswer: '' },
                ],
              })}
            >
              <Plus size={16} /> {t('adminCaseAddExaminerQuestion')}
            </button>
          </div>
        </Section>

        <Section title={t('adminCaseSectionAi')}>
          <div className="space-y-3">
            <textarea className="input-field min-h-[100px]" placeholder={t('adminCasePersonality')} value={form.patientPersonality} onChange={(e) => setForm({ ...form, patientPersonality: e.target.value })} />
            <textarea className="input-field min-h-[180px]" placeholder={t('adminCaseScenarioPrompt')} value={form.scenarioPrompt} onChange={(e) => setForm({ ...form, scenarioPrompt: e.target.value })} />
            <input className="input-field" placeholder={t('adminCaseFinalDiagnosis')} value={form.finalDiagnosis} onChange={(e) => setForm({ ...form, finalDiagnosis: e.target.value })} />
            <textarea className="input-field min-h-[100px]" placeholder={t('adminCaseTeachingPoints')} value={form.teachingPoints} onChange={(e) => setForm({ ...form, teachingPoints: e.target.value })} />
          </div>
        </Section>

        <AdminStickySaveBar
          onSave={() => void saveCase()}
          onCancel={cancelEdit}
          saving={saving}
          disabled={!form.titleEn.trim() || !form.specialtyId || !form.difficultyId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('adminCaseTitle')}</h2>
          <p className="text-sm text-slate-500">{t('adminCaseListDesc')}</p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> {t('adminCaseAdd')}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}

      <div className="grid gap-3">
        {cases.map((c) => (
          <div key={c.id} className="card card-interactive p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                <FileText className="text-violet-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{c.titleEn}</p>
                <p className="text-sm text-slate-500">{c.patientName} · {c.specialty?.nameEn} · {c.difficulty?.nameEn}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${c.isPublished ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {c.isPublished ? t('adminCasePublished') : t('adminCaseDraft')}
              </span>
              {c.isFreeTier && <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700">{t('adminCaseFreeTier')}</span>}
              <button type="button" className="text-violet-600 p-2" onClick={() => void startEdit(c.id)} aria-label={t('edit')}>
                <Pencil size={16} />
              </button>
              <button type="button" className="text-red-600 p-2" onClick={() => void deleteCase(c.id)} aria-label={t('delete')}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
