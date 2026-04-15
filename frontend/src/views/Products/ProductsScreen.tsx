import React, { useMemo, useState } from 'react';
import {
  Gift,
  Loader2,
  PackageSearch,
  PencilLine,
  PlusCircle,
  RefreshCw,
  Save,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import {
  PRODUCT_ICON_OPTIONS,
  ProductVisual,
} from '../../components/ui/ProductVisual';
import {
  createCategory,
  createProduct,
  createRedeemableProduct,
  deleteCategory,
  deleteProduct,
  deleteRedeemableProduct,
  getCategories,
  getProducts,
  getRedeemableProducts,
  updateCategory,
  updateProduct,
  updateRedeemableProduct,
} from '../../services/api';

type Category = {
  id: number;
  name: string;
  displayOrder?: number;
  isActive: boolean;
  _count?: { products: number };
};

type Product = {
  id: number;
  name: string;
  description?: string | null;
  price: number | string;
  categoryId: number;
  imageUrl?: string | null;
  icon?: string | null;
  isAvailable: boolean;
  category?: { id: number; name: string } | null;
};

type RedeemableProduct = {
  id: number;
  productId: number;
  pointsCost: number;
  isActive: boolean;
  product: {
    id: number;
    name: string;
    imageUrl?: string | null;
    icon?: string | null;
    isAvailable: boolean;
    category?: { id: number; name: string } | null;
  };
};

type ProductForm = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  imageUrl: string;
  icon: string;
  isAvailable: boolean;
};

type CategoryForm = {
  name: string;
  displayOrder: string;
  isActive: boolean;
};

type RedeemableForm = {
  productId: string;
  pointsCost: string;
  isActive: boolean;
};

type ActiveTab = 'products' | 'categories' | 'redeemables';

const emptyProductForm: ProductForm = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  imageUrl: '',
  icon: 'burger',
  isAvailable: true,
};

const emptyCategoryForm: CategoryForm = {
  name: '',
  displayOrder: '0',
  isActive: true,
};

const emptyRedeemableForm: RedeemableForm = {
  productId: '',
  pointsCost: '',
  isActive: true,
};

const fieldClassName =
  'w-full bg-surface-container-highest border border-outline-variant/20 py-1.5 px-2 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-bold';

export function ProductsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [productModalId, setProductModalId] = useState<number | 'new' | null>(null);
  const [categoryModalId, setCategoryModalId] = useState<number | 'new' | null>(null);
  const [redeemableModalId, setRedeemableModalId] = useState<number | 'new' | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [redeemableForm, setRedeemableForm] = useState<RedeemableForm>(emptyRedeemableForm);

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['products-admin'],
    queryFn: () => getProducts(),
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ['categories-admin'],
    queryFn: getCategories,
  });

  const { data: redeemables = [], isLoading: isLoadingRedeemables } = useQuery<RedeemableProduct[]>({
    queryKey: ['redeemable-products-admin'],
    queryFn: getRedeemableProducts,
  });

  const orderedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return products;
    return products.filter((product) => product.categoryId === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ['products-admin'] });
    queryClient.invalidateQueries({ queryKey: ['categories-admin'] });
    queryClient.invalidateQueries({ queryKey: ['redeemable-products-admin'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['redeemable-products'] });
  };

  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        price: Number(productForm.price),
        categoryId: Number(productForm.categoryId),
        imageUrl: productForm.imageUrl.trim() || undefined,
        icon: productForm.icon || undefined,
        isAvailable: productForm.isAvailable,
      };
      return typeof productModalId === 'number'
        ? updateProduct(productModalId, payload)
        : createProduct(payload);
    },
    onSuccess: () => {
      toast.success(typeof productModalId === 'number' ? 'Producto actualizado' : 'Producto creado');
      invalidateCatalog();
      setProductModalId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo guardar el producto');
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: categoryForm.name.trim(),
        displayOrder: Number(categoryForm.displayOrder || 0),
        isActive: categoryForm.isActive,
      };
      return typeof categoryModalId === 'number'
        ? updateCategory(categoryModalId, payload)
        : createCategory(payload);
    },
    onSuccess: () => {
      toast.success(typeof categoryModalId === 'number' ? 'Categoría actualizada' : 'Categoría creada');
      invalidateCatalog();
      setCategoryModalId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo guardar la categoría');
    },
  });

  const saveRedeemableMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        productId: Number(redeemableForm.productId),
        pointsCost: Number(redeemableForm.pointsCost),
        isActive: redeemableForm.isActive,
      };
      return typeof redeemableModalId === 'number'
        ? updateRedeemableProduct(redeemableModalId, payload)
        : createRedeemableProduct(payload);
    },
    onSuccess: () => {
      toast.success(typeof redeemableModalId === 'number' ? 'Canje actualizado' : 'Canje creado');
      invalidateCatalog();
      setRedeemableModalId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo guardar el canje');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      invalidateCatalog();
      setProductModalId(null);
      toast.success('Producto eliminado');
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Error al eliminar producto'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: (_, id) => {
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      invalidateCatalog();
      setCategoryModalId(null);
      toast.success('Categoría eliminada');
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Error al eliminar categoría'),
  });

  const deleteRedeemableMutation = useMutation({
    mutationFn: (id: number) => deleteRedeemableProduct(id),
    onSuccess: () => {
      invalidateCatalog();
      setRedeemableModalId(null);
      toast.success('Canje eliminado');
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Error al eliminar canje'),
  });

  const openNewProductModal = () => {
    setProductForm({
      ...emptyProductForm,
      categoryId:
        selectedCategoryId !== null
          ? String(selectedCategoryId)
          : orderedCategories[0]
            ? String(orderedCategories[0].id)
            : '',
    });
    setProductModalId('new');
  };

  const openEditProductModal = (product: Product) => {
    setProductForm({
      name: product.name ?? '',
      description: product.description ?? '',
      price: String(product.price ?? ''),
      categoryId: String(product.categoryId ?? ''),
      imageUrl: product.imageUrl ?? '',
      icon: product.icon ?? 'burger',
      isAvailable: product.isAvailable ?? true,
    });
    setProductModalId(product.id);
  };

  const openNewCategoryModal = () => {
    setCategoryForm(emptyCategoryForm);
    setCategoryModalId('new');
  };

  const openEditCategoryModal = (category: Category) => {
    setCategoryForm({
      name: category.name,
      displayOrder: String(category.displayOrder ?? 0),
      isActive: category.isActive,
    });
    setCategoryModalId(category.id);
  };

  const openNewRedeemableModal = () => {
    setRedeemableForm({
      ...emptyRedeemableForm,
      productId: products[0] ? String(products[0].id) : '',
    });
    setRedeemableModalId('new');
  };

  const openEditRedeemableModal = (redeemable: RedeemableProduct) => {
    setRedeemableForm({
      productId: String(redeemable.productId),
      pointsCost: String(redeemable.pointsCost),
      isActive: redeemable.isActive,
    });
    setRedeemableModalId(redeemable.id);
  };

  const submitProduct = () => {
    if (!productForm.name.trim()) return toast.error('Escribe el nombre del producto');
    if (!productForm.categoryId) return toast.error('Selecciona una categoría');
    if (!productForm.price || Number(productForm.price) < 0) return toast.error('Captura un precio válido');
    saveProductMutation.mutate();
  };

  const submitCategory = () => {
    if (categoryForm.name.trim().length < 3) return toast.error('La categoría debe tener al menos 3 caracteres');
    if (Number(categoryForm.displayOrder) < 0) return toast.error('El orden no puede ser negativo');
    saveCategoryMutation.mutate();
  };

  const submitRedeemable = () => {
    if (!redeemableForm.productId) return toast.error('Selecciona un producto base');
    if (!redeemableForm.pointsCost || Number(redeemableForm.pointsCost) < 1) return toast.error('Captura un costo válido');
    saveRedeemableMutation.mutate();
  };

  return (
    <div className="h-full flex bg-surface overflow-hidden">
      <div className="w-44 border-r border-outline-variant/10 flex flex-col bg-surface-container-low">
        <div className="p-1.5 border-b border-outline-variant/10">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-headline text-sm font-black text-white tracking-tighter uppercase">Productos</h2>
            <div className="flex gap-0.5">
              <button onClick={invalidateCatalog} className="p-0.5 bg-surface-container-highest text-outline hover:text-white transition-all active:scale-95 border border-outline-variant/10">
                <RefreshCw className="w-3 h-3" />
              </button>
              <button onClick={openNewProductModal} className="p-0.5 bg-primary text-on-primary hover:bg-primary-container transition-all active:scale-95">
                <PlusCircle className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex gap-1 mb-1">
            <button onClick={() => setActiveTab('products')} className={cn('flex-1 text-[7px] font-black uppercase tracking-widest py-1 border transition-all', activeTab === 'products' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-highest text-outline border-outline-variant/10 hover:text-white')}>Menú</button>
            <button onClick={() => setActiveTab('categories')} className={cn('flex-1 text-[7px] font-black uppercase tracking-widest py-1 border transition-all', activeTab === 'categories' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-highest text-outline border-outline-variant/10 hover:text-white')}>Categorías</button>
            <button onClick={() => setActiveTab('redeemables')} className={cn('flex-1 text-[7px] font-black uppercase tracking-widest py-1 border transition-all', activeTab === 'redeemables' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-highest text-outline border-outline-variant/10 hover:text-white')}>Canje</button>
          </div>

          {activeTab === 'products' ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[7px] font-bold uppercase tracking-widest text-outline">Categorías</span>
                <button onClick={openNewCategoryModal} className="text-[7px] font-black uppercase tracking-widest text-primary hover:brightness-110">Nueva</button>
              </div>
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  'w-full text-left px-2 py-1 text-[8px] font-bold uppercase tracking-widest border transition-all',
                  selectedCategoryId === null
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface-container-highest border-outline-variant/10 text-outline hover:text-white',
                )}
              >
                Todas
              </button>
            </div>
          ) : activeTab === 'categories' ? (
            <button onClick={openNewCategoryModal} className="w-full bg-primary text-on-primary text-[8px] font-black uppercase tracking-widest py-1 border border-primary">Nueva categoría</button>
          ) : (
            <button onClick={openNewRedeemableModal} className="w-full bg-primary text-on-primary text-[8px] font-black uppercase tracking-widest py-1 border border-primary">Nuevo canje</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'products' ? (
            isLoadingCategories ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : (
              orderedCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  onDoubleClick={() => openEditCategoryModal(category)}
                  className={cn(
                    'w-full p-1.5 flex flex-col gap-0 border-b border-outline-variant/5 transition-all text-left',
                    selectedCategoryId === category.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-surface-container-high',
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-headline font-bold text-on-surface text-[9px] uppercase tracking-tight truncate">{category.name}</span>
                    <span className="text-[6px] font-bold text-outline uppercase">{category._count?.products ?? 0}</span>
                  </div>
                  <span className="text-[6px] text-outline font-bold uppercase tracking-widest">{category.isActive ? 'Visible' : 'Oculta'}</span>
                </button>
              ))
            )
          ) : activeTab === 'categories' ? (
            isLoadingCategories ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : (
              orderedCategories.map((category) => (
                <button key={category.id} onClick={() => openEditCategoryModal(category)} className="w-full p-1.5 flex flex-col gap-0 border-b border-outline-variant/5 transition-all text-left hover:bg-surface-container-high">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-headline font-bold text-on-surface text-[9px] uppercase tracking-tight truncate">{category.name}</span>
                    <PencilLine className="w-2.5 h-2.5 text-outline" />
                  </div>
                  <span className="text-[6px] text-outline font-bold uppercase tracking-widest">Orden {category.displayOrder ?? 0} • {category._count?.products ?? 0} productos</span>
                </button>
              ))
            )
          ) : isLoadingRedeemables ? (
            <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
          ) : (
            redeemables.map((redeemable) => (
              <button key={redeemable.id} onClick={() => openEditRedeemableModal(redeemable)} className="w-full p-1.5 flex flex-col gap-0 border-b border-outline-variant/5 transition-all text-left hover:bg-surface-container-high">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-headline font-bold text-on-surface text-[9px] uppercase tracking-tight truncate">{redeemable.product.name}</span>
                  <Gift className="w-2.5 h-2.5 text-outline" />
                </div>
                <span className="text-[6px] text-outline font-bold uppercase tracking-widest">{redeemable.pointsCost} pts • {redeemable.isActive ? 'Activo' : 'Pausado'}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-surface overflow-hidden">
        {activeTab === 'products' ? (
          <>
            <div className="p-1.5 border-b border-outline-variant/10 flex items-center justify-between">
              <div className="text-[8px] font-bold uppercase tracking-widest text-outline">
                {selectedCategoryId ? `Productos de ${orderedCategories.find((item) => item.id === selectedCategoryId)?.name ?? 'categoría'}` : 'Todos los productos'}
              </div>
              <div className="text-[7px] font-bold uppercase tracking-widest text-outline">{filteredProducts.length} productos</div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
              {isLoadingProducts ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-outline gap-2">
                  <PackageSearch className="w-10 h-10 opacity-10" />
                  <p className="font-headline font-bold uppercase tracking-widest text-[10px] opacity-30">No hay productos para mostrar</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-1">
                  {filteredProducts.map((product) => (
                    <button key={product.id} onClick={() => openEditProductModal(product)} className="group relative h-24 overflow-hidden border border-outline-variant/10 bg-surface-container-low text-left transition-all hover:border-primary/35 hover:bg-surface-container-high">
                      <ProductVisual
                        imageUrl={product.imageUrl}
                        icon={product.icon}
                        alt={product.name}
                        className="absolute inset-0"
                        imageClassName="opacity-70 transition-opacity group-hover:opacity-85"
                        fallbackClassName="bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_55%),linear-gradient(135deg,_rgba(17,24,39,0.96),_rgba(38,38,42,0.96))]"
                        emojiClassName="text-5xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/58 to-black/12" />
                      <div className="relative z-10 flex h-full flex-col justify-between p-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn('rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.18em]', product.isAvailable ? 'border-primary/25 bg-primary/18 text-primary' : 'border-white/10 bg-black/35 text-white/70')}>
                            {product.isAvailable ? 'Activo' : 'Pausado'}
                          </span>
                          <span className="rounded-full border border-white/10 bg-black/45 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] text-white/85">
                            {product.category?.name || 'S/C'}
                          </span>
                        </div>
                        <div>
                          <div
                            className="line-clamp-3 font-headline text-[12px] font-black uppercase leading-[1.02] tracking-tight text-white sm:text-[14px]"
                            style={{ textShadow: '0px 2px 6px rgba(0,0,0,0.95)' }}
                          >
                            {product.name}
                          </div>
                          <div
                            className="mt-0.5 text-[13px] font-black text-primary sm:text-[15px]"
                            style={{ textShadow: '0px 2px 6px rgba(0,0,0,0.95)' }}
                          >
                            ${Number(product.price).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'categories' ? (
          <CompactTable
            title="Categorías"
            isLoading={isLoadingCategories}
            emptyMessage="No hay categorías"
            rows={orderedCategories.map((category) => (
              <button key={category.id} onClick={() => openEditCategoryModal(category)} className="w-full p-1.5 flex items-center justify-between border-b border-outline-variant/5 hover:bg-surface-container-high text-left">
                <div>
                  <div className="text-[9px] font-bold uppercase text-on-surface">{category.name}</div>
                  <div className="text-[6px] font-bold uppercase tracking-widest text-outline">Orden {category.displayOrder ?? 0}</div>
                </div>
                <div className="text-right">
                  <div className="text-[7px] font-black text-on-surface">{category._count?.products ?? 0}</div>
                  <div className="text-[6px] font-bold uppercase tracking-widest text-outline">{category.isActive ? 'Visible' : 'Oculta'}</div>
                </div>
              </button>
            ))}
          />
        ) : (
          <CompactTable
            title="Canjeables"
            isLoading={isLoadingRedeemables}
            emptyMessage="No hay canjeables"
            rows={redeemables.map((redeemable) => (
              <button key={redeemable.id} onClick={() => openEditRedeemableModal(redeemable)} className="w-full p-1.5 flex items-center justify-between border-b border-outline-variant/5 hover:bg-surface-container-high text-left">
                <div>
                  <div className="text-[9px] font-bold uppercase text-on-surface">{redeemable.product.name}</div>
                  <div className="text-[6px] font-bold uppercase tracking-widest text-outline">{redeemable.product.category?.name || 'S/C'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[7px] font-black text-primary">{redeemable.pointsCost} pts</div>
                  <div className="text-[6px] font-bold uppercase tracking-widest text-outline">{redeemable.isActive ? 'Activo' : 'Pausado'}</div>
                </div>
              </button>
            ))}
          />
        )}
      </div>

      {productModalId !== null && (
        <CompactModal title={typeof productModalId === 'number' ? 'Editar producto' : 'Nuevo producto'} onClose={() => setProductModalId(null)} className="max-w-5xl" bodyClassName="max-h-[82vh] p-3 md:p-4" footer={
          <>
            {typeof productModalId === 'number' && (
              <button onClick={() => deleteProductMutation.mutate(productModalId)} className="px-3 py-1.5 bg-error/10 text-error border border-error/20 text-[8px] font-black uppercase tracking-widest">
                {deleteProductMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            )}
            <button onClick={() => setProductModalId(null)} className="px-3 py-1.5 bg-surface-container-highest text-outline border border-outline-variant/10 text-[8px] font-black uppercase tracking-widest">Cancelar</button>
            <button onClick={submitProduct} className="px-3 py-1.5 bg-primary text-on-primary text-[8px] font-black uppercase tracking-widest">
              {saveProductMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </button>
          </>
        }>
          <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-3">
              <ProductVisual
                imageUrl={productForm.imageUrl}
                icon={productForm.icon}
                alt={productForm.name || 'Producto'}
                className="h-[240px] border border-outline-variant/10 bg-surface-container-highest"
                imageClassName="opacity-85"
                emojiClassName="text-7xl"
              />
              <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 rounded-md border border-outline-variant/10 bg-surface-container-lowest p-2.5">
                <div className="flex h-[64px] items-center justify-center border border-outline-variant/15 bg-surface-container-highest text-3xl">
                  {PRODUCT_ICON_OPTIONS.find((option) => option.value === productForm.icon)?.emoji ?? '🍔'}
                </div>
                <div className="space-y-2">
                  <Field label="Icono">
                    <select
                      value={productForm.icon}
                      onChange={(e) => setProductForm((current) => ({ ...current, icon: e.target.value }))}
                      className={fieldClassName}
                    >
                      {PRODUCT_ICON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.emoji}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-outline">
                    Si no hay imagen se usa este icono.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.6fr)_132px_156px]">
                <Field label="Nombre">
                  <input value={productForm.name} onChange={(e) => setProductForm((c) => ({ ...c, name: e.target.value }))} className={fieldClassName} />
                </Field>
                <Field label="Precio">
                  <input type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm((c) => ({ ...c, price: e.target.value }))} className={fieldClassName} />
                </Field>
                <Field label="Categoría">
                  <select value={productForm.categoryId} onChange={(e) => setProductForm((c) => ({ ...c, categoryId: e.target.value }))} className={fieldClassName}>
                    <option value="">Seleccione...</option>
                    {orderedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_180px]">
                <Field label="URL de imagen">
                  <input value={productForm.imageUrl} onChange={(e) => setProductForm((c) => ({ ...c, imageUrl: e.target.value }))} className={fieldClassName} placeholder="Pega la URL si el producto tiene foto" />
                </Field>
                <div className="flex">
                  <button onClick={() => setProductForm((c) => ({ ...c, isAvailable: !c.isAvailable }))} className="w-full flex justify-between items-center rounded-md bg-surface-container-highest border border-outline-variant/10 px-2.5 py-2">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface">Activo</span>
                    {productForm.isAvailable ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-outline" />}
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-outline-variant/10 bg-surface-container-lowest p-2.5">
                <Field label="Descripción">
                  <textarea
                    rows={2}
                    value={productForm.description}
                    onChange={(e) => setProductForm((c) => ({ ...c, description: e.target.value }))}
                    className={cn(fieldClassName, 'min-h-[72px] resize-none')}
                    placeholder="Opcional"
                  />
                </Field>
              </div>
            </div>
          </div>
        </CompactModal>
      )}

      {categoryModalId !== null && (
        <CompactModal title={typeof categoryModalId === 'number' ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setCategoryModalId(null)} footer={
          <>
            {typeof categoryModalId === 'number' && (
              <button onClick={() => deleteCategoryMutation.mutate(categoryModalId)} className="px-3 py-1.5 bg-error/10 text-error border border-error/20 text-[8px] font-black uppercase tracking-widest">
                {deleteCategoryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            )}
            <button onClick={() => setCategoryModalId(null)} className="px-3 py-1.5 bg-surface-container-highest text-outline border border-outline-variant/10 text-[8px] font-black uppercase tracking-widest">Cancelar</button>
            <button onClick={submitCategory} className="px-3 py-1.5 bg-primary text-on-primary text-[8px] font-black uppercase tracking-widest">
              {saveCategoryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </button>
          </>
        }>
          <div className="space-y-2">
            <Field label="Nombre"><input value={categoryForm.name} onChange={(e) => setCategoryForm((c) => ({ ...c, name: e.target.value }))} className={fieldClassName} /></Field>
            <Field label="Orden"><input type="number" min="0" step="1" value={categoryForm.displayOrder} onChange={(e) => setCategoryForm((c) => ({ ...c, displayOrder: e.target.value }))} className={fieldClassName} /></Field>
            <button onClick={() => setCategoryForm((c) => ({ ...c, isActive: !c.isActive }))} className="w-full flex justify-between items-center bg-surface-container-highest border border-outline-variant/10 px-2 py-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface">Categoría visible</span>
              {categoryForm.isActive ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-outline" />}
            </button>
          </div>
        </CompactModal>
      )}

      {redeemableModalId !== null && (
        <CompactModal title={typeof redeemableModalId === 'number' ? 'Editar canje' : 'Nuevo canje'} onClose={() => setRedeemableModalId(null)} footer={
          <>
            {typeof redeemableModalId === 'number' && (
              <button onClick={() => deleteRedeemableMutation.mutate(redeemableModalId)} className="px-3 py-1.5 bg-error/10 text-error border border-error/20 text-[8px] font-black uppercase tracking-widest">
                {deleteRedeemableMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            )}
            <button onClick={() => setRedeemableModalId(null)} className="px-3 py-1.5 bg-surface-container-highest text-outline border border-outline-variant/10 text-[8px] font-black uppercase tracking-widest">Cancelar</button>
            <button onClick={submitRedeemable} className="px-3 py-1.5 bg-primary text-on-primary text-[8px] font-black uppercase tracking-widest">
              {saveRedeemableMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </button>
          </>
        }>
          <div className="space-y-2">
            <Field label="Producto base">
              <select value={redeemableForm.productId} onChange={(e) => setRedeemableForm((c) => ({ ...c, productId: e.target.value }))} className={fieldClassName}>
                <option value="">Seleccione...</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Puntos"><input type="number" min="1" step="1" value={redeemableForm.pointsCost} onChange={(e) => setRedeemableForm((c) => ({ ...c, pointsCost: e.target.value }))} className={fieldClassName} /></Field>
            <button onClick={() => setRedeemableForm((c) => ({ ...c, isActive: !c.isActive }))} className="w-full flex justify-between items-center bg-surface-container-highest border border-outline-variant/10 px-2 py-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface">Disponible para canje</span>
              {redeemableForm.isActive ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-outline" />}
            </button>
          </div>
        </CompactModal>
      )}
    </div>
  );
}

function CompactTable({ title, isLoading, emptyMessage, rows }: { title: string; isLoading: boolean; emptyMessage: string; rows: React.ReactNode[] }) {
  return (
    <>
      <div className="p-1.5 border-b border-outline-variant/10 flex items-center justify-between">
        <div className="text-[8px] font-bold uppercase tracking-widest text-outline">{title}</div>
        <div className="text-[7px] font-bold uppercase tracking-widest text-outline">{rows.length} registros</div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-outline gap-2">
            <Tag className="w-10 h-10 opacity-10" />
            <p className="font-headline font-bold uppercase tracking-widest text-[10px] opacity-30">{emptyMessage}</p>
          </div>
        ) : rows}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1 text-[7px] font-bold uppercase tracking-widest text-outline">{label}</label>
      {children}
    </div>
  );
}

function CompactModal({
  title,
  onClose,
  children,
  footer,
  className,
  bodyClassName,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-3 md:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.96, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} className={cn("relative w-full max-w-2xl bg-surface-container-low border border-outline-variant/20 shadow-2xl overflow-hidden", className)}>
        <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest px-3 py-2.5">
          <h3 className="text-[11px] font-headline font-black uppercase tracking-widest text-white">{title}</h3>
          <button onClick={onClose} className="p-1 bg-surface-container-highest text-outline hover:text-white transition-all active:scale-95 border border-outline-variant/10">
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className={cn("max-h-[75vh] overflow-y-auto custom-scrollbar p-2", bodyClassName)}>{children}</div>
        <div className="flex justify-end gap-1 border-t border-outline-variant/10 bg-surface-container-lowest px-3 py-2.5">{footer}</div>
      </motion.div>
    </div>
  );
}
