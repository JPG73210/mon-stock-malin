import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";
import pkg from "@zxing/library";
const { DecodeHintType } = pkg;
type DecodeHintType = typeof DecodeHintType[keyof typeof DecodeHintType];
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
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    type NativeBarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
    };

    const nativeFormats = formats === "qr"
      ? ["qr_code"]
      : formats === "barcode"
        ? ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"]
        : ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"];

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
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 180,
      delayBetweenScanSuccess: 900,
      tryPlayVideoTimeout: 3000,
    });
    let controls: { stop: () => void } | null = null;
    let stopped = false;
    let stream: MediaStream | null = null;
    let nativeTimer: number | null = null;
    let nativeBusy = false;

    const emitScan = (text: string) => {
      const now = Date.now();
      if (continuous) {
        if (text === lastScannedRef.current && now - lastTimeRef.current < 1500) return;
        lastScannedRef.current = text;
        lastTimeRef.current = now;
        onScanRef.current(text);
        return;
      }
      controls?.stop();
      if (nativeTimer) window.clearInterval(nativeTimer);
      stream?.getTracks().forEach((t) => t.stop());
      onScanRef.current(text);
    };

    (async () => {
      try {
        setError(null);
        const video = videoRef.current;
        if (!video) return;
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 1.777777778 },
          },
        };
        controls = await reader.decodeFromConstraints(constraints, video, (result, decodeError) => {
          if (result) {
            emitScan(result.getText());
            return;
          }
          const isNotFound = typeof decodeError?.name === "string"
            && decodeError.name.includes("NotFoundException");
          if (decodeError && !isNotFound) {
            console.warn("Scanner decode warning", decodeError);
          }
        });
        stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
        if (stopped) {
          controls.stop();
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }

        // Best-effort continuous autofocus
        const track = stream?.getVideoTracks()[0];
        if (track) {
          const caps: any = track.getCapabilities?.() ?? {};
          const advanced: any[] = [];
          if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
          if (caps.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
          if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
          if (advanced.length) {
            try { await track.applyConstraints({ advanced } as any); } catch { /* noop */ }
          }
        }

        const NativeBarcodeDetector = (globalThis as typeof globalThis & {
          BarcodeDetector?: NativeBarcodeDetectorCtor;
        }).BarcodeDetector;

        if (NativeBarcodeDetector) {
          try {
            const detector = new NativeBarcodeDetector({ formats: nativeFormats });
            nativeTimer = window.setInterval(async () => {
              if (stopped || nativeBusy || !videoRef.current) return;
              const activeVideo = videoRef.current;
              if (activeVideo.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
              try {
                nativeBusy = true;
                const results = await detector.detect(activeVideo);
                const raw = results.find((item) => item.rawValue?.trim())?.rawValue?.trim();
                if (raw) emitScan(raw);
              } catch {
                /* fallback to ZXing below */
              } finally {
                nativeBusy = false;
              }
            }, 250);
          } catch {
            /* fallback to ZXing below */
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Impossible d'accéder à la caméra");
      }
    })();
    return () => {
      stopped = true;
      if (nativeTimer) window.clearInterval(nativeTimer);
      controls?.stop();
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [continuous, formats]);



  const frameClass = formats === "barcode"
    ? "border-2 border-primary/80 rounded-lg w-4/5 h-1/4"
    : "border-2 border-primary/80 rounded-lg w-2/3 h-2/3 max-h-[80%] aspect-square";

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
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
