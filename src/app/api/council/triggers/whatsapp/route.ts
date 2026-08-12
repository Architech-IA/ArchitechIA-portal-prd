import { NextRequest, NextResponse } from "next/server"
import { writeFileSync, unlinkSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

const EVOLUTION_URL = "http://localhost:8080"
const EVOLUTION_KEY = "evo-scheduling-2026"
const INSTANCE      = "orion"
const WHISPER_URL   = "http://localhost:9200"

async function transcribeAudio(messageData: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_KEY },
      body: JSON.stringify({ message: messageData, convertToMp4: false }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error("[WhatsApp→Whisper] Evolution media error", res.status)
      return null
    }
    const json = await res.json() as { base64?: string; mimetype?: string }
    if (!json.base64) return null

    const ext = json.mimetype?.includes("ogg") ? "ogg" : "mp3"
    const tmpPath = join(tmpdir(), `wa_audio_${Date.now()}.${ext}`)
    writeFileSync(tmpPath, Buffer.from(json.base64, "base64"))

    const formData = new FormData()
    const audioBlob = new Blob([Buffer.from(json.base64, "base64")], { type: json.mimetype ?? "audio/ogg" })
    formData.append("file", audioBlob, `audio.${ext}`)
    formData.append("model", "Systran/faster-whisper-small")
    formData.append("response_format", "json")

    const whisperRes = await fetch(`${WHISPER_URL}/v1/audio/transcriptions`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30_000),
    })

    try { unlinkSync(tmpPath) } catch {}

    if (!whisperRes.ok) {
      console.error("[WhatsApp→Whisper] Whisper error", whisperRes.status, await whisperRes.text())
      return null
    }
    const whisperData = await whisperRes.json() as { text?: string }
    return whisperData.text?.trim() ?? null
  } catch (err) {
    console.error("[WhatsApp→Whisper] Error", err)
    return null
  }
}

async function handleMessage(remoteJid: string, text: string, isAudio = false) {
  const phone = remoteJid.replace("@s.whatsapp.net", "").replace(/^\+/, "")
  const label = isAudio ? `[Audio transcrito] ${text}` : text
  console.log(`[WhatsApp→Orión] from=${phone} ${isAudio ? "audio" : "msg"}="${text.slice(0, 80)}"`)

  let reply: string
  try {
    const orionRes = await fetch("http://localhost:3003/api/orion/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: label,
        channelType: "whatsapp",
        channelId: phone,
        stream: false,
      }),
      signal: AbortSignal.timeout(40_000),
    })
    if (!orionRes.ok) {
      console.error("[WhatsApp→Orión] /api/orion/chat error", orionRes.status, (await orionRes.text()).slice(0, 200))
      return
    }
    const data = await orionRes.json() as { reply?: string }
    reply = data.reply?.trim() ?? ""
  } catch (err) {
    console.error("[WhatsApp→Orión] Orion endpoint error", err)
    return
  }

  if (!reply) return

  try {
    await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_KEY },
      body: JSON.stringify({ number: remoteJid, text: reply }),
    })
    console.log(`[WhatsApp→Orión] sent reply to ${phone}`)
  } catch (err) {
    console.error("[WhatsApp→Orión] Evolution send error", err)
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const d = body.data as Record<string, unknown> | undefined
  if (!d) return NextResponse.json({ ok: true })

  const key = d.key as Record<string, unknown> | undefined
  if (!key) return NextResponse.json({ ok: true })
  if (key.fromMe) return NextResponse.json({ ok: true })

  const remoteJid = key.remoteJid as string | undefined
  if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) {
    return NextResponse.json({ ok: true })
  }

  const msgContent = d.message as Record<string, unknown> | undefined
  const msgType = d.messageType as string | undefined

  // Audio message
  if (msgType === "audioMessage" || msgContent?.audioMessage) {
    ;(async () => {
      const transcript = await transcribeAudio(d)
      if (transcript) {
        await handleMessage(remoteJid, transcript, true)
      } else {
        console.log(`[WhatsApp→Whisper] could not transcribe audio from ${remoteJid}`)
      }
    })().catch(console.error)
    return NextResponse.json({ ok: true })
  }

  // Text message
  const text =
    (msgContent?.conversation as string) ||
    ((msgContent?.extendedTextMessage as Record<string, unknown>)?.text as string) ||
    null

  if (!text?.trim()) return NextResponse.json({ ok: true })

  handleMessage(remoteJid, text.trim()).catch(console.error)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ status: "ok", agent: "orion" })
}
