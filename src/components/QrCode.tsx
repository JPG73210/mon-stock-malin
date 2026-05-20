import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      QRCode.toCanvas(ref.current, value, { width: size, margin: 1 }).catch(() => {});
    }
  }, [value, size]);
  return <canvas ref={ref} className="rounded-md bg-card" />;
}

export async function qrDataUrl(value: string, size = 256) {
  return QRCode.toDataURL(value, { width: size, margin: 1 });
}
