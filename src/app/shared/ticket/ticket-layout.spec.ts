import { describe, expect, it } from 'vitest';
import { TICKET_HEIGHT, TICKET_WIDTH, ticketFrame } from './ticket-layout';

describe('ticketFrame', () => {
  it('keeps the default title on the header and the QR inside the body', () => {
    const frame = ticketFrame();
    const headerBottom = frame.card.y + frame.headerHeight;

    expect(frame.titleX).toBeGreaterThanOrEqual(frame.contentLeft);
    expect(frame.titleY).toBeGreaterThan(frame.card.y);
    expect(frame.titleY + frame.titleSize).toBeLessThan(headerBottom);
    expect(frame.qrY).toBeGreaterThanOrEqual(headerBottom);
    expect(frame.qrX).toBeGreaterThanOrEqual(frame.card.x);
    expect(frame.qrX + frame.qrSize).toBeLessThanOrEqual(frame.card.x + frame.card.w);
    expect(frame.qrY + frame.qrSize).toBeLessThanOrEqual(frame.footerY - 100);
  });

  it('clamps extreme slider values so nothing leaves the page', () => {
    const low = ticketFrame({
      titleX: 0,
      titleY: 0,
      qrX: 0,
      qrY: 0,
      qrSize: 10,
      titleSize: 4,
    });
    const high = ticketFrame({
      titleX: 100,
      titleY: 100,
      qrX: 100,
      qrY: 100,
      qrSize: 999,
      titleSize: 999,
    });

    for (const frame of [low, high]) {
      expect(frame.titleX).toBeGreaterThanOrEqual(frame.card.x);
      expect(frame.titleX).toBeLessThan(TICKET_WIDTH);
      expect(frame.titleY).toBeGreaterThan(frame.card.y);
      expect(frame.titleY).toBeLessThan(frame.card.y + frame.headerHeight);
      expect(frame.qrX).toBeGreaterThanOrEqual(frame.card.x);
      expect(frame.qrY).toBeGreaterThanOrEqual(frame.card.y);
      expect(frame.qrX + frame.qrSize).toBeLessThanOrEqual(frame.card.x + frame.card.w);
      expect(frame.qrY + frame.qrSize).toBeLessThanOrEqual(frame.footerY);
      expect(frame.qrSize).toBeGreaterThanOrEqual(80);
      expect(frame.qrSize).toBeLessThanOrEqual(240);
      expect(frame.titleSize).toBeLessThanOrEqual(48);
    }

    expect(low.qrX).toBeLessThan(high.qrX);
    expect(low.titleX).toBeLessThan(high.titleX);
    expect(TICKET_HEIGHT).toBe(640);
  });
});
