import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ObsidianNode {
  id: number;
  path: string;
  title: string;
  folder: string;
  updated_at: string;
}

interface ObsidianLink {
  source_path: string;
  target_title: string;
  target_path: string | null;
}

export async function GET() {
  const [nodes, links] = await Promise.all([
    prisma.$queryRaw<ObsidianNode[]>`SELECT id, path, title, folder, updated_at FROM obsidian_nodes ORDER BY folder, title`,
    prisma.$queryRaw<ObsidianLink[]>`SELECT source_path, target_title, target_path FROM obsidian_links WHERE target_path IS NOT NULL`,
  ]);

  return NextResponse.json({ nodes, links });
}
