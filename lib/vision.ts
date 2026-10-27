/** Opens the BACK camera for a few seconds (shown in the preview panel), then returns one JPEG (base64). */
export async function snap(video: HTMLVideoElement, seconds = 4): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  try {
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * scale);
    c.height = Math.round(video.videoHeight * scale);
    c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
}
