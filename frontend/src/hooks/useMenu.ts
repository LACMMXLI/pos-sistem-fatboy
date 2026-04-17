import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCategories, getProducts } from '../services/api';

export function useMenu() {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { 
    data: categories = [], 
    isLoading: isLoadingCategories,
    error: categoriesError 
  } = useQuery({ 
    queryKey: ['categories'], 
    queryFn: getCategories 
  });

  const { 
    data: allProducts = [], 
    isLoading: isLoadingProducts,
    error: productsError 
  } = useQuery({ 
    queryKey: ['products', activeCategoryId], 
    queryFn: () => getProducts(activeCategoryId || undefined) 
  });

  const products = allProducts.filter((product: any) => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCategorySelect = (categoryId: string | null) => {
    setActiveCategoryId(categoryId === 'all' ? null : categoryId);
    setSearchTerm(''); // Clear search when category changes? Or keep it? User said "cancelar una búsqueda" when changing.
  };

  return {
    categories,
    products,
    searchTerm,
    setSearchTerm,
    activeCategoryId,
    isLoadingCategories,
    isLoadingProducts,
    categoriesError,
    productsError,
    handleCategorySelect,
  };
}
