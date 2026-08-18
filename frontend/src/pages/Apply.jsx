import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client.js";

// Public apply page — koi auth nahi. Job seekers /apply/:slug pe
// aate hain, job dekhte hain aur resume submit karte hain.
export default function Apply() {
  const { slug } = useParams();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [resume, setResume] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Mount pe job fetch karo (public slug endpoint)
  useEffect(() => {
    const loadJob = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await client.get(`/jobs/public/${slug}`);
        setJob(res.data);
      } catch (err) {
        setLoadError(err?.response?.data?.detail || "Job not found.");
      } finally {
        setLoading(false);
      }
    };
    loadJob();
  }, [slug]);

  // Form submit — multipart FormData banao aur public apply endpoint pe bhejo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!resume) {
      setFormError("Please attach your resume (PDF).");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("resume", resume);

    setSubmitting(true);
    try {
      await client.post(`/jobs/${slug}/apply`, formData);
      setSubmitted(true);
    } catch (err) {
      setFormError(err?.response?.data?.detail || "Application failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading job...</p>
      </div>
    );
  }

  // Job nahi mili ya closed — closed states dono yahan handle ho jate hain
  const jobUnavailable = loadError || !job || job.status !== "open";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Simple public header — candidate-facing, dashboard se alag */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              AI
            </div>
            <span className="font-semibold text-slate-900">HR Suite</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {jobUnavailable ? (
          // Job nahi mili / closed ho gayi
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">
              This job is no longer accepting applications
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              It may have been removed or the application window has closed.
            </p>
          </div>
        ) : submitted ? (
          // Successful submission
          <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
              ✓
            </div>
            <h1 className="text-xl font-bold text-slate-900">Application submitted!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Thanks {name}, your application for{" "}
              <span className="font-medium text-slate-700">{job.title}</span> has been
              received. We&apos;ll be in touch.
            </p>
          </div>
        ) : (
          <>
            {/* Job details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
              {job.status && (
                <span className="mt-2 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  {job.status}
                </span>
              )}
              {job.description && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {job.description}
                </p>
              )}
              {job.requirements && (
                <div className="mt-5">
                  <h2 className="text-sm font-semibold text-slate-900">Requirements</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {job.requirements}
                  </p>
                </div>
              )}
            </div>

            {/* Application form */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Apply now</h2>

              {formError && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="apply-name" className="mb-1 block text-sm font-medium text-slate-700">
                    Full name *
                  </label>
                  <input
                    id="apply-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label htmlFor="apply-email" className="mb-1 block text-sm font-medium text-slate-700">
                    Email *
                  </label>
                  <input
                    id="apply-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label htmlFor="apply-resume" className="mb-1 block text-sm font-medium text-slate-700">
                    Resume (PDF) *
                  </label>
                  <input
                    id="apply-resume"
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(e) => setResume(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit application"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}