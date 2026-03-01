import { Link } from "react-router-dom";
import { useCreateSOP } from "../contexts/CreateSOPContext";

export default function DashboardPage() {
  const { openCreateSOP } = useCreateSOP();

  return (
    <div>
      {/* Greeting */}
      <div className="mb-10 text-center">
        <h1 className="text-[32px] font-900">Welcome back! 👋</h1>
        <p className="mt-2 text-lg text-text-muted">What would you like to do today?</p>
      </div>

      {/* Action cards */}
      <div className="mx-auto mb-12 grid max-w-[750px] grid-cols-3 gap-6">
        {/* Create New SOP */}
        <button
          type="button"
          onClick={() => openCreateSOP()}
          className="rounded-[16px] border-[3px] border-card-border bg-card px-6 py-10 text-center transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="text-[56px] leading-none mb-4">📝</div>
          <h2 className="text-[20px] font-800 mb-2">Create a New SOP</h2>
          <p className="text-[14px] text-text-muted leading-relaxed">We'll walk you through it step by step.</p>
        </button>

        {/* My SOPs */}
        <Link
          to="/sops"
          className="rounded-[16px] border-[3px] border-card-border bg-card px-6 py-10 text-center transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="text-[56px] leading-none mb-4">📚</div>
          <h2 className="text-[20px] font-800 mb-2">My SOPs</h2>
          <p className="text-[14px] text-text-muted leading-relaxed">View, edit, or rearrange your procedures.</p>
        </Link>

        {/* Is Juan Ready? */}
        <Link
          to="/readiness"
          className="rounded-[16px] border-[3px] border-card-border bg-card px-6 py-10 text-center transition-all hover:border-primary hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="text-[56px] leading-none mb-4">✅</div>
          <h2 className="text-[20px] font-800 mb-2">Is Juan Ready?</h2>
          <p className="text-[14px] text-text-muted leading-relaxed">Track your manager's training progress.</p>
        </Link>
      </div>

      {/* What is an SOP? explainer */}
      <div className="mx-auto max-w-[750px] rounded-[12px] border-2 border-[#b6d4fe] bg-primary-light px-8 py-6">
        <h3 className="text-lg font-800 text-primary mb-2">💡 What is an SOP?</h3>
        <p className="text-[15px] text-text leading-relaxed">
          An SOP (Standard Operating Procedure) is a <strong>written set of steps</strong> for how
          something gets done in your home — like giving medications, preparing meals, or handling
          emergencies. Having SOPs means <strong>anyone on your team can follow the same process</strong>,
          and your home stays compliant with Oregon rules.
        </p>
      </div>
    </div>
  );
}
