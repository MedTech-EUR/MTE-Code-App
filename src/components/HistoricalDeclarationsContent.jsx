import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './AppIcons';

const PAGE_SIZE = 50;

// Receives objections and correction or removal requests about archive records.
export const ARCHIVE_CONTACT = 'ethics@medtecheurope.org';
const DATA_PROTECTION_AUTHORITY_URL = 'https://www.dataprotectionauthority.be/citizen';

// An e-mail to ARCHIVE_CONTACT that names the record, so the request can be traced.
export function getRecordReportHref(declaration) {
  const subject = `Historical Declarations: record ${declaration.id}`;
  const body = [
    `Record: ${declaration.id}`,
    `Beneficiary: ${declaration.beneficiary_name}`,
    `Company: ${declaration.company_name}`,
    `Year: ${declaration.year}`,
    '',
    'What is the problem? For example: the record is about me and I object to its publication, or a detail is wrong.',
    '',
  ].join('\r\n');
  return `mailto:${ARCHIVE_CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// What the archive is, how long it is kept and how to object: the information the GDPR
// requires for data not collected from the people concerned (art. 14).
export const ArchiveNotice = ({ oldestYear }) => (
  <section
    aria-labelledby="hd-about-title"
    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 text-sm text-slate-600 leading-relaxed space-y-2"
  >
    <h2 id="hd-about-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
      <AppIcon name="Info" size={18} className="text-[#0099A7]" />
      About this data
    </h2>
    <p>
      These are the Educational Grants that Member Companies declared under the MedTech Europe Disclosure
      Guidelines. MedTech Europe keeps them public here in its legitimate interest in keeping industry support
      for medical education transparent. Each company is responsible for the accuracy of its own declarations.
    </p>
    <p>
      Each year stays public until 31 August three years after its publication deadline
      {oldestYear ? `: ${oldestYear} until 31 August ${oldestYear + 4}` : ''}.
    </p>
    <p>
      Is a record about you, or wrong? To object to its publication or to ask for a correction or removal, use
      “Report a problem with this record” in the record, or write to{' '}
      <a href={`mailto:${ARCHIVE_CONTACT}`} className="font-medium text-[#007A86] hover:underline">
        {ARCHIVE_CONTACT}
      </a>
      . You can also complain to the{' '}
      <a
        href={DATA_PROTECTION_AUTHORITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[#007A86] hover:underline"
      >
        Belgian Data Protection Authority
      </a>
      .
    </p>
    <p>Member Companies can ask to correct or remove their own declarations the same way.</p>
  </section>
);

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
      <div className="animate-fade-in py-10 px-4 max-w-6xl 3xl:max-w-[96rem] mx-auto pb-24">
        <button
          type="button"
          onClick={onNavigateTransparencyHome}
          className="no-print inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#007A86] hover:text-[#7654A1] mb-6"
        >
          <AppIcon name="ChevronLeft" size={14} />
          Transparency
        </button>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 text-[#007A86] text-xs font-bold uppercase tracking-[0.18em] mb-4">
            <AppIcon name="Search" size={18} />
            Transparency
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Historical Declarations
          </h1>
          <p className="max-w-2xl text-lg text-slate-600 leading-relaxed">
            Search past transparency declarations by company, beneficiary, year, or country.
          </p>
        </header>

        <ArchiveNotice oldestYear={metadata?.years?.length ? Math.min(...metadata.years) : null} />

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

            <div className="grid gap-4">
              {results.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => fetchDeclarationDetail(item.id)}
                  className="text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-[#0099A7] hover:shadow-md transition-all active:scale-[0.99]"
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
                className="inline-flex items-center gap-1 px-4 py-2 border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50"
              >
                <AppIcon name="ChevronLeft" size={14} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-4 py-2 bg-[#7654A1] text-white rounded-xl disabled:opacity-30 hover:opacity-90"
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none"
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
                      {[selectedDeclaration.beneficiary_city, selectedDeclaration.beneficiary_country_code]
                        .filter(Boolean)
                        .join(', ')}
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
                    <p className="mt-2">
                      Is this record about you, or wrong?{' '}
                      <a
                        href={getRecordReportHref(selectedDeclaration)}
                        className="font-medium text-[#007A86] hover:underline"
                      >
                        Report a problem with this record
                      </a>
                    </p>
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
