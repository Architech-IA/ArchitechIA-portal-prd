import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 0

export async function GET() {
  const [sprints, backlogCounts, epicCount] = await Promise.all([
    prisma.sprint.findMany({
      where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
      select: {
        sprintCode: true,
        name: true,
        status: true,
        items: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    prisma.backlogItem.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.epic.count({ where: { status: 'ACTIVE' } }),
  ])

  const todo        = backlogCounts.find(r => r.status === 'BACKLOG')?._count._all     ?? 0
  const in_progress = backlogCounts.find(r => r.status === 'IN_PROGRESS')?._count._all ?? 0
  const done_count  = backlogCounts.find(r => r.status === 'DONE')?._count._all         ?? 0

  const backlog = { todo, in_progress, done: done_count, total: todo + in_progress + done_count }

  const sprintsFormatted = sprints.map(s => ({
    code:   s.sprintCode ?? s.name.slice(0, 12),
    name:   s.name,
    status: s.status,
    done:   s.items.filter(t => t.status === 'DONE').length,
    total:  s.items.length,
  }))

  return NextResponse.json({
    sprints: sprintsFormatted,
    backlog,
    epics: { active: epicCount },
    ts: new Date().toISOString(),
  })
}
