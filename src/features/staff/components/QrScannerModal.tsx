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
        toast.error("Invalid QR code format. Please scan a valid Staff Login QR.");
        startCamera();
        return;
      }

      await fetchAndConnectTenant(tenantQuery, qrToken);
    } catch (e: any) {
      toast.error(e.message || "Failed to parse QR Code");
      startCamera();
    }
  };

  // Fetch restaurant details from server
  const fetchAndConnectTenant = async (query: string, qrToken?: string) => {
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
          toast.error("No valid QR Code found in image. Please try another photo.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white leading-tight">
                Scan Staff QR Code
              </h2>
              <p className="text-[11px] text-slate-400">
                रेस्टोरेंट से जुड़ने के लिए QR स्कैन करें
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-2 bg-slate-950 border-b border-slate-800/80 flex gap-1">
          <button
            onClick={() => setActiveMode("camera")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === "camera"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scan</span>
          </button>
          <button
            onClick={() => setActiveMode("manual")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === "manual"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Store Code</span>
          </button>
          <button
            onClick={() => {
              setActiveMode("upload");
              fileInputRef.current?.click();
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === "upload"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Gallery</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-200">
          {activeMode === "camera" && (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-full aspect-square max-w-[280px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />

                {/* Reticle / Target Scanner UI */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-48 h-48 border-2 border-indigo-400/80 rounded-2xl relative shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                    {/* Laser scanning line */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" />
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
                  </div>
                </div>

                {isSearching && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center space-y-2 text-white">
                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                    <span className="text-xs font-bold">Connecting to restaurant...</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-slate-400 max-w-xs">
                अपने ओनर के डिवाइस या स्टैंडी पर लगे <b>Staff Login QR</b> को कैमरे के सामने लाएं।
              </p>

              {cameraError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}

          {activeMode === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Restaurant Outlet / Store Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. veg-yashikarestaurant-805 or yashika"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-mono"
                    id="manual-store-code-input"
                  />
                  <Store className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                </div>
                <p className="text-[11px] text-slate-500">
                  यह कोड आपके ओनर के ऐप में <b>Staff QR Modal</b> या सेटिंग्स में लिखा होता है।
                </p>
              </div>

              <button
                type="submit"
                disabled={isSearching || !manualCode.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching Outlet...</span>
                  </>
                ) : (
                  <>
                    <span>Connect to Restaurant</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {activeMode === "upload" && (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300">
                Gallery se QR code photo chunein
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Choose Photo from Device
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-center">
          <p className="text-[11px] text-slate-500">
            कर्मचारी PIN से लॉगिन होकर सीधे अपने रोल (Waiter, Chef, Cashier) का काम कर सकते हैं।
          </p>
        </div>
      </div>
    </div>
  );
}
