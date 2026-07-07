export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType') ?? '';
  const entityId   = searchParams.get('entityId') ?? '';

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval>;
  let keepAlive: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        try {
          const { prisma } = await import('@/lib/prisma');
          const comments = await prisma.comment.findMany({
            where: { entityType, entityId, parentId: null },
            include: {
              user: { select: { id: true, name: true, avatar: true } },
              replies: {
                include: { user: { select: { id: true, name: true, avatar: true } } },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(comments)}\n\n`));
        } catch {}
      };

      send();
      interval  = setInterval(send, 4000);
      keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
      }, 25000);
    },
    cancel() {
      clearInterval(interval);
      clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
