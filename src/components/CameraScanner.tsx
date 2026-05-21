import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

export type ScanFormats = "qr" | "barcode" | "all";

export function CameraScanner({
  onScan,
  continuous = false,
  onClose,
  formats = "all",
}: {
  onScan: (text: string) => void;
  continuous?: boolean;
  onClose?: () => void;
  formats?: ScanFormats;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const lastScannedRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const hints = new Map<DecodeHintType, unknown>();
    if (formats === "qr") {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    } else if (formats === "barcode") {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
        BarcodeFormat.ITF, BarcodeFormat.CODABAR,
      ]);
    }
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);
    let controls: { stop: () => void } | null = null;
    (async () => {
      try {
        // Prefer rear camera on phones
        const devices = await BrowserMultiFormatReader.listVideoInputDevices().catch(() => []);
        const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
        controls = await reader.decodeFromVideoDevice(rear?.deviceId, videoRef.current!, (result) => {
          if (result) {
            const text = result.getText();
            const now = Date.now();
            if (continuous) {
              if (text === lastScannedRef.current && now - lastTimeRef.current < 1500) return;
              lastScannedRef.current = text;
              lastTimeRef.current = now;
              onScan(text);
            } else {
              controls?.stop();
              onScan(text);
            }
          }
        });
      } catch (e: any) {
        setError(e?.message ?? "Impossible d'accéder à la caméra");
      }
    })();
    return () => { controls?.stop(); };
  }, [onScan, continuous, formats]);

  const frameClass = formats === "barcode"
    ? "border-2 border-primary/80 rounded-lg w-4/5 h-1/4"
    : "border-2 border-primary/80 rounded-lg w-2/3 h-2/3 max-h-[80%] aspect-square";

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={frameClass} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {onClose && (
        <Button variant="outline" onClick={onClose} className="w-full">
          <X className="mr-2 h-4 w-4" /> Fermer la caméra
        </Button>
      )}
      {!error && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Camera className="h-3 w-3" />
          {formats === "qr" && "Pointez vers un QR code"}
          {formats === "barcode" && "Pointez vers un code-barres"}
          {formats === "all" && "Pointez vers un QR code ou code-barres"}
        </p>
      )}
    </div>
  );
}
