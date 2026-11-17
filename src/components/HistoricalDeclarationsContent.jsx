import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './AppIcons';
import { PageHeader } from './PageHeader';

const PAGE_SIZE = 50;

const EMPTY_FILTERS = Object.freeze({
  q: '',
  year: '',
  country: '',
  company_country: '',
  nature: '',
  currency: '',
});

// appearance-none + explicit pr-8 reserves fixed room for the custom arrow
// instead of relying on the browser's native select arrow, whose spacing
// varies by OS/browser and was overlapping the selected text.
const FilterSelect = ({ id, label, value, onChange, defaultOptionLabel, options, getOptionValue, getOptionLabel }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={id}>
      {label}
    </label>
    <div className="relative">
      <select
        id={id}
        className="w-full appearance-none p-2 pr-8 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7654A1] focus:border-[#7654A1]"
        value={value}
        onChange={onChange}
      >
        <option value="">{defaultOptionLabel}</option>
        {options?.map((option) => (
          <option key={getOptionValue(option)} value={getOptionValue(option)}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
        <AppIcon name="ChevronDown" size={14} />
      </span>
    </div>
  </div>
);

function parseHash(hash) {
  const queryIdx = hash.indexOf('?');
  const params = new URLSearchParams(queryIdx === -1 ? '' : hash.slice(queryIdx + 1));

  return {
    filters: {
      q: params.get('q') || '',
      year: params.get('year') || '',
      country: params.get('country') || '',
      company_country: params.get('company_country') || '',
      nature: params.get('nature') || '',
      currency: params.get('currency') || '',
    },
    page: Math.max(parseInt(params.get('page') || '1', 10) || 1, 1),
    id: params.get('id'),
  };
}

function buildHash(filters, page, id) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (page > 1) params.set('page', String(page));
  if (id) params.set('id', id);

  const paramStr = params.toString();
  return `#search${paramStr ? `?${paramStr}` : ''}`;
}

export const HistoricalDeclarationsContent = ({ onNavigateTransparencyHome }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isInitialMount = useRef(true);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Parse the URL hash on mount and on hash change (deep linking).
  useEffect(() => {
    const applyHash = () => {
      const { filters: hashFilters, page: hashPage, id } = parseHash(window.location.hash || '');
      setSearchTerm(hashFilters.q);
      setFilters(hashFilters);
      setPage(hashPage);
      if (id) {
        fetchDeclarationDetail(id);
      }
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Debounce the free-text search input before it becomes a filter.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.q !== searchTerm ? { ...prev, q: searchTerm } : prev));
      if (searchTerm !== filters.q) {
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Fetch results whenever filters/page change, and sync the URL hash.
  useEffect(() => {
    fetchResults();

    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      syncHash(filters, page, selectedDeclaration?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  // Modal: Escape to close, lock body scroll, restore focus on close.
  useEffect(() => {
    if (!isModalOpen) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  const syncHash = (currentFilters, currentPage, currentId) => {
    const newHash = buildHash(currentFilters, currentPage, currentId);
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch('/api/historical-declarations/metadata');
      const data = await res.json();
      setMetadata(data);
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  };

  const fetchResults = async () => {
    const hasFilter = Object.values(filters).some(Boolean);
    if (!hasFilter) {
      setResults([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ ...filters, page: String(page) });
      const res = await fetch(`/api/historical-declarations/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeclarationDetail = async (id) => {
    try {
      const res = await fetch(`/api/historical-declarations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDeclaration(data);
        setIsModalOpen(true);
        syncHash(filters, page, id);
      } else {
        console.error('Failed to fetch declaration detail');
      }
    } catch (err) {
      console.error('Failed to fetch declaration detail:', err);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDeclaration(null);
    syncHash(filters, page, null);
  };

  const hasFilter = Object.values(filters).some(Boolean);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/60 custom-scrollbar h-full">
      <div className="animate-page-in px-4 sm:px-8 py-8 sm:py-10 max-w-6xl 3xl:max-w-[96rem] mx-auto pb-24">
        <PageHeader
          icon="Search"
          accent="teal"
          title="Historical Declarations"
          description="Search past transparency declarations by company, beneficiary, year, or country."
          back={{ label: 'Transparency', onClick: onNavigateTransparencyHome }}
        />

        {/* Filters */}
        <section className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="hd-search">
                Search
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <AppIcon name="Search" size={16} />
                </span>
                <input
                  id="hd-search"
                  type="search"
                  placeholder="Company or beneficiary name..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7654A1] focus:border-[#7654A1] outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <FilterSelect
                id="hd-year"
                label="Year"
                value={filters.year}
                onChange={(e) => handleFilterChange({ year: e.target.value })}
                defaultOptionLabel="All years"
                options={metadata?.years}
                getOptionValue={(y) => y}
                getOptionLabel={(y) => y}
              />
            </div>
            <div className="md:col-span-2">
              <FilterSelect
                id="hd-country"
                label="Beneficiary country"
                value={filters.country}
                onChange={(e) => handleFilterChange({ country: e.target.value })}
                defaultOptionLabel="All countries"
                options={metadata?.countries}
                getOptionValue={(c) => c.iso_code}
                getOptionLabel={(c) => c.name}
              />
            </div>
            <div className="md:col-span-2">
              <FilterSelect
                id="hd-company-country"
                label="Company country"
                value={filters.company_country}
                onChange={(e) => handleFilterChange({ company_country: e.target.value })}
                defaultOptionLabel="All countries"
                options={metadata?.countries}
                getOptionValue={(c) => c.iso_code}
                getOptionLabel={(c) => c.name}
              />
            </div>
            <div className="md:col-span-2">
              <FilterSelect
                id="hd-nature"
                label="Type"
                value={filters.nature}
                onChange={(e) => handleFilterChange({ nature: e.target.value })}
                defaultOptionLabel="All types"
                options={metadata?.natures}
                getOptionValue={(n) => n.nature}
                getOptionLabel={(n) => n.nature_label}
              />
            </div>
            <div className="md:col-span-1">
              <FilterSelect
                id="hd-currency"
                label="Currency"
                value={filters.currency}
                onChange={(e) => handleFilterChange({ currency: e.target.value })}
                defaultOptionLabel="All"
                options={metadata?.currencies}
                getOptionValue={(c) => c}
                getOptionLabel={(c) => c}
              />
            </div>
          </div>
        </section>

        {/* Results */}
        {!hasFilter ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-500">
            Enter a search term or choose a filter above to find declarations.
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7654A1]" />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center text-sm text-slate-500 mb-3">
              <span>Found {total}{total >= 1000 ? '+' : ''} record{total === 1 ? '' : 's'}</span>
              <span className="no-print">Page {page} of {totalPages}</span>
            </div>

            <div key={page} className="stagger grid gap-4">
              {results.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => fetchDeclarationDetail(item.id)}
                  className="text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-[#0099A7] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out-soft active:translate-y-0 active:scale-[0.99]"
                >
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-cyan-50 text-[#007A86] px-2 py-0.5 rounded text-xs font-bold tracking-wide uppercase">
                          {item.year}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[#007A86] font-medium text-sm">{item.nature_label}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{item.beneficiary_name}</h3>
                      <p className="text-slate-500 text-sm">
                        {item.beneficiary_city ? `${item.beneficiary_city}, ` : ''}{item.beneficiary_country_code}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <div className="text-2xl font-black text-slate-900">
                        {item.amount?.toLocaleString()}{' '}
                        <span className="text-sm font-normal text-slate-500">{item.currency_code}</span>
                      </div>
                      <p className="text-slate-900 text-base font-bold mt-1">Declared by {item.company_name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <nav className="no-print flex justify-center gap-2 py-8">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-4 py-2 border border-slate-200 rounded-xl transition disabled:opacity-30 enabled:hover:bg-slate-50 enabled:active:scale-[0.97]"
              >
                <AppIcon name="ChevronLeft" size={14} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-4 py-2 bg-[#7654A1] text-white rounded-xl transition disabled:opacity-30 enabled:hover:bg-[#634488] enabled:active:scale-[0.97]"
              >
                Next
                <AppIcon name="ChevronRight" size={14} />
              </button>
            </nav>
          </>
        )}
      </div>

      {isModalOpen && selectedDeclaration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="declaration-modal-title"
            tabIndex={-1}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none animate-scale-in"
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 id="declaration-modal-title" className="text-xl font-bold text-slate-900">
                Declaration details
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close declaration details"
                className="text-slate-400 hover:text-slate-600"
              >
                <AppIcon name="X" size={20} />
              </button>
            </div>
            <div className="p-6 space-y-8">
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block bg-cyan-50 text-[#007A86] px-3 py-1 rounded-full text-sm font-bold tracking-wide uppercase mb-2">
                    {selectedDeclaration.year}
                  </span>
                  <p className="text-[#007A86] font-medium">{selectedDeclaration.nature_label}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-slate-900">
                    {selectedDeclaration.amount?.toLocaleString()}{' '}
                    <span className="text-lg font-normal text-slate-500">{selectedDeclaration.currency_code}</span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Beneficiary</h4>
                  <p className="font-bold text-slate-900 text-lg mb-1">{selectedDeclaration.beneficiary_name}</p>
                  <div className="text-slate-600 text-sm space-y-1">
                    {selectedDeclaration.beneficiary_ui && <p>ID: {selectedDeclaration.beneficiary_ui}</p>}
                    <p>{selectedDeclaration.beneficiary_address}</p>
                    <p>
                      {selectedDeclaration.beneficiary_city}, {selectedDeclaration.beneficiary_zip}{' '}
                      {selectedDeclaration.beneficiary_country_code}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Company</h4>
                  <p className="font-bold text-slate-900 text-lg mb-1">{selectedDeclaration.company_name}</p>
                  <div className="text-slate-600 text-sm space-y-1">
                    {selectedDeclaration.company_parent_name && (
                      <p>Parent: {selectedDeclaration.company_parent_name}</p>
                    )}
                    {selectedDeclaration.company_ui && <p>ID: {selectedDeclaration.company_ui}</p>}
                    <p>{selectedDeclaration.company_country_code} {selectedDeclaration.company_zip}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {selectedDeclaration.description && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                    <p className="text-slate-700 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {selectedDeclaration.description}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contact</h4>
                  <div className="text-sm text-slate-600 bg-cyan-50 p-4 rounded-xl border border-cyan-100">
                    {selectedDeclaration.contact_url ? (
                      <p>
                        Company query link:{' '}
                        <a
                          href={selectedDeclaration.contact_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#007A86] hover:underline break-all"
                        >
                          {selectedDeclaration.contact_url}
                        </a>
                      </p>
                    ) : (
                      <p>No dedicated public company query link is available in the source data.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
