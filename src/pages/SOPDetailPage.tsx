import { useParams } from "react-router-dom";

export default function SOPDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="font-display text-2xl font-600">SOP Detail</h1>
      <p className="mt-1 text-sm text-text-muted">/sops/{id}</p>
    </div>
  );
}
