export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval>;
  let keepAlive: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        try {
          const { prisma } = await import('@/lib/prisma');
          const notifications = await prisma.notification.findMany({
            where: { read: false },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(notifications)}\n\n`));
        } catch {}
      };

      send();
      interval  = setInterval(send, 10000);
      keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
      }, 30000);
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
