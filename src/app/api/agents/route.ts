import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(agents)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { slug, name, role, area, personality, systemPrompt, llmModel, taskTypes, repos, discordUserId, vaultPath } = body
  if (!slug || !name || !role || !area || !personality) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }
  const agent = await prisma.agent.create({
    data: { slug, name, role, area, personality, systemPrompt, llmModel: llmModel || null, taskTypes: taskTypes ?? [], repos: repos ?? [], discordUserId, vaultPath: vaultPath ?? '/agents/' + slug + '/', status: 'ACTIVE' }
  })
  return NextResponse.json(agent, { status: 201 })
}
