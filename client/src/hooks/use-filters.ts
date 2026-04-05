import { useState, useMemo } from "react";

interface UseFiltersOptions<T> {
  searchFields?: (keyof T)[];
  filterFields?: Record<string, string>;
  customFilter?: (item: T, filters: Record<string, string>) => boolean;
}

export function useFilters<T extends Record<string, any>>(
  items: T[] | undefined,
  options: UseFiltersOptions<T> = {}
) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(
    options.filterFields ?? {}
  );

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filtered = useMemo(() => {
    if (!items) return [];

    let result = items;

    // Text search
    if (search && options.searchFields?.length) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        options.searchFields!.some((field) => {
          const val = item[field];
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Filter fields
    if (options.filterFields) {
      for (const [key, defaultVal] of Object.entries(filters)) {
        if (defaultVal === "all" || !filters[key] || filters[key] === "all") continue;
        if (options.customFilter) continue; // let customFilter handle it
        result = result.filter((item) => String(item[key]) === filters[key]);
      }
    }

    // Custom filter
    if (options.customFilter) {
      result = result.filter((item) => options.customFilter!(item, filters));
    }

    return result;
  }, [items, search, filters, options]);

  return { search, setSearch, filters, setFilter, filtered };
}
