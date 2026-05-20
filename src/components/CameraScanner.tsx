import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

export function CameraScanner({
  onScan,
  continuous = false,
  onClose,
}: {
  onScan: (text: string) => void;
  continuous?: boolean;
  onClose?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const lastScannedRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | null = null;
    (async () => {
      try {
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
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
  }, [onScan, continuous]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="border-2 border-primary/80 rounded-lg w-2/3 h-1/2" />
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
          <Camera className="h-3 w-3" /> Pointez vers un QR code ou code-barres
        </p>
      )}
    </div>
  );
}
