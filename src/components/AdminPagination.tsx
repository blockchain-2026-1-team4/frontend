type AdminPaginationProps = {
  page: number;
  size: number;
  totalElements?: number;
  totalPages?: number;
  hasNext?: boolean;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

export function AdminPagination({
  page,
  size,
  totalElements,
  totalPages,
  hasNext,
  loading = false,
  onPageChange,
}: AdminPaginationProps) {
  const currentPage = page + 1;
  const knownTotalPages = totalPages && totalPages > 0 ? totalPages : undefined;
  const canGoPrevious = page > 0 && !loading;
  const canGoNext = !loading && (hasNext ?? (knownTotalPages ? currentPage < knownTotalPages : false));
  const totalLabel = typeof totalElements === "number" ? `${totalElements.toLocaleString("ko-KR")}건` : "총 건수 미확인";
  const pageLabel = knownTotalPages ? `${currentPage} / ${knownTotalPages}` : `${currentPage}페이지`;

  return (
    <div className="admin-pagination">
      <span>{totalLabel}</span>
      <div>
        <button disabled={!canGoPrevious} onClick={() => onPageChange(page - 1)} type="button">
          이전
        </button>
        <strong>{pageLabel}</strong>
        <button disabled={!canGoNext} onClick={() => onPageChange(page + 1)} type="button">
          다음
        </button>
      </div>
      <span>{size}개씩 보기</span>
      <style>{`
        .admin-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border-top: 1px solid var(--border);
          background: #f8fafc;
          color: var(--txt-sub);
          font-size: 0.84rem;
          font-weight: 700;
          flex-wrap: wrap;
        }
        .admin-pagination div {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
        }
        .admin-pagination strong {
          color: var(--txt-main);
          font-variant-numeric: tabular-nums;
        }
        .admin-pagination button {
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--txt-main);
          border-radius: 8px;
          padding: 0.36rem 0.72rem;
          font: inherit;
          cursor: pointer;
        }
        .admin-pagination button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
