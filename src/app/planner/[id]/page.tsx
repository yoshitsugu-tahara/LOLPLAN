"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const Planner = dynamic(() => import("@/components/planner/Planner"), {
  ssr: false,
});

export default function PlannerBoardPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  if (!id) return null;
  return <Planner planId={id} />;
}
