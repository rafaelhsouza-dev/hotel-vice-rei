import { getHotel } from "@/lib/repo/content";
import { saveSettings } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function SettingsAdminPage() {
  const hotel = await getHotel();

  return (
    <>
      <AdminHeader
        title="Definições"
        subtitle="Dados do hotel usados no site, nos contactos e nos dados estruturados."
      />
      <Section>
        <form action={saveSettings} className="grid max-w-4xl gap-6">
          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Identidade</h2>
            <div className="mt-4 grid gap-5">
              <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
                <div>
                  <label className={labelClass} htmlFor="name">
                    Nome do hotel
                  </label>
                  <input id="name" name="name" defaultValue={hotel.name} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="totalRooms">
                    Total de quartos
                  </label>
                  <input
                    id="totalRooms"
                    name="totalRooms"
                    type="number"
                    min={0}
                    defaultValue={hotel.totalRooms}
                    className={fieldClass}
                  />
                </div>
              </div>
              <LocaleFields name="brandTagline" label="Assinatura de marca" values={hotel.brandTagline} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Contactos e morada</h2>
            <div className="mt-4 grid gap-5">
              <div>
                <label className={labelClass} htmlFor="street">
                  Rua e número
                </label>
                <input id="street" name="street" defaultValue={hotel.address.street} className={fieldClass} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="postalCode">
                    Código postal
                  </label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    defaultValue={hotel.address.postalCode}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="city">
                    Localidade
                  </label>
                  <input id="city" name="city" defaultValue={hotel.address.city} className={fieldClass} />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="email">
                    Email
                  </label>
                  <input id="email" name="email" type="email" defaultValue={hotel.email} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="phones">
                    Telefones
                  </label>
                  <textarea
                    id="phones"
                    name="phones"
                    rows={2}
                    defaultValue={hotel.phones.join("\n")}
                    className={fieldClass}
                  />
                  <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">Um por linha.</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="lat">
                    Latitude
                  </label>
                  <input
                    id="lat"
                    name="lat"
                    type="number"
                    step="0.000001"
                    defaultValue={hotel.coords.lat}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lng">
                    Longitude
                  </label>
                  <input
                    id="lng"
                    name="lng"
                    type="number"
                    step="0.000001"
                    defaultValue={hotel.coords.lng}
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Redes e reputação</h2>
            <div className="mt-4 grid gap-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="facebook">
                    Facebook
                  </label>
                  <input id="facebook" name="facebook" defaultValue={hotel.social.facebook} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="instagram">
                    Instagram
                  </label>
                  <input id="instagram" name="instagram" defaultValue={hotel.social.instagram} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="tripadvisor">
                    TripAdvisor
                  </label>
                  <input
                    id="tripadvisor"
                    name="tripadvisor"
                    defaultValue={hotel.social.tripadvisor}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="ratingScore">
                    Classificação média
                  </label>
                  <input
                    id="ratingScore"
                    name="ratingScore"
                    type="number"
                    step="0.1"
                    min={0}
                    max={5}
                    defaultValue={hotel.rating.score}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ratingCount">
                    Número de avaliações
                  </label>
                  <input
                    id="ratingCount"
                    name="ratingCount"
                    type="number"
                    min={0}
                    defaultValue={hotel.rating.count}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="paymentMethods">
                  Métodos de pagamento
                </label>
                <textarea
                  id="paymentMethods"
                  name="paymentMethods"
                  rows={4}
                  defaultValue={hotel.paymentMethods.join("\n")}
                  className={fieldClass}
                />
                <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">Um por linha.</p>
              </div>
            </div>
          </Card>

          <div>
            <SubmitButton icon="check" pendingLabel="A guardar…">
              Guardar definições
            </SubmitButton>
          </div>
        </form>
      </Section>
    </>
  );
}
