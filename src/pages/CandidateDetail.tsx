import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { CandidateDetailPanel } from "../components/candidates/CandidateDetailPanel";
import { PageLoader } from "../components/common/Spinner";
import { useCandidate } from "../hooks/useQueries";

export function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: candidate, isLoading } = useCandidate(id);

  if (isLoading || !candidate) return <PageLoader label="Loading candidate…" />;

  return (
    <div className="px-6 pt-4">
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/candidates"))}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
          <CandidateDetailPanel candidateId={candidate.id} onClose={() => navigate(-1)} />
        </div>
      </div>
    </div>
  );
}