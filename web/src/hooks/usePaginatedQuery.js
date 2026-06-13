import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { buildQuery, normalizePage } from '../utils/query';

/**
 * Server-side paginated list hook for large datasets.
 * Debounces search input and keeps page/size in sync with the API.
 */
export function usePaginatedQuery(endpoint, {
  pageSize: initialPageSize = 25,
  searchDebounceMs = 350,
  extraParams = {},
} = {}) {
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const extraRef = useRef(extraParams);
  extraRef.current = extraParams;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), searchDebounceMs);
    return () => clearTimeout(t);
  }, [search, searchDebounceMs]);

  // Reset to page 1 when search changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQuery({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        ...extraRef.current,
      });
      const data = await api.get(`${endpoint}${query}`);
      const normalized = normalizePage(data);
      setResults(normalized.results);
      setTotal(normalized.count);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const pagination = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: ['25', '50', '100'],
    showTotal: (count) => `${count.toLocaleString()} total`,
    onChange: (nextPage, nextSize) => {
      if (nextSize !== pageSize) {
        setPageSize(nextSize);
        setPage(1);
      } else {
        setPage(nextPage);
      }
    },
  };

  return {
    results,
    total,
    loading,
    search,
    setSearch,
    pagination,
    refresh: load,
  };
}
