"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Folder } from "lucide-react";
import { AnimatedGroup } from "@/components/ui/animated-group";
import Webcam from "react-webcam";

/* ------------------------------------------------------------------
   Utility: Convert base64 string to a Blob
------------------------------------------------------------------ */
const base64ToBlob = (base64: string) => {
  const parts = base64.split(",");
  const byteString = atob(parts[1]);
  const mimeString = parts[0].match(/:(.*?);/)![1];

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

/* ------------------------------------------------------------------
   MobileCamera Component with toggle for camera facing mode
------------------------------------------------------------------ */
function MobileCamera({ onCapture }: { onCapture: (data: Blob | string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        activeStream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
        setStream(mediaStream);
      } catch (error) {
        console.error("Error accessing mobile camera:", error);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");
      onCapture(imageData);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          maxWidth: "400px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          marginBottom: "0.5rem",
          transform: "translateZ(0)",
        }}
      />
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
        <Button onClick={capturePhoto}>Capture Photo</Button>
        <Button onClick={toggleCamera}>Switch Camera</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   DesktopCamera Component using react-webcam
------------------------------------------------------------------ */
function DesktopCamera({ onCapture }: { onCapture: (data: Blob | string) => void }) {
  const webcamRef = useRef<Webcam>(null);
  const [showWebcam, setShowWebcam] = useState(false);

  const capturePhoto = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {showWebcam ? (
        <>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="rounded-lg border"
          />
          <Button onClick={capturePhoto} size="lg">
            Capture Photo
          </Button>
          <Button onClick={() => setShowWebcam(false)} variant="ghost" size="sm">
            Close Webcam
          </Button>
        </>
      ) : (
        <Button onClick={() => setShowWebcam(true)} size="lg">
          <Camera className="size-6" />
          <span>Open Webcam</span>
        </Button>
      )}
      <Button asChild size="lg" variant="outline">
        <label className="flex items-center gap-2 cursor-pointer">
          <Folder className="size-6" aria-hidden />
          <span>Upload a photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) {
                // Pass the actual file object to onCapture
                onCapture(file);
              }
            }}
            className="hidden"
          />
        </label>
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------
   Main Analyse Component with Client-Only Device Detection
------------------------------------------------------------------ */
export default function Analyse() {
  const [isMobileDevice, setIsMobileDevice] = useState<boolean | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent || "";
    setIsMobileDevice(/iPhone|iPad|iPod|Android/i.test(userAgent));
  }, []);

  const handleImageUpload = async (image: Blob | string) => {
    const formData = new FormData();
    if (typeof image === "string") {
      if (image.startsWith("data:")) {
        const blob = base64ToBlob(image);
        formData.append("image", blob, "captured.jpg");
      } else {
        // Non-data URL strings are not expected now
        formData.append("imageUrl", image);
      }
    } else {
      formData.append("image", image);
    }
    const apiEndpoint =
      typeof window !== "undefined" ? `${window.location.origin}/api/upload` : "/api/upload";
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload error", response.status, errorText);
        return;
      }
      const data = await response.json();
      console.log("Server response:", data);
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  // Unified capture handler that supports both base64 strings and file objects
  const handleCapture = (data: Blob | string) => {
    if (typeof data === "string") {
      setScreenshot(data);
      handleImageUpload(data);
    } else {
      const previewUrl = URL.createObjectURL(data);
      setScreenshot(previewUrl);
      handleImageUpload(data);
    }
  };

  const handleMobileFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setScreenshot(previewUrl);
      handleImageUpload(file);
    }
  };

  if (isMobileDevice === null) {
    return (
      <AnimatedGroup>
        <section className="py-16 md:py-32">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center">Loading camera...</div>
          </div>
        </section>
      </AnimatedGroup>
    );
  }

  return (
    <AnimatedGroup>
      <section className="py-16 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
              It's time to get cookin'
            </h2>
            <p className="mt-4">
              Please provide us with a photo of your fridge so we can start our analysis.
            </p>
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {isMobileDevice ? (
                <>
                  <MobileCamera onCapture={handleCapture} />
                  <Button asChild size="lg" variant="outline">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Folder className="size-6" aria-hidden />
                      <span>Or Upload a photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleMobileFile}
                        className="hidden"
                      />
                    </label>
                  </Button>
                </>
              ) : (
                <DesktopCamera onCapture={handleCapture} />
              )}
            </div>
            {screenshot && (
              <div className="mt-8">
                <h3 className="text-lg font-medium">Captured Image:</h3>
                <img src={screenshot} alt="Captured" className="mt-4 rounded-lg border" />
              </div>
            )}
          </div>
        </div>
      </section>
    </AnimatedGroup>

  );
}
