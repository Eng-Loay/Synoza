import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Synoza database...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@synoza.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Synoza',
      lastName: 'Admin',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'student@synoza.com' },
    update: {},
    create: {
      email: 'student@synoza.com',
      passwordHash: await bcrypt.hash('Student@123456', 12),
      firstName: 'Mohamed',
      lastName: 'Ali',
      role: 'STUDENT',
      university: 'Cairo University',
      phone: '01024828652',
    },
  });

  const specialties = [
    { nameEn: 'Cardiology', nameAr: 'أمراض القلب', description: 'Cardiovascular clinical cases' },
    { nameEn: 'Internal Medicine', nameAr: 'الباطنة', description: 'General internal medicine' },
    { nameEn: 'Surgery', nameAr: 'الجراحة', description: 'Surgical cases' },
    { nameEn: 'Pediatrics', nameAr: 'طب الأطفال', description: 'Pediatric cases' },
    { nameEn: 'Obstetrics & Gynecology', nameAr: 'النساء والتوليد', description: 'OBGYN cases' },
  ];

  for (const s of specialties) {
    const existing = await prisma.specialty.findFirst({ where: { nameEn: s.nameEn } });
    if (!existing) await prisma.specialty.create({ data: s });
  }

  const difficulties = [
    { nameEn: 'Beginner', nameAr: 'مبتدئ', level: 1, color: '#22C55E' },
    { nameEn: 'Intermediate', nameAr: 'متوسط', level: 2, color: '#F59E0B' },
    { nameEn: 'Advanced', nameAr: 'متقدم', level: 3, color: '#EF4444' },
  ];

  for (const d of difficulties) {
    await prisma.difficultyLevel.upsert({
      where: { level: d.level },
      update: {},
      create: d,
    });
  }

  const internalMed = await prisma.knowledgeCategory.upsert({
    where: { id: 'seed-internal-med' },
    update: {},
    create: {
      id: 'seed-internal-med',
      nameEn: 'Internal Medicine',
      nameAr: 'الباطنة',
      description: 'General internal medicine OSCE stations',
      sortOrder: 1,
    },
  });

  const chest = await prisma.knowledgeCategory.upsert({
    where: { id: 'seed-chest' },
    update: {},
    create: {
      id: 'seed-chest',
      parentId: internalMed.id,
      nameEn: 'Chest / Cardiology',
      nameAr: 'الصدر / القلب',
      description: 'Cardiac and respiratory chest cases',
      sortOrder: 1,
    },
  });

  const existingKnowledge = await prisma.knowledgeItem.findFirst({
    where: { titleEn: 'Key history questions for chest pain' },
  });
  if (!existingKnowledge) {
    await prisma.knowledgeItem.createMany({
      data: [
        {
          categoryId: chest.id,
          titleEn: 'Key history questions for chest pain',
          titleAr: 'أسئلة مهمة لألم الصدر',
          content:
            'Ask about onset, character, radiation, associated dyspnea, palpitations, syncope, risk factors (smoking, family history), and exertional symptoms.',
          type: 'QUESTION',
        },
        {
          categoryId: chest.id,
          titleEn: 'Rheumatic heart disease teaching points',
          titleAr: 'نقاط تعليمية لمرض القلب الروماتيزمي',
          content:
            'Students should explore history of rheumatic fever, penicillin prophylaxis, murmur characteristics, and functional limitation.',
          type: 'TEACHING',
        },
      ],
    });
  }

  const cardiology = await prisma.specialty.findFirst({ where: { nameEn: 'Cardiology' } });
  const intermediate = await prisma.difficultyLevel.findFirst({ where: { level: 2 } });
  const beginner = await prisma.difficultyLevel.findFirst({ where: { level: 1 } });

  if (cardiology && intermediate) {
    const existingCase = await prisma.case.findFirst({
      where: { titleEn: 'AS + MR (Aortic Stenosis & Mitral Regurgitation)' },
    });

    const caseData = {
      titleEn: 'AS + MR (Aortic Stenosis & Mitral Regurgitation)',
      titleAr: 'تضيق أورطي + قصور mitral',
      specialtyId: cardiology.id,
      difficultyId: intermediate.id,
      categoryId: chest.id,
      patientName: 'Tarek Moustafa El-Haddad',
      patientAge: 17,
      patientGender: 'Male',
      patientNationality: 'Egyptian',
      chiefComplaint:
        'Progressive exertional dyspnea and occasional chest tightness for 6 months.',
      medicalHistory:
        'History of rheumatic fever at age 8. No diabetes or hypertension. No known allergies.',
      medicationHistory: 'Penicillin prophylaxis occasionally, not consistent.',
      surgicalHistory: 'No previous surgeries.',
      familyHistory: 'Mother has hypertension. No family history of congenital heart disease.',
      socialHistory: 'High school student. Non-smoker. No alcohol or drug use.',
      physicalExam:
        'Systolic murmur at right upper sternal border radiating to carotids. Displaced apex beat. Signs of left ventricular hypertrophy. Visible thoracotomy scar on left chest.',
      examImages: JSON.stringify([
        {
          url: '/exam/chest-inspection.svg',
          caption: 'Chest inspection — surgical scar and precordium',
          captionAr: 'الفحص البصري — scar جراحي ومنطقة القلب',
          maneuver: 'inspection',
        },
        {
          url: '/exam/chest-palpation.svg',
          caption: 'Palpation — apex beat and thrills',
          captionAr: 'الجس — نبض الذروة والـ thrills',
          maneuver: 'palpation',
        },
        {
          url: '/exam/chest-percussion.svg',
          caption: 'Percussion — heart borders',
          captionAr: 'النقر — حدود القلب',
          maneuver: 'percussion',
        },
        {
          url: '/exam/chest-auscultation.svg',
          caption: 'Auscultation — valve areas',
          captionAr: 'الاستماع — مناطق الصمامات',
          maneuver: 'auscultation',
        },
      ]),
      labResults: JSON.stringify({
        sections: [
          {
            title: 'ECG',
            titleAr: 'رسم القلب ECG',
            content: 'Sinus rhythm. Left ventricular hypertrophy. No acute ischemic changes.',
            contentAr: 'إيقاع sinus. تضخم ventricle أيسر. لا تغيرات ischemic حادة.',
          },
          {
            title: 'Echocardiography',
            titleAr: 'إيكو القلب',
            content:
              'Severe aortic stenosis (valve area ~0.8 cm²). Moderate mitral regurgitation. LV hypertrophy. Normal RV function.',
            contentAr:
              'تضيق aortic شديد. regurgitation mitral متوسط. hypertrophy ventricle أيسر. وظيفة ventricle أيمن طبيعية.',
          },
          {
            title: 'Chest X-ray',
            titleAr: 'أشعة الصدر',
            content: 'Cardiomegaly. Left ventricular prominence. No pulmonary edema.',
            contentAr: 'تضخم القلب. بروز ventricle أيسر. لا edema رئوي.',
          },
          {
            title: 'Blood tests',
            titleAr: 'تحاليل الدم',
            content: 'FBC, renal profile, and CRP within normal limits.',
            contentAr: 'صورة دم ووظائف كلى و CRP ضمن الحدود الطبيعية.',
          },
        ],
      }),
      finalDiagnosis: 'Combined Aortic Stenosis and Mitral Regurgitation (Rheumatic)',
      teachingPoints:
        'Recognize rheumatic heart disease presentation. Understand murmur characteristics. Know indications for intervention.',
      evaluationRubric:
        'Introduction (10%), Presenting complaint (15%), Systematic history (30%), Red flags (15%), Summary (10%), Professionalism (20%)',
      vitalSigns: JSON.stringify({
        bp: { value: '105/80 mmHg', note: 'Narrow pulse pressure' },
        hr: { value: '90 bpm', note: 'Regular, small volume/pulsus parvus' },
        temp: { value: '37.2 °C', note: '' },
        spo2: { value: '95%', note: 'Room air' },
      }),
      patientPersonality: 'Anxious teenager, cooperative but worried about sports participation.',
      scenarioPrompt:
        'You are a 17-year-old Egyptian male student worried about breathlessness during football practice.',
      isPublished: true,
    };

    if (!existingCase) {
      await prisma.case.create({ data: caseData });
    } else {
      await prisma.case.update({
        where: { id: existingCase.id },
        data: {
          categoryId: existingCase.categoryId || chest.id,
          physicalExam: caseData.physicalExam,
          examImages: caseData.examImages,
          labResults: caseData.labResults,
          vitalSigns: caseData.vitalSigns,
          teachingPoints: caseData.teachingPoints,
          evaluationRubric: caseData.evaluationRubric,
        },
      });
    }
  }

  if (cardiology && beginner) {
    const hfTitle = 'Acute Heart Failure — Dilated Cardiomyopathy';
    const existingHfCase = await prisma.case.findFirst({ where: { titleEn: hfTitle } });
    const hfCaseData = {
      titleEn: hfTitle,
      titleAr: 'قصور قلب حاد — dilated cardiomyopathy',
      specialtyId: cardiology.id,
      difficultyId: beginner.id,
      categoryId: chest.id,
      patientName: 'Samira Abdel Rahman',
      patientAge: 58,
      patientGender: 'Female',
      patientNationality: 'Egyptian',
      chiefComplaint:
        'Progressive shortness of breath and ankle swelling for 3 weeks, worse when lying flat.',
      medicalHistory:
        'Hypertension for 10 years. Type 2 diabetes. No known coronary artery disease. No rheumatic fever.',
      medicationHistory: 'Amlodipine 5mg daily, Metformin 500mg twice daily. Poor adherence reported.',
      surgicalHistory: 'No previous cardiac surgery.',
      familyHistory: 'Father died of heart failure at age 62. Sister has hypertension.',
      socialHistory: 'Retired teacher. Former smoker (quit 5 years ago). Sedentary lifestyle.',
      physicalExam:
        'Bilateral basal crepitations. Raised JVP. Bilateral pitting ankle edema. Displaced apex beat. S3 gallop. No murmur.',
      examImages: JSON.stringify([
        {
          url: '/exam/chest-inspection.svg',
          caption: 'Chest inspection — pulmonary congestion signs',
          captionAr: 'الفحص البصري — علامات احتقان رئوي',
          maneuver: 'inspection',
        },
        {
          url: '/exam/chest-palpation.svg',
          caption: 'Palpation — displaced apex and heave',
          captionAr: 'الجس — ذروة منزاحة',
          maneuver: 'palpation',
        },
        {
          url: '/exam/chest-percussion.svg',
          caption: 'Percussion — dullness at bases',
          captionAr: 'النقر — dullness عند القواعد',
          maneuver: 'percussion',
        },
        {
          url: '/exam/chest-auscultation.svg',
          caption: 'Auscultation — bibasal crepitations and S3',
          captionAr: 'الاستماع — crepitations + S3',
          maneuver: 'auscultation',
        },
      ]),
      labResults: JSON.stringify({
        sections: [
          {
            title: 'ECG',
            titleAr: 'رسم القلب ECG',
            content: 'Sinus tachycardia. Left bundle branch block. No acute ST changes.',
            contentAr: 'تسرع sinus. Left bundle branch block. لا تغيرات ST حادة.',
          },
          {
            title: 'Echocardiography',
            titleAr: 'إيكو القلب',
            content:
              'Severely reduced LV ejection fraction (~30%). Dilated left ventricle. Moderate functional mitral regurgitation.',
            contentAr: 'EF منخفض (~30%). dilatation ventricle أيسر. regurgitation mitral وظيفي.',
          },
          {
            title: 'Chest X-ray',
            titleAr: 'أشعة الصدر',
            content: 'Cardiomegaly. Pulmonary venous congestion. Kerley B lines. Small pleural effusions.',
            contentAr: 'تضخم القلب. احتقان وريدي رئوي. Kerley B lines.',
          },
          {
            title: 'Blood tests',
            titleAr: 'تحاليل الدم',
            content: 'BNP markedly elevated (980 pg/mL). Creatinine mildly elevated. HbA1c 8.2%.',
            contentAr: 'BNP مرتفع (980). كreatinine مرتفع قليلاً. HbA1c 8.2%.',
          },
        ],
      }),
      finalDiagnosis: 'Acute decompensated heart failure secondary to dilated cardiomyopathy',
      teachingPoints:
        'Recognize heart failure (dyspnea, orthopnea, PND, edema). Interpret BNP and echo. Know acute management with diuretics and afterload reduction.',
      evaluationRubric:
        'Introduction (10%), Presenting complaint (20%), Cardiac history (25%), Examination (20%), Diagnosis & management (15%), Professionalism (10%)',
      vitalSigns: JSON.stringify({
        bp: { value: '145/95 mmHg', note: 'Hypertensive' },
        hr: { value: '105 bpm', note: 'Tachycardia' },
        temp: { value: '36.8 °C', note: '' },
        spo2: { value: '91%', note: 'Room air' },
      }),
      patientPersonality:
        'Anxious older woman, breathless when speaking, cooperative but fatigued.',
      scenarioPrompt:
        'You are a 58-year-old Egyptian woman in the emergency clinic with breathlessness and swollen ankles for 3 weeks.',
      isPublished: true,
    };

    if (!existingHfCase) {
      await prisma.case.create({ data: hfCaseData });
      console.log('  + Case created: Acute Heart Failure');
    } else {
      await prisma.case.update({ where: { id: existingHfCase.id }, data: hfCaseData });
      console.log('  ~ Case updated: Acute Heart Failure');
    }
  }

  const aiProvider = process.env.AI_PROVIDER || 'openai';
  const aiModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const existingAI = await prisma.aISettings.findFirst();
  if (existingAI) {
    await prisma.aISettings.update({
      where: { id: existingAI.id },
      data: { provider: aiProvider, patientModel: aiModel, examinerModel: aiModel },
    });
  } else {
    await prisma.aISettings.create({
      data: { provider: aiProvider, patientModel: aiModel, examinerModel: aiModel },
    });
  }

  const universities = [
    'Misr University for Science and Technology',
    '6th October University',
    'Ain Shams University',
    'Al-Azhar University',
    'Benha University',
    'Cairo University',
    'Fayoum University',
    'Galala University',
    'Mansoura University',
    'MTI University',
    'Nahda University',
    'Alexandria University',
  ];

  const existingUniCount = await prisma.partnerUniversity.count();
  if (existingUniCount === 0) {
    await prisma.partnerUniversity.createMany({
      data: universities.map((name, i) => ({
        nameEn: name,
        nameAr: name,
        sortOrder: i,
        isActive: true,
      })),
    });
  }

  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  console.log('Seed completed!');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log('Student: student@synoza.com / Student@123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
