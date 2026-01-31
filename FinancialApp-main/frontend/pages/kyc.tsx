import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Sidebar';
import { useApiResource } from '../hooks/useApiResource';
import { apiRequest } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type KycStatusResponse = {
  userId: number;
  status: 'PENDING' | 'REVIEW' | 'VERIFIED' | 'REJECTED';
  documents: Array<{
    id: number;
    documentType: string;
    status: string;
    createdAt: string;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
  }>;
  documentsCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
};

type KycDocument = {
  id: number;
  documentType: string;
  status: string;
  documentNumber?: string;
  fileUrl?: string;
  createdAt: string;
};

const fallbackStatus: KycStatusResponse = {
  userId: 0,
  status: 'PENDING',
  documents: [],
  documentsCount: 0,
  approvedCount: 0,
  pendingCount: 0,
  rejectedCount: 0,
};

const statusStyles: Record<string, string> = {
  PENDING: 'badge-amber',
  REVIEW: 'badge-amber',
  VERIFIED: 'badge-green',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
};

export default function Kyc() {
  const { session, refresh } = useAuth();
  const { data: status, refresh: refreshStatus } = useApiResource<KycStatusResponse>({
    path: '/kyc/status',
    fallbackData: fallbackStatus,
  });
  const { refresh: refreshDocuments } = useApiResource<KycDocument[]>({
    path: '/kyc/documents',
    fallbackData: [],
  });
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'REVIEW' | 'APPROVED' | 'REJECTED'>('ALL');
  const [documentType, setDocumentType] = useState('PASSPORT');
  const [documentNumber, setDocumentNumber] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const steps = ['PENDING', 'REVIEW', 'VERIFIED'];
  const currentStepIndex = steps.indexOf(status?.status ?? 'PENDING');
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!session || !status?.status) return;
    if (session.user.kycStatus !== status.status && !hasSynced.current) {
      hasSynced.current = true;
      refresh();
    }
  }, [refresh, session, status?.status]);

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result?.toString() ?? '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });

  const filtered = useMemo(
    () =>
      (status?.documents ?? []).filter((doc) =>
        filter === 'ALL' ? true : doc.status === filter
      ),
    [filter, status]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    try {
      const filePayload =
        fileUpload
          ? {
              fileContentBase64: await readFileAsBase64(fileUpload),
              fileName: fileUpload.name,
            }
          : {};
      const trimmedFile = fileUrl.trim();
      const isDataUri = trimmedFile.startsWith('data:');
      const commaIndex = trimmedFile.indexOf(',');
      const base64Payload = isDataUri && commaIndex >= 0 ? trimmedFile.slice(commaIndex + 1) : '';
      await apiRequest({
        path: '/kyc/documents',
        method: 'POST',
        body: {
          documentType,
          ...(documentNumber ? { documentNumber } : {}),
          ...(Object.keys(filePayload).length
            ? filePayload
            : trimmedFile
              ? isDataUri && base64Payload
                ? {
                    fileContentBase64: base64Payload,
                    fileName: `${documentType.toLowerCase()}-${Date.now()}.txt`,
                  }
                : { fileUrl: trimmedFile }
              : {}),
        },
      });
      setDocumentNumber('');
      setFileUrl('');
      setFileUpload(null);
      setFileInputKey((prev) => prev + 1);
      refreshStatus();
      refreshDocuments();
      setMessage('Document submitted. We will update your status after review.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <Layout title="Verify your identity" subtitle="Verification">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="section-title">Verification status</h3>
              <p className="text-sm text-[var(--muted)]">
                We review your documents in the background. Some features are limited until verification completes.
              </p>
            </div>
            <span className={statusStyles[status?.status ?? 'PENDING']}>{status?.status ?? 'PENDING'}</span>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Uploaded</p>
                <p className="text-lg font-semibold text-brand-secondary">{status?.documentsCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Approved</p>
                <p className="text-lg font-semibold text-brand-secondary">{status?.approvedCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Pending</p>
                <p className="text-lg font-semibold text-brand-secondary">{status?.pendingCount ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Progress</p>
            {status?.status === 'REJECTED' ? (
              <p className="mt-3 text-sm text-red-600">
                Verification rejected. Upload a new document to restart review.
              </p>
            ) : (
              <div className="mt-4 flex items-center gap-4">
                {steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                        index <= currentStepIndex
                          ? 'bg-brand-primary text-white'
                          : 'border border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{step}</span>
                    {index < steps.length - 1 && <span className="h-px w-10 bg-[var(--border)]" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <h3 className="section-title">Your documents</h3>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-xs focus:border-brand-primary focus:outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEW">Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="grid gap-4">
            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white/70 p-6 text-sm text-[var(--muted)]">
                No documents yet. Upload one to start verification.
              </div>
            ) : (
              filtered.map((doc) => (
                <article key={doc.id} className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-brand-secondary">{doc.documentType}</p>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Submitted {new Date(doc.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={statusStyles[doc.status] ?? 'badge-amber'}>{doc.status}</span>
                  </div>
                  {doc.rejectionReason && (
                    <p className="mt-2 text-xs text-red-600">Reason: {doc.rejectionReason}</p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Upload document</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add an ID document to start verification. We will notify you when review is complete.
          </p>
          <div className="mt-4 rounded-2xl border border-dashed border-brand-primary/30 bg-brand-primary/5 p-3 text-xs text-brand-secondary">
            Tip: Upload a passport or ID card to unlock transfers faster.
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Document type</label>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="input-field mt-2"
              >
                <option value="PASSPORT">Passport</option>
                <option value="ID_CARD">ID card</option>
                <option value="DRIVER_LICENSE">Driver license</option>
                <option value="UTILITY_BILL">Utility bill</option>
                <option value="BANK_STATEMENT">Bank statement</option>
                <option value="PROOF_OF_ADDRESS">Proof of address</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Document number</label>
              <input
                value={documentNumber}
                onChange={(event) => setDocumentNumber(event.target.value)}
                className="input-field mt-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Upload file</label>
              <input
                key={fileInputKey}
                type="file"
                onChange={(event) => setFileUpload(event.target.files?.[0] ?? null)}
                className="input-field mt-2"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">Accepted formats: image or PDF.</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Or paste a file URL (optional)</label>
              <input
                value={fileUrl}
                onChange={(event) => setFileUrl(event.target.value)}
                className="input-field mt-2"
                placeholder="https://example.com/your-file.png"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
            >
              Upload document
            </button>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
          <div className="mt-6 rounded-2xl border border-dashed border-brand-primary/40 bg-brand-primary/5 p-4 text-xs text-brand-secondary">
            Verification checks run in the background and may take a few minutes.
          </div>
        </section>
      </div>
    </Layout>
  );
}
