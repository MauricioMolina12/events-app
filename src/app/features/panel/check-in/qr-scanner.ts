/**
 * Camera QR reader.
 *
 * Uses the native `BarcodeDetector` where it exists (Chrome on Android, Edge) and falls
 * back to `jsqr` on a downscaled canvas frame elsewhere (Safari, Firefox). `jsqr` is
 * imported lazily so it only ships to the door staff that actually opens the scanner.
 */

export type ScannerFailure = 'denied' | 'unavailable';

export interface QrScanner {
  stop(): void;
}

interface DetectedBarcode {
  readonly rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorStatic {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

type FrameDecoder = (video: HTMLVideoElement) => Promise<string | null>;

const SCAN_INTERVAL_MS = 140;
const FALLBACK_FRAME_WIDTH = 640;

export class ScannerError extends Error {
  constructor(readonly reason: ScannerFailure) {
    super(reason);
  }
}

export async function startQrScanner(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<QrScanner> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ScannerError('unavailable');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    throw new ScannerError(
      name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable',
    );
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = (): void => {
    stopped = true;
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  try {
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('playsinline', '');
    await video.play();
  } catch {
    stop();
    throw new ScannerError('unavailable');
  }

  const decode = await createDecoder();

  const tick = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const code = await decode(video).catch(() => null);
      if (stopped) {
        return;
      }
      if (code) {
        stop();
        onCode(code);
        return;
      }
    }
    timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
  };
  void tick();

  return { stop };
}

async function createDecoder(): Promise<FrameDecoder> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorStatic }).BarcodeDetector;
  if (Detector) {
    const formats = await Detector.getSupportedFormats().catch(() => [] as string[]);
    if (formats.includes('qr_code')) {
      const detector = new Detector({ formats: ['qr_code'] });
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
    }
  }

  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  return async (video) => {
    if (!context || video.videoWidth === 0) {
      return null;
    }
    const scale = Math.min(1, FALLBACK_FRAME_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}
