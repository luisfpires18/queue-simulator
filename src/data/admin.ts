// Admin-only user listing (src/app/admin, gated by isAdminBattletag).
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type UserFilter = "all" | "hasCharacters" | "noCharacters";

export interface AdminUserRow {
  id: string;
  bnetId: string;
  battletag: string | null;
  createdAt: string;
  country: string | null;
  characterCount: number;
}

export async function listUsers({
  search, filter = "all", page, pageSize,
}: {
  search?: string;
  filter?: UserFilter;
  page: number;
  pageSize: number;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const where: Prisma.UserWhereInput = {};
  const q = search?.trim();
  if (q) {
    where.OR = [{ battletag: { contains: q } }, { bnetId: { contains: q } }];
  }
  if (filter === "hasCharacters") where.characters = { some: {} };
  if (filter === "noCharacters") where.characters = { none: {} };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { characters: true } } },
    }),
  ]);

  return {
    rows: users.map((u) => ({
      id: u.id,
      bnetId: u.bnetId,
      battletag: u.battletag,
      createdAt: u.createdAt.toISOString(),
      country: u.country,
      characterCount: u._count.characters,
    })),
    total,
  };
}
