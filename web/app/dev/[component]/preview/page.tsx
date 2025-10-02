"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Col } from "../../../components/Col";
import { Logomark } from "../../../components/Logomark";
import { Row } from "../../../components/Row";
import { View } from "../../../components/View";
import { Wordmark } from "../../../components/Wordmark";
import { StoryPlayerUI } from "../../../stories/[id]/StoryPlayerUI";

const components = {
  Col,
  Row,
  View,
  Logomark,
  Wordmark,
  StoryPlayerUI,
};

function ComponentPreview() {
  const params = useParams();
  const searchParams = useSearchParams();
  const componentName = params.component as string;

  const Component = components[componentName as keyof typeof components];

  if (!Component) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <p>Component "{componentName}" not found</p>
      </div>
    );
  }

  const props: Record<string, any> = {};
  searchParams.forEach((value, key) => {
    if (value === "true") props[key] = true;
    else if (value === "false") props[key] = false;
    else if (!isNaN(Number(value))) props[key] = Number(value);
    else props[key] = value;
  });

  return (
    <div>
      {/* @ts-ignore */}
      <Component {...props} />
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ComponentPreview />
    </Suspense>
  );
}
