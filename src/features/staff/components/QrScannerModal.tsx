import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import {
  Camera,
  X,
  RefreshCw,
  Upload,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Store,
  ArrowRight
} from "lucide-react";
import { RestaurantTenant } from "../../shared/types";
import { toast } from "../../shared/services/toast";
import { Dialog } from "../../shared/components/ui/Dialog";
import { InputField } from "../../shared/components/ui/FormControls";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestaurantSelected: (tenant: RestaurantTenant, qrToken?: string) => void;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onRestaurantSelected
}: QrScannerModalProps) {
  const [activeMode, setActiveMode] = useState<"camera" | "manual" | "upload">("camera");
  const [cameraError, setCameraError] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState("");
  useEffect(() => { if (isOpen) setConnectionError(""); }, [isOpen]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream helper
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Start camera stream & continuous QR scanning loop
  const startCamera = async () => {
    setCameraError("");
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setIsScanning(true);
        requestAnimationFrame(tick);
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      setCameraError(
        "Camera access not allowed or unavailable. You can enter Store Code manually below or upload a QR image."
      );
      setActiveMode("manual");
    }
  };

  useEffect(() => {
    if (isOpen && activeMode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode]);

  // Scan frame from video
  const tick = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    const video = videoRef.current;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });

    if (code && code.data) {
      handleQrFound(code.data);
    } else {
      animationFrameRef.current = requestAnimationFrame(tick);
    }
  };

  // Process decoded QR payload
  const handleQrFound = async (dataString: string) => {
    stopCamera();
    try {
      let tenantQuery = "";
      let qrToken = "";

      // Check if it's a full URL
      if (dataString.includes("http://") || dataString.includes("https://") || dataString.includes("?")) {
        try {
          const parsedUrl = new URL(dataString);
          tenantQuery =
            parsedUrl.searchParams.get("tenant") ||
            parsedUrl.searchParams.get("tenantId") ||
            parsedUrl.searchParams.get("store") ||
            parsedUrl.searchParams.get("business") ||
            "";
          qrToken = parsedUrl.searchParams.get("token") || "";
        } catch (e) {
          // If URL parsing fails, extract via regex
          const match = dataString.match(/tenant=([^&]+)/);
          if (match) tenantQuery = decodeURIComponent(match[1]);
          const tokenMatch = dataString.match(/token=([^&]+)/);
          if (tokenMatch) qrToken = decodeURIComponent(tokenMatch[1]);
        }
      } else {
        // Plain text store code or tenant ID
        tenantQuery = dataString.trim();
      }

      if (!tenantQuery) {
        setConnectionError("Invalid QR code format. Please scan a valid Staff Login QR.");
        toast.error("Invalid QR code format. Please scan a valid Staff Login QR.");
        startCamera();
        return;
      }

      await fetchAndConnectTenant(tenantQuery, qrToken);
    } catch (e: any) {
      setConnectionError(e.message || "Failed to parse QR Code");
      toast.error(e.message || "Failed to parse QR Code");
      startCamera();
    }
  };

  // Fetch restaurant details from server
  const fetchAndConnectTenant = async (query: string, qrToken?: string) => {
    setConnectionError("");
    setIsSearching(true);
    try {
      const res = await fetch(`/api/auth/tenant-info?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.tenant) {
        throw new Error(data.error || `Restaurant outlet "${query}" not found.`);
      }

      toast.success(`🎉 Connected to ${data.tenant.name}!`);
      onRestaurantSelected(data.tenant, qrToken);
      onClose();
    } catch (err: any) {
      setConnectionError(err.message || "Could not find restaurant.");
      toast.error(err.message || "Could not find restaurant.");
      if (activeMode === "camera") {
        startCamera();
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Manual Store Code Form Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    fetchAndConnectTenant(manualCode.trim());
  };

  // Handle QR image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConnectionError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          handleQrFound(code.data);
        } else {
          setConnectionError("No valid QR Code found in image. Please try another photo.");
          toast.error("No valid QR Code found in image. Please try another photo.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}
      title="Scan Staff QR Code" description="Connect using a QR image or your store code."
      className="max-w-md"
      footer={<p className="text-xs text-slate-600">Staff sign in with their PIN to open their work screen.</p>}>
      <div className="space-y-4">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1" aria-label="Connection method">
          <button type="button" aria-pressed={activeMode === "camera"} onClick={() => { setConnectionError(""); setActiveMode("camera"); }}
            className={`min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-bold flex items-center justify-center gap-1 ${activeMode === "camera" ? "bg-app-primary text-white" : "text-slate-700 hover:bg-white"}`}>
            <Camera aria-hidden="true" className="h-4 w-4 shrink-0" /><span>Camera Scan</span>
          </button>
          <button type="button" aria-pressed={activeMode === "manual"} onClick={() => { setConnectionError(""); setActiveMode("manual"); }}
            className={`min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-bold flex items-center justify-center gap-1 ${activeMode === "manual" ? "bg-app-primary text-white" : "text-slate-700 hover:bg-white"}`}>
            <Keyboard aria-hidden="true" className="h-4 w-4 shrink-0" /><span>Store Code</span>
          </button>
          <button type="button" aria-pressed={activeMode === "upload"} onClick={() => { setConnectionError(""); setActiveMode("upload"); fileInputRef.current?.click(); }}
            className={`min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-bold flex items-center justify-center gap-1 ${activeMode === "upload" ? "bg-app-primary text-white" : "text-slate-700 hover:bg-white"}`}>
            <Upload aria-hidden="true" className="h-4 w-4 shrink-0" /><span>Gallery</span>
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" aria-label="Choose QR image" className="hidden" onChange={handleFileUpload} />
        {cameraError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{cameraError}</p>}
        {activeMode === "camera" && (
          <div className="space-y-3 text-center">
            <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl bg-slate-950">
              <video ref={videoRef} aria-label="Live QR camera" className="h-full w-full object-cover" autoPlay muted playsInline />
              {isSearching && <div role="status" className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4 text-sm text-white">Connecting to restaurant...</div>}
            </div>
            <p className="text-sm text-slate-600">Point the camera at your restaurant’s Staff Login QR.</p>
          </div>
        )}
        {activeMode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <InputField id="manual-store-code-input" label="Store code or restaurant name" required
              placeholder="Enter code or restaurant name" value={manualCode}
              onChange={(event) => setManualCode(event.target.value)} error={connectionError || undefined} />
            <button type="submit" disabled={isSearching || !manualCode.trim()} className="min-h-11 w-full rounded-xl bg-app-primary px-4 py-3 text-sm font-bold text-white hover:bg-app-primary-hover disabled:bg-slate-200 disabled:text-slate-600">
              {isSearching ? "Searching Outlet..." : "Connect to Restaurant"}
            </button>
          </form>
        )}
        {activeMode === "upload" && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-slate-600">Choose a photo containing your store QR code.</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100">Choose Photo from Device</button>
          </div>
        )}
        {connectionError && activeMode !== "manual" && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{connectionError}</p>}
      </div>
    </Dialog>
  );
}
