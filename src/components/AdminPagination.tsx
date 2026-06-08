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
    </div>
  );
}
