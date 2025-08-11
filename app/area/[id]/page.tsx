import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TriggerButton } from '@/components/TriggerButton';

export default async function AreaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const area = await prisma.area.findUnique({ where: { id } });
  if (!area) return notFound();
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/areas/${area.id}`, { cache: 'no-store' });
  const data = await res.json();
  const { alert, now, today, week } = data;
  const lastUpdated = data?.observation?.observedAt ? new Date(data.observation.observedAt) : null;
  const lastUpdatedLabel = lastUpdated ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(lastUpdated) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{area.name}</h1>
      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-500">{lastUpdatedLabel ? `Last updated ${lastUpdatedLabel} IST` : ''}</div>
        <TriggerButton />
      </div>
      {now && (
        <section className="rounded-lg border-l-4 pl-3 py-3 bg-white" style={{ borderColor: '#3b82f6' }}>
          <div className="text-xs uppercase tracking-wide text-gray-600">NOW · {now.timeLabel}</div>
          <div className="font-medium">{now.textEn}</div>
          <div className="text-gray-700">{now.textTe}</div>
        </section>
      )}
      {today && (
        <section className="rounded-lg border-l-4 pl-3 py-3 bg-white" style={{ borderColor: '#f59e0b' }}>
          <div className="text-xs uppercase tracking-wide text-gray-600">TODAY · {today.windowLabel}</div>
          <div className="font-medium">{today.textEn}</div>
          <div className="text-gray-700">{today.textTe}</div>
        </section>
      )}
      {Array.isArray(week) && week.length > 0 && (
        <section className="rounded-lg border-l-4 pl-3 py-3 bg-white" style={{ borderColor: '#10b981' }}>
          <div className="text-xs uppercase tracking-wide text-gray-600 mb-1">THIS WEEK</div>
          <div className="space-y-1">
            {week.map((d: any, idx: number) => (
              <div key={idx} className="text-sm">
                <div className="font-medium">{d.textEn}</div>
                <div className="text-gray-700">{d.textTe}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// (Using client TriggerButton from components/TriggerButton)


