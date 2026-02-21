export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[520px] text-center">
        <h1 className="font-display text-3xl font-700 tracking-tight">
          <span className="text-text">EZ</span>
          <span className="text-primary">SOP</span>
        </h1>
        <h2 className="mt-6 font-display text-2xl font-600">Business Profile Setup</h2>
        <p className="mt-2 text-sm text-text-muted">/onboarding</p>
        <p className="mt-4 text-sm text-text-muted">
          This wizard will help you set up your organization. Coming soon.
        </p>
      </div>
    </div>
  );
}
