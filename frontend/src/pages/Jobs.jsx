import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client.js";

// Job card ke andar wali actions — copy link, view candidates, delete
export default function Jobs() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Jobs ki list fetch karo. setState sirf promise callbacks (then/catch/finally)
  // mein hota hai — isliye React lint rule (sync setState in effect) pass hota hai.
  const fetchJobs = useCallback(() => {
    client
      .get("/jobs")
      .then((res) => {
        setJobs(res.data);
        setError("");
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || "Failed to load jobs.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Naya job create karo
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      await client.post("/jobs", { title, description, requirements });
      // Form reset kar ke nayi list le lo
      setTitle("");
      setDescription("");
      setRequirements("");
      setShowForm(false);
      fetchJobs();
    } catch (err) {
      setFormError(err?.response?.data?.detail || "Failed to create job.");
    } finally {
      setCreating(false);
    }
  };

  // Job delete karo (confirm ke baad)
  const handleDelete = async (job) => {
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    setDeletingId(job.id);
    setError("");
    try {
      await client.delete(`/jobs/${job.id}`);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to delete job.");
    } finally {
      setDeletingId(null);
    }
  };

  // Shareable link copy karo (clipboard API)
  const handleCopyLink = async (job) => {
    const link = `${window.location.origin}/apply/${job.slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedSlug(job.id);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      setError("Could not copy link.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Post openings and share them with candidates
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ New Job"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* New job form (inline toggle) */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Create a new job</h2>
          {formError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="job-title" className="mb-1 block text-sm font-medium text-slate-700">
                Job title *
              </label>
              <input
                id="job-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label htmlFor="job-desc" className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                id="job-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will this role do?"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label htmlFor="job-req" className="mb-1 block text-sm font-medium text-slate-700">
                Requirements
              </label>
              <textarea
                id="job-req"
                rows={3}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Skills, experience, qualifications..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create job"}
            </button>
          </form>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Loading jobs...
        </div>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-medium text-slate-700">No jobs yet!</p>
          <p className="mt-1 text-sm text-slate-500">
            Click &quot;+ New Job&quot; to create your first opening.
          </p>
        </div>
      )}

      {/* Jobs list */}
      {!loading && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="truncate text-lg font-semibold text-slate-900">
                      {job.title}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        job.status === "open"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Posted {job.created_at ? new Date(job.created_at).toLocaleDateString() : "—"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(job)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    {copiedSlug === job.id ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    onClick={() => navigate(`/dashboard/jobs/${job.id}/candidates`)}
                    className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    View Candidates
                  </button>
                  <button
                    onClick={() => handleDelete(job)}
                    disabled={deletingId === job.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingId === job.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>

              {job.description && (
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{job.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}