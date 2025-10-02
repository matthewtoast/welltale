"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ComponentViewer() {
  const params = useParams();
  const searchParams = useSearchParams();
  const componentName = params.component as string;

  const iframeUrl = `/dev/${componentName}/preview?${searchParams.toString()}`;

  return (
    <div style={{ padding: "32px" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              backgroundColor: "black",
              borderRadius: "48px",
              padding: "8px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                borderRadius: "32px",
                overflow: "hidden",
                border: "1px solid #1f2937",
              }}
            >
              <iframe
                src={iframeUrl}
                style={{ width: "375px", height: "812px", border: 0 }}
                title={`${componentName} preview`}
              />
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "128px",
              height: "4px",
              backgroundColor: "#1f2937",
              borderRadius: "9999px",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ComponentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ComponentViewer />
    </Suspense>
  );
}
