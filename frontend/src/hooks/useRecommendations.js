/**
 * hooks/useRecommendations.js
 * Custom hook: fetches recommendations + SHAP data for a student.
 * Returns { data, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from "react";
import { getRecommendations } from "../services/api";

export function useRecommendations(studentId, topN = 5) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRecommendations(studentId, topN);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [studentId, topN]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
