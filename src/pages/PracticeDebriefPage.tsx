import { useParams } from "react-router-dom";

export default function PracticeDebriefPage() {
  const { scenarioId } = useParams();
  return (
    <div>
      <h1 className="font-display text-2xl font-600">Practice Debrief</h1>
      <p className="mt-1 text-sm text-text-muted">/practice/{scenarioId}/debrief</p>
    </div>
  );
}
