import type { TicketDesign } from '@core/domain';
import type { MessageKey, MessageParams } from '@core/i18n';
import type { TicketData } from './ticket-pdf';

type Translate = (key: MessageKey, params?: MessageParams) => string;

/**
 * The editor's preview and its test download describe the same ticket, so a long name,
 * a real QR payload and every field the receipt paints are visible before anyone saves.
 */
export function sampleTicketData(
  t: Translate,
  design: TicketDesign,
  eventName: string,
): TicketData {
  return {
    brand: t('app.name'),
    title: t('register.receipt.qr'),
    eventName: eventName.trim() || t('ticket.design.sampleEvent'),
    when: t('ticket.design.sampleWhen'),
    qrValue: 'EVT-6c2f56a5-d03d-4d45-bc76-d8302ab53dc8',
    qrCaption: t('register.receipt.how.1'),
    fields: [
      { label: t('register.receipt.titular'), value: t('ticket.design.sampleName') },
      { label: t('register.receipt.document'), value: t('ticket.design.sampleDocument') },
      { label: t('register.sede'), value: t('ticket.design.sampleSede') },
      { label: t('register.companions'), value: t('ticket.design.sampleCompanions') },
    ],
    folioLabel: t('register.receipt.folio'),
    folio: t('ticket.design.sampleFolio'),
    issued: `${t('register.receipt.issuedLabel')}: ${t('ticket.design.sampleIssued')}`,
    footer: t('register.receipt.ticketFooter'),
    primaryColor: design.accentColor,
    design,
  };
}
