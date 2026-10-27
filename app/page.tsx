"use client";

import dynamic from "next/dynamic";

// The orb needs the browser (window, camera, WebGL), so never render it at build time.
const JarvisOrb = dynamic(() => import("@/components/JarvisOrb"), { ssr: false });

export default function Page() {
  return <JarvisOrb />;
}
