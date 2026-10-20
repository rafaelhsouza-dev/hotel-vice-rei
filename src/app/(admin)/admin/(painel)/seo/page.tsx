import { requirePagePermission } from "@/lib/auth/session";
import { getAnalytics, getSeo } from "@/lib/repo/content";
import { SITE_URL } from "@/lib/site";
import { saveSeo } from "@/app/(admin)/admin/actions-config";
import { AdminHeader, Section, Card, Field, Flash, fieldClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CopyField } from "@/components/admin/CopyField";

export const dynamic = "force-dynamic";

function Input({ id, label, value, hint, placeholder, mono = true }: { id: string; label: string; value: string; hint?: React.ReactNode; placeholder?: string; mono?: boolean }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input id={id} name={id} defaultValue={value} placeholder={placeholder} spellCheck={false} className={`${fieldClass} ${mono ? "font-mono" : ""}`} />
    </Field>
  );
}

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requirePagePermission("/admin/seo");
  const { ok, erro } = await searchParams;
  const [seo, analytics] = await Promise.all([getSeo(), getAnalytics()]);

  return (
    <>
      <AdminHeader
        title="SEO e monitorização"
        subtitle="Ligações ao Google, Bing e restantes ferramentas de medição. Tudo o que mede visitantes só carrega depois de o visitante aceitar cookies (Consent Mode v2)."
      />
      <Section>
        <Flash ok={ok} error={erro} />
        <form action={saveSeo} className="grid max-w-5xl gap-6">
          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Google</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Input id="ga4" label="Google Analytics 4 · ID de medição" value={analytics.ga4} placeholder="G-XXXXXXXXXX" hint="analytics.google.com → Administrador → Fluxos de dados. Mede reservas (purchase) com valor." />
              <Input id="gtm" label="Google Tag Manager · contentor" value={analytics.gtm} placeholder="GTM-XXXXXXX" hint="Só se gerir as etiquetas pelo Tag Manager; nesse caso pode deixar o GA4 vazio." />
              <Input id="searchConsole" label="Search Console · verificação" value={analytics.searchConsole} placeholder="código google-site-verification" hint="Pode colar a meta tag inteira; guardamos só o código." />
              <Input id="googleAdsId" label="Google Ads · ID de conversão" value={seo.googleAdsId} placeholder="AW-123456789" />
              <Input id="googleAdsLabel" label="Google Ads · etiqueta da conversão de reserva" value={seo.googleAdsLabel} placeholder="AbCdEfGh" />
              <Input id="googleHotelCenterId" label="Google Hotel Center · ID da conta" value={seo.googleHotelCenterId} hint="Para os links gratuitos de reserva, quando houver parceiro de conectividade." />
              <Input id="googleBusinessUrl" label="Perfil da Empresa no Google (URL)" value={seo.googleBusinessUrl} mono={false} placeholder="https://maps.google.com/?cid=…" hint="Entra nos dados estruturados (sameAs) e no rodapé." />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <CopyField label="Sitemap para o Search Console" value={`${SITE_URL}/sitemap.xml`} />
              <CopyField label="Ficha para assistentes de IA (llms.txt)" value={`${SITE_URL}/llms.txt`} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Outros motores e redes</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Input id="bing" label="Bing Webmaster Tools · msvalidate.01" value={seo.bing} hint="Também cobre o Copilot e o DuckDuckGo." />
              <Input id="yandex" label="Yandex · verificação" value={seo.yandex} />
              <Input id="facebookDomain" label="Meta · verificação de domínio" value={seo.facebookDomain} />
              <Input id="pinterest" label="Pinterest · verificação" value={seo.pinterest} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Medição e comportamento</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Opcionais. Cada etiqueta adicional pesa no carregamento — ative só o que for usado.</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <Input id="metaPixel" label="Meta Pixel · ID" value={seo.metaPixel} placeholder="123456789012345" hint="Só carrega com consentimento de marketing." />
              <Input id="clarity" label="Microsoft Clarity · ID" value={seo.clarity} hint="Mapas de calor e gravações anónimas." />
              <Input id="hotjar" label="Hotjar · ID do site" value={seo.hotjar} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Avaliações reais e perfis</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              O site mostra estes valores tal como estão nas plataformas. Mantenha-os atualizados: mostrar avaliações diferentes das reais é prática comercial enganosa.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <Input id="tripadvisorScore" label="Tripadvisor · nota (de 5)" value={seo.tripadvisorScore} mono={false} />
              <Input id="tripadvisorCount" label="Tripadvisor · n.º de avaliações" value={seo.tripadvisorCount} mono={false} />
              <Input id="tripadvisorUrl" label="Tripadvisor · URL" value={seo.tripadvisorUrl} mono={false} />
              <Input id="bookingScore" label="Booking.com · nota (de 10)" value={seo.bookingScore} mono={false} />
              <Input id="bookingCount" label="Booking.com · n.º de avaliações" value={seo.bookingCount} mono={false} />
              <Input id="bookingUrl" label="Booking.com · URL da ficha" value={seo.bookingUrl} mono={false} />
              <Input id="googleScore" label="Google · nota (de 5)" value={seo.googleScore} mono={false} />
              <Input id="googleCount" label="Google · n.º de avaliações" value={seo.googleCount} mono={false} />
            </div>
          </Card>

          <div>
            <SubmitButton icon="check" pendingLabel="A guardar…">
              Guardar
            </SubmitButton>
          </div>
        </form>
      </Section>
    </>
  );
}
