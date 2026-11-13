import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Calendar, Code2, MessageSquare, Printer, Thermometer } from 'lucide-react';
import type { FridgeTelemetry, QuarterlyCookout, SmsDigestPreview } from '../types/pantry';

interface CommunityOperationsProps {
  telemetry: FridgeTelemetry;
  cookout: QuarterlyCookout;
}

/**
 * Displays Grassroots & Town Council operational features from the community plan:
 * 1. Simulated smart-fridge sensor telemetry
 * 2. Elderly resident SMS morning digest preview (with structured JSON hook)
 * 3. Printable Fridge Door QR Code & Quarterly Community Cookout schedule
 */
export function CommunityOperations({ telemetry, cookout }: CommunityOperationsProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [smsPreview, setSmsPreview] = useState<SmsDigestPreview | null>(null);
  const [showSmsJson, setShowSmsJson] = useState(false);

  useEffect(() => {
    const targetUrl = typeof window !== 'undefined' ? window.location.href : 'https://kampungpantry.sg';
    QRCode.toDataURL(targetUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#13221A', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));

    fetch('/api/sms-preview')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SmsDigestPreview | null) => {
        if (data) setSmsPreview(data);
      })
      .catch(() => {});
  }, []);

  return (
    <section
      id="community-ops"
      aria-labelledby="community-ops-heading"
      className="bg-white py-8"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[#157A4C]">
            Town Council, Volunteers &amp; Inclusive Channels
          </p>
          <h2
            id="community-ops-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-[#13221A] sm:text-3xl"
          >
            Smart Fridge Operations, Senior SMS &amp; Fridge QR Poster
          </h2>
          <p className="mt-2 text-sm text-[#47554D]">
            Designed for every resident in the estate: void-deck QR scans, daily SMS alerts for
            seniors without smartphones, and Town Council fridge maintenance tracking.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Card 1: Smart Fridge Sensor Readings (Simulated) */}
          <article className="senior-border flex flex-col justify-between rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#13221A]">
                  Smart Fridge Telemetry
                </h3>
                <Thermometer className="h-5 w-5 text-[#157A4C]" aria-hidden="true" />
              </div>
              <p className="mt-1 text-xs text-[#47554D]">
                Unit {telemetry.fridgeId} · {telemetry.sensorStatus}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-[#DCE5DF] py-4">
                <div>
                  <dt className="text-xs text-[#47554D]">Chiller Shelf</dt>
                  <dd className="mt-0.5 font-mono text-xl font-semibold text-[#13221A] tabular-nums">
                    {telemetry.chillerTempC.toFixed(1)}°C
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#47554D]">Crisper Humidity</dt>
                  <dd className="mt-0.5 font-mono text-xl font-semibold text-[#13221A] tabular-nums">
                    {telemetry.crisperHumidityPct}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#47554D]">Dry Pantry Rack</dt>
                  <dd className="mt-0.5 font-mono text-xl font-semibold text-[#13221A] tabular-nums">
                    {telemetry.dryPantryTempC.toFixed(1)}°C
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#47554D]">Door Openings Today</dt>
                  <dd className="mt-0.5 font-mono text-xl font-semibold text-[#13221A] tabular-nums">
                    {telemetry.doorOpeningsToday}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 space-y-1.5 text-xs text-[#47554D]">
                <p>
                  <strong className="text-[#13221A]">Maintenance Partner:</strong>{' '}
                  {telemetry.townCouncilPartner}
                </p>
                <p>
                  <strong className="text-[#13221A]">Last Check:</strong>{' '}
                  {telemetry.lastMaintenanceCheck}
                </p>
                <p>
                  <strong className="text-[#13221A]">Next Cleanup:</strong>{' '}
                  {telemetry.nextScheduledCleanup}
                </p>
              </div>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-[#47554D] border-t border-[#DCE5DF] pt-3">
              {telemetry.simulatedNote}
            </p>
          </article>

          {/* Card 2: Senior SMS Digest Preview */}
          <article className="senior-border flex flex-col justify-between rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#13221A]">
                  Senior SMS Morning Alert
                </h3>
                <MessageSquare className="h-5 w-5 text-[#157A4C]" aria-hidden="true" />
              </div>
              <p className="mt-1 text-xs text-[#47554D]">
                Sent {smsPreview?.scheduledSendTime ?? 'Daily 08:30 SGT'} to{' '}
                <span className="tabular-nums">{smsPreview?.recipientCount ?? 64}</span> subscribed
                elderly residents
              </p>

              <div className="mt-4 rounded-lg border border-[#DCE5DF] bg-white p-4">
                {showSmsJson && smsPreview ? (
                  <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-[#13221A]">
                    {JSON.stringify(smsPreview.structuredPayload, null, 2)}
                  </pre>
                ) : (
                  <p className="whitespace-pre-line font-mono text-xs leading-relaxed text-[#13221A]">
                    {smsPreview?.messageBody ??
                      'Loading morning SMS stock summary for Blk 412 elderly subscribers...'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 border-t border-[#DCE5DF] pt-3">
              <button
                type="button"
                onClick={() => setShowSmsJson((prev) => !prev)}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#CBD6CE] bg-white px-3 py-2 text-xs font-semibold text-[#13221A] hover:bg-[#EDF2EE] cursor-pointer"
              >
                <Code2 className="h-4 w-4" aria-hidden="true" />
                <span>{showSmsJson ? 'Show Plain SMS Text' : 'Inspect SMS Gateway JSON'}</span>
              </button>
              <p className="text-xs text-[#47554D]">
                {smsPreview?.gatewayIntegrationHook ??
                  'Structured payload ready for GovTech Postman.gov.sg / Twilio SMS gateway.'}
              </p>
            </div>
          </article>

          {/* Card 3: Printable Fridge Door QR Poster & Quarterly Cookout */}
          <article className="senior-border print-only-poster flex flex-col justify-between rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#13221A]">
                  Fridge Door QR &amp; Cookout
                </h3>
                <Calendar className="h-5 w-5 text-[#157A4C]" aria-hidden="true" />
              </div>

              <div className="mt-4 flex items-center gap-4 rounded-lg border border-[#DCE5DF] bg-white p-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Scan QR code to view live Kampung Pantry stock"
                    className="h-24 w-24 shrink-0 rounded border border-[#EDF2EE]"
                  />
                ) : (
                  <div className="h-24 w-24 shrink-0 rounded bg-[#EDF2EE]" />
                )}
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-[#13221A]">
                    Scan for Live Stock &amp; Recipes
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#47554D]">
                    Paste this poster on the Blk 412 fridge door so neighbours can check fresh
                    arrivals or log donations in 1 tap.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-[#DCE5DF] bg-white p-4">
                <p className="text-xs font-semibold text-[#157A4C]">{cookout.dateLabel}</p>
                <p className="mt-1 font-display text-base font-bold text-[#13221A]">
                  {cookout.title}
                </p>
                <p className="mt-0.5 text-xs text-[#47554D]">
                  {cookout.location} · <span className="tabular-nums">{cookout.rsvpCount}</span>{' '}
                  neighbours attending
                </p>
                <ul className="mt-2 space-y-1 text-xs text-[#47554D]">
                  {cookout.featuredDishes.map((dish) => (
                    <li key={dish}>• {dish}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="no-print mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#13221A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1F3529] transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Print Fridge QR Poster</span>
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
