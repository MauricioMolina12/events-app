import type { TicketDesign } from '@core/domain';

/**
 * One coordinate system for the on-screen ticket and the PDF.
 *
 * The page is 360×640 points. Sliders are percentages of that page. Positions are then
 * clamped into the regions that keep the title on the header, the QR on the white body
 * and the folio clear of both — so a value of 0 or 100 cannot push content off the page.
 */

export const TICKET_WIDTH = 360;
export const TICKET_HEIGHT = 640;

const CARD_INSET = 20;
const CARD_PAD = 24;
const HEADER_HEIGHT = 200;
/** Room kept above the folio for the caption and the two field rows. */
const FIELD_RESERVE = 108;

export interface TicketFrame {
  readonly card: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly r: number;
  };
  readonly headerHeight: number;
  readonly titleX: number;
  readonly titleY: number;
  readonly titleSize: number;
  readonly titleMaxWidth: number;
  readonly qrSize: number;
  /** Top-left of the QR tile, after the center point is clamped into the body. */
  readonly qrX: number;
  readonly qrY: number;
  readonly footerY: number;
  readonly contentLeft: number;
  readonly contentWidth: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function ticketFrame(design?: TicketDesign | null): TicketFrame {
  const card = {
    x: CARD_INSET,
    y: CARD_INSET,
    w: TICKET_WIDTH - CARD_INSET * 2,
    h: TICKET_HEIGHT - CARD_INSET * 2,
    r: 24,
  };
  const contentLeft = card.x + CARD_PAD;
  const contentRight = card.x + card.w - CARD_PAD;
  const contentWidth = contentRight - contentLeft;
  const footerY = card.y + card.h - 74;
  const titleSize = clamp(design?.titleSize ?? 22, 12, 48);
  const qrSize = clamp(design?.qrSize ?? 184, 80, Math.min(240, contentWidth));
  const half = qrSize / 2;

  // Top of the title block. A second line has to stay on the colored header.
  const titleBlock = titleSize + 28;
  const titleX = clamp(
    (TICKET_WIDTH * (design?.titleX ?? 8)) / 100,
    contentLeft,
    contentRight - 48,
  );
  const titleY = clamp(
    (TICKET_HEIGHT * (design?.titleY ?? 18)) / 100,
    card.y + 86,
    card.y + HEADER_HEIGHT - 12 - titleBlock,
  );

  const bodyTop = card.y + HEADER_HEIGHT + 8;
  const qrBottomLimit = footerY - FIELD_RESERVE;
  const qrCenterX = clamp(
    (TICKET_WIDTH * (design?.qrX ?? 50)) / 100,
    contentLeft + half,
    contentRight - half,
  );
  const qrCenterY = clamp(
    (TICKET_HEIGHT * (design?.qrY ?? 55)) / 100,
    bodyTop + half,
    qrBottomLimit - half,
  );

  return {
    card,
    headerHeight: HEADER_HEIGHT,
    titleX,
    titleY,
    titleSize,
    titleMaxWidth: Math.max(48, contentRight - titleX),
    qrSize,
    qrX: qrCenterX - half,
    qrY: qrCenterY - half,
    footerY,
    contentLeft,
    contentWidth,
  };
}
