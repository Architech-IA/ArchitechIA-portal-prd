import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, rm } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const OFFICE_EXT: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
}

function getMimeFromDataUrl(url: string): string {
  if (!url.startsWith('data:')) return ''
  return url.slice(5, url.indexOf(';'))
}

async function convertToPdfPreview(dataUrl: string, mime: string): Promise<string | null> {
  const ext = OFFICE_EXT[mime]
  if (!ext) return null

  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const workDir = path.join(os.tmpdir(), `docprev_${randomUUID()}`)
  const profileDir = path.join(os.tmpdir(), `loprofile_${randomUUID()}`)
  const inputFile = path.join(workDir, `input.${ext}`)

  try {
    await execAsync(`mkdir -p ${workDir}`)
    await writeFile(inputFile, Buffer.from(base64, 'base64'))
    await execAsync(
      `soffice --headless --convert-to pdf --outdir ${workDir} -env:UserInstallation=file://${profileDir} ${inputFile}`,
      { timeout: 45_000 }
    )
    const pdfPath = path.join(workDir, 'input.pdf')
    const pdfBuffer = await readFile(pdfPath)
    return `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
  } catch {
    return null
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
    await rm(profileDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params
  const stage = req.nextUrl.searchParams.get('stage')
  const docId = req.nextUrl.searchParams.get('docId')

  if (docId) {
    const doc = await prisma.proposalDocument.findFirst({ where: { id: docId, proposalId } })
    if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(doc)
  }

  const docs = await prisma.proposalDocument.findMany({
    where: { proposalId, ...(stage ? { stage } : {}) },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: proposalId } = await params
  const { name, url, type, stage, replacesId } = await req.json()

  if (!name || !url) return NextResponse.json({ error: 'name y url son requeridos' }, { status: 400 })

  if (url.startsWith('data:')) {
    const size = Math.round((url.length * 3) / 4)
    if (size > MAX_SIZE) return NextResponse.json({ error: 'Archivo muy grande (máx 10MB)' }, { status: 400 })
  }

  let version = 1
  if (replacesId) {
    const prev = await prisma.proposalDocument.findFirst({ where: { id: replacesId, proposalId } })
    if (!prev) return NextResponse.json({ error: 'Documento a reemplazar no encontrado' }, { status: 404 })
    version = prev.version + 1
  }

  const mime = getMimeFromDataUrl(url)
  const previewUrl = await convertToPdfPreview(url, mime)

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.proposalDocument.create({
      data: { proposalId, name, url, type: type || 'otro', stage: stage || null, version, replacesId: replacesId || null, previewUrl },
    })
    if (replacesId) {
      await tx.proposalDocument.update({ where: { id: replacesId }, data: { archived: true } })
    }
    return created
  })

  return NextResponse.json(doc)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params
  const { docId } = await req.json()

  await prisma.proposalDocument.deleteMany({ where: { id: docId, proposalId } })
  return NextResponse.json({ ok: true })
}
