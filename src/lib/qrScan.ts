import jsQR from "jsqr";

export function extractCertNumber(raw: string): string | null {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/psacard\.com\/cert\/(\d+)/i);
  if (urlMatch) return urlMatch[1];
  const digits = trimmed.match(/^\d{6,12}$/);
  if (digits) return digits[0];
  return null;
}

export interface ScanController {
  stop: () => void;
}

export async function startCertQrScan(
  video: HTMLVideoElement,
  onCert: (certNumber: string) => void,
  onError: (err: Error) => void,
): Promise<ScanController> {
  let stopped = false;
  let stream: MediaStream | null = null;
  let rafId = 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    stream?.getTracks().forEach((t) => t.stop());
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();
  } catch (e) {
    onError(e as Error);
    return { stop };
  }

  const tick = () => {
    if (stopped || !ctx) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code?.data) {
        const cert = extractCertNumber(code.data);
        if (cert) {
          stop();
          onCert(cert);
          return;
        }
      }
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return { stop };
}
