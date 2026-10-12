import { encode } from 'uqr';

/**
 * Downloadable access ticket.
 *
 * The ticket is painted on a canvas at print resolution and wrapped in a one-page PDF written
 * by hand: a single JPEG image is all a PDF needs, so no PDF library ships to the browser and
 * the download works offline. Every string arrives already translated.
 */

export interface TicketField {
  readonly label: string;
  readonly value: string;
}

export interface TicketData {
  readonly brand: string;
  readonly title: string;
  readonly eventName: string | null;
  readonly when: string | null;
  readonly qrValue: string;
  readonly qrCaption: string;
  readonly fields: readonly TicketField[];
  readonly folioLabel: string;
  readonly folio: string;
  readonly issued: string;
  readonly footer: string;
  readonly primaryColor?: string;
  readonly design?: {
    readonly bgColor?: string;
    readonly textColor?: string;
    readonly accentColor?: string;
    readonly titleWeight?: number;
    readonly titleSize?: number;
    readonly titleX?: number;
    readonly titleY?: number;
    readonly qrX?: number;
    readonly qrY?: number;
    readonly qrSize?: number;
    readonly fieldWeight?: number;
  };
}

/** Page in PDF points; the canvas is painted `SCALE` times larger so print stays sharp. */
const WIDTH = 360;
const HEIGHT = 640;
const SCALE = 3;

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace';

const COLORS = {
  page: '#f4f6fa',
  card: '#ffffff',
  ink: '#111827',
  muted: '#6b7280',
  line: '#e5e7eb',
} as const;

function gradientFrom(primary = '#C81F68'): readonly [string, string, string] {
  return [mixHex(primary, '#ffffff', 0.28), primary, mixHex(primary, '#111827', 0.42)];
}

function mixHex(hex: string, other: string, amount: number): string {
  const left = parseHex(hex);
  const right = parseHex(other);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return toHex(mix(left.r, right.r), mix(left.g, right.g), mix(left.b, right.b));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export async function downloadTicketPdf(data: TicketData, fileName: string): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D is not available');
  }
  ctx.scale(SCALE, SCALE);
  paintTicket(ctx, data);

  const jpeg = await toJpegBytes(canvas);
  const pdf = buildPdf(jpeg, canvas.width, canvas.height);
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function paintTicket(ctx: CanvasRenderingContext2D, data: TicketData): void {
  const card = { x: 20, y: 20, w: WIDTH - 40, h: HEIGHT - 40, r: 24 };
  const headerHeight = 200;
  const tearY = card.y + headerHeight;
  const design = data.design;
  const primary = design?.accentColor ?? data.primaryColor;
  const gradientColors = gradientFrom(primary);
  const ink = design?.textColor ?? COLORS.ink;
  const titleWeight = design?.titleWeight ?? 800;
  const titleSize = design?.titleSize ?? 22;
  const fieldWeight = design?.fieldWeight ?? 700;

  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.shadowColor = 'rgba(17, 24, 39, 0.12)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, card.x, card.y, card.w, card.h, card.r);
  ctx.fill();
  ctx.restore();

  // Header band, clipped to the card's rounded top.
  ctx.save();
  roundRect(ctx, card.x, card.y, card.w, card.h, card.r);
  ctx.clip();
  const gradient = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y + headerHeight);
  gradient.addColorStop(0, gradientColors[0]);
  gradient.addColorStop(0.55, gradientColors[1]);
  gradient.addColorStop(1, gradientColors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(card.x, card.y, card.w, headerHeight);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  circle(ctx, card.x + card.w - 30, card.y + 20, 90);
  circle(ctx, card.x + card.w - 10, card.y + headerHeight - 10, 50);
  ctx.restore();

  // Brand row.
  const left = card.x + 24;
  const inner = card.w - 48;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, left, card.y + 24, 30, 30, 9);
  ctx.fill();
  ctx.fillStyle = gradientColors[1];
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BC', left + 15, card.y + 39.5);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(fit(ctx, data.brand, inner - 42), left + 40, card.y + 39.5);

  // Title, event and schedule.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.font = `700 10px ${FONT}`;
  withSpacing(ctx, '1.5px', () => ctx.fillText(data.title.toUpperCase(), left, card.y + 92));

  ctx.fillStyle = '#ffffff';
  ctx.font = `${titleWeight} ${titleSize}px ${FONT}`;
  let y = card.y + 120;
  if (design?.titleX !== undefined || design?.titleY !== undefined) {
    y = card.y + ((design.titleY ?? 18) / 100) * headerHeight;
  }
  for (const line of wrap(ctx, data.eventName ?? data.title, inner, 2)) {
    ctx.fillText(line, left, y);
    y += 27;
  }
  if (data.when) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText(fit(ctx, data.when, inner), left, y + 2);
  }

  // Side notches where the stub tears off.
  ctx.fillStyle = COLORS.page;
  circle(ctx, card.x, tearY, 12);
  circle(ctx, card.x + card.w, tearY, 12);

  // QR on a white tile.
  const qrBox = design?.qrSize ?? 184;
  const qrX = design?.qrX !== undefined ? (WIDTH * design.qrX) / 100 - qrBox / 2 : (WIDTH - qrBox) / 2;
  const qrY = design?.qrY !== undefined ? (HEIGHT * design.qrY) / 100 - qrBox / 2 : tearY + 28;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  roundRect(ctx, qrX, qrY, qrBox, qrBox, 16);
  ctx.fill();
  ctx.stroke();
  paintQr(ctx, data.qrValue, qrX + 12, qrY + 12, qrBox - 24, primary ?? design?.textColor ?? '#111111');

  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(fit(ctx, data.qrCaption, inner), WIDTH / 2, qrY + qrBox + 20);
  ctx.textAlign = 'left';

  // Details, two per row.
  const columnWidth = (inner - 16) / 2;
  let rowY = qrY + qrBox + 46;
  data.fields.forEach((field, index) => {
    const x = left + (index % 2) * (columnWidth + 16);
    if (index > 0 && index % 2 === 0) {
      rowY += 38;
    }
    ctx.fillStyle = COLORS.muted;
    ctx.font = `${fieldWeight} 8.5px ${FONT}`;
    withSpacing(ctx, '1px', () =>
      ctx.fillText(fit(ctx, field.label.toUpperCase(), columnWidth), x, rowY),
    );
    ctx.fillStyle = ink;
    ctx.font = `${fieldWeight} 12.5px ${FONT}`;
    ctx.fillText(fit(ctx, field.value, columnWidth), x, rowY + 16);
  });

  // Folio footer.
  const footerY = card.y + card.h - 74;
  dashed(ctx, left, footerY, left + inner);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 8.5px ${FONT}`;
  withSpacing(ctx, '1px', () => ctx.fillText(data.folioLabel.toUpperCase(), left, footerY + 18));
  ctx.fillStyle = COLORS.ink;
  ctx.font = `600 9.5px ${MONO}`;
  ctx.fillText(fit(ctx, data.folio, inner), left, footerY + 32);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 8.5px ${FONT}`;
  ctx.fillText(fit(ctx, data.issued, inner), left, footerY + 46);
  ctx.font = `400 8px ${FONT}`;
  ctx.fillText(fit(ctx, data.footer, inner), left, footerY + 59);
}

function paintQr(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = '#111111',
) {
  const { data, size: count } = encode(value, { ecc: 'M', border: 1 });
  const cell = size / count;
  ctx.fillStyle = color;
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (data[row]?.[col]) {
        // A hair of overlap avoids hairline gaps between modules once rasterised.
        ctx.fillRect(x + col * cell, y + row * cell, cell + 0.05, cell + 0.05);
      }
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function dashed(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number): void {
  ctx.save();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** `letterSpacing` is recent; where it is missing the text simply keeps its default tracking. */
function withSpacing(ctx: CanvasRenderingContext2D, spacing: string, paint: () => void): void {
  const target = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const previous = target.letterSpacing;
  if (previous !== undefined) {
    target.letterSpacing = spacing;
  }
  paint();
  if (previous !== undefined) {
    target.letterSpacing = previous;
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) {
    end -= 1;
  }
  return `${text.slice(0, end).trimEnd()}…`;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  if (lines.length <= maxLines) {
    return lines.map((line) => fit(ctx, line, maxWidth));
  }
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(ctx, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, maxWidth);
  return kept;
}

async function toJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.95),
  );
  if (!blob) {
    throw new Error('Could not encode the ticket image');
  }
  return new Uint8Array(await blob.arrayBuffer());
}

/** One page, one JPEG XObject drawn edge to edge. */
function buildPdf(
  jpeg: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array): void => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (body: () => void): void => {
    offsets.push(length);
    push(`${offsets.length} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  const content = `q ${WIDTH} 0 0 ${HEIGHT} 0 0 cm /Im0 Do Q`;

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(() => push('<< /Type /Catalog /Pages 2 0 R >>'));
  object(() => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  object(() =>
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] ` +
        '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    ),
  );
  object(() => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    push('\nendstream');
  });
  object(() => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));

  const xref = length;
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) {
    push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const pdf = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, position);
    position += chunk.length;
  }
  return pdf;
}
