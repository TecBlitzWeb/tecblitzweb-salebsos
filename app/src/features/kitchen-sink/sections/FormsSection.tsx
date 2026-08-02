import { useState } from 'react'
import { Section, Row } from '../KitchenSinkSection'
import { Button } from '../../../components/ui/Button'
import { Input, Textarea, Field } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Combobox } from '../../../components/ui/Combobox'
import { DatePicker } from '../../../components/ui/DatePicker'

const TYPE_OPTIONS = [
  { value: 'hotel', label: 'Hotel / Guesthouse' },
  { value: 'salon', label: 'Salon' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'garage', label: 'Garage' },
]

const AREAS = ['Badulla', 'Bandarawela', 'Ella', 'Horana', 'Kandy', 'Matara', 'Negombo']

export function FormsSection() {
  const [area, setArea] = useState('')
  const [date, setDate] = useState<Date | null>(null)

  return (
    <>
      <Section title="Buttons" note="Four variants, three sizes, plus loading and disabled.">
        <Row label="Variants — default size (36px)">
          <Button variant="primary">Add prospect</Button>
          <Button variant="secondary">Send mockup</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </Row>
        <Row label="Sizes — sm 32px / default 36px / mobile 44px">
          <Button size="sm">Log call</Button>
          <Button size="default">Log call</Button>
          <Button size="mobile">Log call</Button>
        </Row>
        <Row label="States">
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" loading>
            Saving
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>
      </Section>

      <Section
        title="Form controls"
        note="All 36px tall. Autofill-safe — Chrome's yellow override is neutralised globally."
      >
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="ks-name">
            <Input id="ks-name" placeholder="SpringView Holiday Home" />
          </Field>
          <Field label="Phone" htmlFor="ks-phone" hint="Auto-formats to 0XX XXX XXXX">
            <Input id="ks-phone" className="font-mono tracking-[0.02em]" placeholder="077 352 2686" />
          </Field>
          <Field label="Email — autofill test" htmlFor="ks-email">
            <Input id="ks-email" type="email" autoComplete="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password — autofill test" htmlFor="ks-pass">
            <Input id="ks-pass" type="password" autoComplete="current-password" placeholder="••••••" />
          </Field>
          <Field label="Type" htmlFor="ks-type">
            <Select id="ks-type" options={TYPE_OPTIONS} placeholder="Choose a type" />
          </Field>
          <Field label="Area — combobox, free text allowed" htmlFor="ks-area">
            <Combobox id="ks-area" options={AREAS} value={area} onChange={setArea} placeholder="Badulla" />
          </Field>
          <Field label="Follow-up date" htmlFor="ks-date">
            <DatePicker id="ks-date" value={date} onChange={setDate} />
          </Field>
          <Field label="Disabled" htmlFor="ks-disabled">
            <Input id="ks-disabled" disabled placeholder="Assigned to you" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="ks-notes">
              <Textarea id="ks-notes" placeholder="proposal eka whatsapp dekatma yauwa" />
            </Field>
          </div>
        </div>
      </Section>
    </>
  )
}
