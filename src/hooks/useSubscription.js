import { useState, useCallback, useEffect } from "react";
import { FREE_UPLOAD_LIMIT, TRIAL_DAYS } from "../config/constants";
import { storageGet, storageSet } from "../utils/storage";

export function useSubscription() {
  const [plan, setPlan] = useState("free");
  const [uploadsUsed, setUploadsUsed] = useState(0);
  const [trialStart, setTrialStart] = useState(null);
  const [billingCycle, setBillingCycle] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await storageGet("readflow-sub");
      if (val) {
        try {
          const d = JSON.parse(val);
          setPlan(d.plan || "free");
          setTrialStart(d.trialStart || null);
          setBillingCycle(d.billingCycle || null);
          if (d.uploads?.month === new Date().getMonth()) setUploadsUsed(d.uploads.count);
        } catch {}
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storageSet("readflow-sub", JSON.stringify({
      plan, trialStart, billingCycle,
      uploads: { month: new Date().getMonth(), count: uploadsUsed },
    }));
  }, [plan, trialStart, billingCycle, uploadsUsed, loaded]);

  const isPro = plan === "pro" || plan === "trial";
  const isTrial = plan === "trial";
  const trialDaysLeft = isTrial && trialStart
    ? Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - trialStart) / 86400000)) : 0;

  useEffect(() => {
    if (loaded && isTrial && trialDaysLeft === 0) { setPlan("pro"); setTrialStart(null); }
  }, [loaded, isTrial, trialDaysLeft]);

  const canUpload = isPro || uploadsUsed < FREE_UPLOAD_LIMIT;
  const recordUpload = useCallback(() => { if (!isPro) setUploadsUsed(p => p + 1); }, [isPro]);
  const startTrial = useCallback((billing) => { setPlan("trial"); setTrialStart(Date.now()); setBillingCycle(billing); }, []);
  const activatePro = useCallback((billing) => { setPlan("pro"); setBillingCycle(billing); }, []);
  const cancelTrial = useCallback(() => { setPlan("free"); setTrialStart(null); setBillingCycle(null); }, []);

  return { plan, isPro, isTrial, trialDaysLeft, billingCycle, uploadsUsed, canUpload, loaded, recordUpload, startTrial, activatePro, cancelTrial };
}
