import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

export default function ManagerReadinessPage() {
  const { userProfile } = useAuth();
  const [managerName, setManagerName] = useState("Juan");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchManagerName() {
      if (!userProfile?.org_id) return;
      const { data } = await supabase
        .from("orgs")
        .select("manager_name")
        .eq("id", userProfile.org_id)
        .single();
      if (data?.manager_name) {
        setManagerName(data.manager_name);
      }
      setLoading(false);
      logger.info("readiness_page_loaded", { orgId: userProfile.org_id });
    }
    fetchManagerName();
  }, [userProfile?.org_id]);

  if (loading) {
    return <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-600">
        Is {managerName} Ready?
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Track readiness across paperwork, training, skills, and on-the-job tasks.
      </p>
    </div>
  );
}
