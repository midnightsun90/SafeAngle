import { notFound } from "next/navigation";
import QuestionFlow from "@/components/QuestionFlow";
import type { VideoNumber } from "@/components/VideoFilesProvider";
import type { QuestionGroup } from "@/lib/questions";

export const dynamicParams = false;

export function generateStaticParams() {
  return [1, 2, 3].flatMap((video) => [1, 2, 3, 4].map((group) => ({ video: String(video), group: String(group) })));
}

export default async function QuestionPage({ params }: { params: Promise<{ video: string; group: string }> }) {
  const { video, group } = await params;
  const videoNumber = Number(video);
  const groupNumber = Number(group);
  if (![1, 2, 3].includes(videoNumber) || ![1, 2, 3, 4].includes(groupNumber)) notFound();
  return <QuestionFlow videoNumber={videoNumber as VideoNumber} groupNumber={groupNumber as QuestionGroup} />;
}
