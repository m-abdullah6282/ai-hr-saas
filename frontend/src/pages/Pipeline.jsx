import { useCallback, useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useParams } from "react-router-dom";
import client from "../api/client.js";

// Kanban columns — backend status values ke order mein
const COLUMNS = [
  { id: "applied", label: "Applied" },
  { id: "screened", label: "Screened" },
  { id: "interview", label: "Interview" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
];

// AI score ke hisaab se badge ka color
function scoreClasses(score) {
  if (score == null) return "bg-slate-100 text-slate-500";
  if (score > 70) return "bg-green-100 text-green-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

export default function Pipeline() {
  const { jobId } = useParams();

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzingId, setAnalyzingId] = useState(null);
  const [expandedReasoning, setExpandedReasoning] = useState({});
  const [rejectingId, setRejectingId] = useState(null);

  // Candidates fetch karo. setState sirf promise callbacks (then/catch/finally)
  // mein hota hai — isliye React lint rule (sync setState in effect) pass hota hai.
  const fetchCandidates = useCallback(() => {
    client
      .get("/candidates", { params: { job_id: jobId } })
      .then((res) => {
        setCandidates(res.data);
        setError("");
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || "Failed to load candidates.");
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Candidates ko column-wise group karo aur ai_score ke hisaab se
  // descending sort karo (jinka score null hai wo last).
  const columns = useMemo(() => {
    const groups = { applied: [], screened: [], interview: [], hired: [], rejected: [] };
    candidates.forEach((c) => {
      const key = groups[c.status] ? c.status : "applied";
      groups[key].push(c);
    });
    COLUMNS.forEach((col) => {
      groups[col.id].sort((a, b) => (b.ai_score ?? -1) - (a.ai_score ?? -1));
    });
    return groups;
  }, [candidates]);

  // AI analyze karo (score + reasoning backend se)
  const handleAnalyze = async (candidate) => {
    setAnalyzingId(candidate.id);
    setError("");
    try {
      const res = await client.post(`/candidates/${candidate.id}/analyze`);
      setCandidates((prev) => prev.map((c) => (c.id === candidate.id ? res.data : c)));
    } catch (err) {
      setError(err?.response?.data?.detail || "Analysis failed. Please try again.");
    } finally {
      setAnalyzingId(null);
    }
  };

  // Candidate ko reject karo (status -> rejected)
  const handleReject = async (candidate) => {
    setRejectingId(candidate.id);
    setError("");
    try {
      const res = await client.patch(`/candidates/${candidate.id}/status`, {
        status: "rejected",
      });
      setCandidates((prev) => prev.map((c) => (c.id === candidate.id ? res.data : c)));
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not reject candidate.");
    } finally {
      setRejectingId(null);
    }
  };

  // ai_reasoning ka expand/collapse toggle
  const toggleReasoning = (id) => {
    setExpandedReasoning((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Drag khatam hone par status update karo (optimistic)
  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;

    // Pehle UI mein turant update (smooth feel)
    setCandidates((prev) =>
      prev.map((c) => (c.id === draggableId ? { ...c, status: newStatus } : c))
    );

    // Backend ko persist karo; fail ho to wapas revert
    client
      .patch(`/candidates/${draggableId}/status`, { status: newStatus })
      .catch(() => {
        setCandidates((prev) =>
          prev.map((c) => (c.id === draggableId ? { ...c, status: source.droppableId } : c))
        );
        setError("Could not update candidate status.");
      });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drag candidates between stages to move them through the pipeline
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Loading candidates...
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-5 gap-4">
            {COLUMNS.map((col) => (
              <Droppable key={col.id} droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-xl border bg-slate-100/80 p-3 transition ${
                      snapshot.isDraggingOver ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200"
                    }`}
                  >
                    {/* Column header */}
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2 className="text-sm font-semibold text-slate-700">{col.label}</h2>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                        {columns[col.id].length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {columns[col.id].map((candidate, index) => (
                        <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${
                                snapshot.isDragging ? "shadow-lg ring-2 ring-indigo-300" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {candidate.name}
                                  </p>
                                  <p className="truncate text-xs text-slate-500">
                                    {candidate.email}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <a
                                    href={`mailto:${candidate.email}?subject=${encodeURIComponent(
                                      "Regarding your application"
                                    )}`}
                                    title={`Email ${candidate.name}`}
                                    className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-4 w-4"
                                    >
                                      <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
                                      <path d="M19 8.839 11.386 13.4a2.75 2.75 0 0 1-2.772 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
                                    </svg>
                                  </a>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreClasses(
                                      candidate.ai_score
                                    )}`}
                                  >
                                    {candidate.ai_score != null ? candidate.ai_score : "—"}
                                  </span>
                                </div>
                              </div>

                              {candidate.ai_reasoning && (
                                <div className="mt-2">
                                  <p
                                    className={`text-xs leading-snug text-slate-500 ${
                                      expandedReasoning[candidate.id] ? "" : "line-clamp-2"
                                    }`}
                                  >
                                    {candidate.ai_reasoning}
                                  </p>
                                  {candidate.ai_reasoning.length > 120 && (
                                    <button
                                      onClick={() => toggleReasoning(candidate.id)}
                                      className="mt-0.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                    >
                                      {expandedReasoning[candidate.id] ? "Show less" : "Show more"}
                                    </button>
                                  )}
                                </div>
                              )}

                              <div className="mt-3 flex items-center gap-2">
                                {candidate.resume_url && (
                                  <a
                                    href={candidate.resume_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                  >
                                    Resume
                                  </a>
                                )}
                                {candidate.status !== "rejected" && (
                                  <button
                                    onClick={() => handleReject(candidate)}
                                    disabled={rejectingId === candidate.id}
                                    className="ml-auto rounded-md border border-red-200 px-2 py-0.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-60"
                                  >
                                    {rejectingId === candidate.id ? "Rejecting..." : "Reject"}
                                  </button>
                                )}
                                {candidate.ai_score == null && (
                                  <button
                                    onClick={() => handleAnalyze(candidate)}
                                    disabled={analyzingId === candidate.id}
                                    className="ml-auto rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                                  >
                                    {analyzingId === candidate.id ? "Analyzing..." : "Analyze"}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Empty state */}
      {!loading && candidates.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-medium text-slate-700">No candidates yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Share the job link to start receiving applications.
          </p>
        </div>
      )}
    </div>
  );
}