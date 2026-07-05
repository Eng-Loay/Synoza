import { prisma } from '../lib/prisma.js';

export async function getCategoryKnowledgeContext(categoryId: string | null | undefined): Promise<string> {
  if (!categoryId) return '';

  const categoryIds: string[] = [];
  let currentId: string | null = categoryId;

  while (currentId) {
    const cat: { parentId: string | null; isActive: boolean } | null = await prisma.knowledgeCategory.findUnique({
      where: { id: currentId },
      select: { parentId: true, isActive: true },
    });
    if (!cat) break;
    if (cat.isActive) categoryIds.push(currentId);
    currentId = cat.parentId ?? null;
  }

  if (categoryIds.length === 0) return '';

  const items = await prisma.knowledgeItem.findMany({
    where: { categoryId: { in: categoryIds }, isActive: true },
    orderBy: { createdAt: 'asc' },
    include: { category: { select: { nameEn: true, nameAr: true } } },
  });

  if (items.length === 0) return '';

  const lines = items.map(
    (item) =>
      `[${item.category.nameEn} | ${item.type}] ${item.titleEn}: ${item.content}\n(Arabic: ${item.titleAr} — ${item.content})`
  );

  return `\n\nDOMAIN KNOWLEDGE (use to guide realistic responses and evaluation — do NOT reveal answers directly to the student):\n${lines.join('\n\n')}`;
}
