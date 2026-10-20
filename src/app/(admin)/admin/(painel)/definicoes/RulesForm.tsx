import type { BookingRules } from "@/lib/booking/rules";
import { saveRules } from "@/app/(admin)/admin/actions-config";
import { Card, Field, fieldClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

/** Booking-engine rules: times, tourist tax, horizon, payment holds. */
export function RulesForm({ rules }: { rules: BookingRules }) {
  return (
    <form action={saveRules} className="mt-6 grid max-w-4xl gap-6">
      <Card className="p-6">
        <h2 className="font-display text-lg tracking-tight">Regras de reserva</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Aplicam-se ao motor do site, às reservas do balcão e aos e-mails enviados aos hóspedes.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-4">
          <Field label="Check-in a partir de" htmlFor="checkInFrom">
            <input id="checkInFrom" name="checkInFrom" type="time" defaultValue={rules.checkInFrom} className={fieldClass} />
          </Field>
          <Field label="Check-in até" htmlFor="checkInUntil">
            <input id="checkInUntil" name="checkInUntil" type="time" defaultValue={rules.checkInUntil} className={fieldClass} />
          </Field>
          <Field label="Check-out até" htmlFor="checkOutUntil">
            <input id="checkOutUntil" name="checkOutUntil" type="time" defaultValue={rules.checkOutUntil} className={fieldClass} />
          </Field>
          <Field label="Reservas para hoje até" htmlFor="sameDayCutoff" hint="Depois desta hora o site não aceita chegadas no próprio dia.">
            <input id="sameDayCutoff" name="sameDayCutoff" type="time" defaultValue={rules.sameDayCutoff} className={fieldClass} />
          </Field>
          <Field label="Estadia máxima online (noites)" htmlFor="maxNights">
            <input id="maxNights" name="maxNights" type="number" min={1} max={365} defaultValue={rules.maxNights} className={fieldClass} />
          </Field>
          <Field label="Reservas abertas até (dias)" htmlFor="maxAdvanceDays">
            <input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min={1} max={1000} defaultValue={rules.maxAdvanceDays} className={fieldClass} />
          </Field>
          <Field label="Crianças: idade máxima" htmlFor="childMaxAge">
            <input id="childMaxAge" name="childMaxAge" type="number" min={0} max={17} defaultValue={rules.childMaxAge} className={fieldClass} />
          </Field>
          <Field label="IVA do alojamento (%)" htmlFor="vatAccommodation">
            <input id="vatAccommodation" name="vatAccommodation" inputMode="decimal" defaultValue={rules.vatAccommodation} className={fieldClass} />
          </Field>
        </div>
        <label className="mt-5 flex items-start gap-2 text-sm">
          <input type="checkbox" name="autoConfirm" defaultChecked={rules.autoConfirm} className="mt-0.5 h-4 w-4" />
          <span>
            Confirmar automaticamente as reservas do site com pagamento no hotel
            <span className="block text-xs text-[var(--color-ink-muted)]">
              A disponibilidade é verificada e reservada no momento; sem esta opção ficam pendentes até a receção confirmar.
            </span>
          </span>
        </label>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg tracking-tight">Taxa municipal turística</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          No Porto: 3 € por noite e por hóspede a partir dos 13 anos, até 7 noites. A Câmara está a rever o valor — atualize aqui quando mudar.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="taxEnabled" defaultChecked={rules.touristTax.enabled} className="h-4 w-4" /> Cobrar taxa turística
        </label>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <Field label="Valor por noite e hóspede (€)" htmlFor="taxAmount">
            <input id="taxAmount" name="taxAmount" inputMode="decimal" defaultValue={rules.touristTax.amount} className={fieldClass} />
          </Field>
          <Field label="Máximo de noites cobradas" htmlFor="taxMaxNights">
            <input id="taxMaxNights" name="taxMaxNights" type="number" min={1} defaultValue={rules.touristTax.maxNights} className={fieldClass} />
          </Field>
          <Field label="Isento abaixo de (idade)" htmlFor="taxExemptUnder">
            <input id="taxExemptUnder" name="taxExemptUnder" type="number" min={0} defaultValue={rules.touristTax.exemptUnderAge} className={fieldClass} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg tracking-tight">Pagamentos e lembretes</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            label="Prazo para pagar reservas pré-pagas (horas)"
            htmlFor="paymentHoldHours"
            hint="Depois deste prazo sem pagamento, a reserva é cancelada e o quarto volta à venda."
          >
            <input id="paymentHoldHours" name="paymentHoldHours" type="number" min={1} max={240} defaultValue={rules.paymentHoldHours} className={fieldClass} />
          </Field>
          <Field label="Lembrete com check-in online (dias antes)" htmlFor="reminderDaysBefore" hint="0 desliga o lembrete.">
            <input id="reminderDaysBefore" name="reminderDaysBefore" type="number" min={0} max={30} defaultValue={rules.reminderDaysBefore} className={fieldClass} />
          </Field>
        </div>
      </Card>

      <div>
        <SubmitButton icon="check" pendingLabel="A guardar…">
          Guardar regras
        </SubmitButton>
      </div>
    </form>
  );
}
