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
  Search,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { ProductCard } from '../../components/pos/ProductCard';
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
  'w-full bg-black/40 border border-white/10 py-2 px-3 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-black uppercase tracking-widest placeholder:text-white/10 rounded-[2px]';

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
    <div className="h-full flex bg-[#050505] overflow-hidden">
      <div className="w-56 border-r border-white/5 flex flex-col bg-[#0a0a0a]">
        <div className="p-1.5 border-b border-outline-variant/10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline text-[11px] font-black text-white tracking-widest uppercase">Catálogo</h2>
            <div className="flex gap-1">
              <button onClick={invalidateCatalog} className="p-1.5 bg-white/5 text-white/40 hover:text-white transition-all active:scale-95 border border-white/10 rounded-[2px]">
                <RefreshCw className="w-3 h-3" />
              </button>
              <button onClick={openNewProductModal} className="p-1.5 bg-primary text-black hover:brightness-110 transition-all active:scale-95 rounded-[2px]">
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
                    'w-full p-2.5 flex flex-col gap-0 border-b border-white/5 transition-all text-left',
                    selectedCategoryId === category.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-white/5',
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={cn("font-headline font-black text-[10px] uppercase tracking-tight truncate", selectedCategoryId === category.id ? "text-primary" : "text-white/80")}>{category.name}</span>
                    <span className="text-[7px] font-black text-white/20 uppercase">{category._count?.products ?? 0}</span>
                  </div>
                  <span className="text-[7px] text-white/30 font-bold uppercase tracking-widest">{category.isActive ? 'Visible' : 'Oculta'}</span>
                </button>
              ))
            )
          ) : activeTab === 'categories' ? (
            isLoadingCategories ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : (
              orderedCategories.map((category) => (
                <button key={category.id} onClick={() => openEditCategoryModal(category)} className="w-full p-2.5 flex flex-col gap-0 border-b border-white/5 transition-all text-left hover:bg-white/5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-headline font-black text-white/80 text-[10px] uppercase tracking-tight truncate">{category.name}</span>
                    <PencilLine className="w-3 h-3 text-white/20" />
                  </div>
                  <span className="text-[7px] text-white/30 font-bold uppercase tracking-widest">Orden {category.displayOrder ?? 0} • {category._count?.products ?? 0} p.</span>
                </button>
              ))
            )
          ) : isLoadingRedeemables ? (
            <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
          ) : (
            redeemables.map((redeemable) => (
              <button key={redeemable.id} onClick={() => openEditRedeemableModal(redeemable)} className="w-full p-2.5 flex flex-col gap-0 border-b border-white/5 transition-all text-left hover:bg-white/5">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-headline font-black text-white/80 text-[10px] uppercase tracking-tight truncate">{redeemable.product.name}</span>
                  <Gift className="w-3 h-3 text-white/20" />
                </div>
                <span className="text-[7px] text-white/30 font-bold uppercase tracking-widest">{redeemable.pointsCost} pts • {redeemable.isActive ? 'Activo' : 'Pausado'}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
        {activeTab === 'products' ? (
          <>
            <div className="p-2 border-b border-white/5 flex items-center justify-between bg-[#0a0a0a]">
              <div className="text-[9px] font-black uppercase tracking-widest text-white/40">
                {selectedCategoryId ? `Categoría: ${orderedCategories.find((item) => item.id === selectedCategoryId)?.name ?? '...'}` : 'Todos los productos'}
              </div>
              <div className="text-[8px] font-black uppercase tracking-widest text-primary/60">{filteredProducts.length} Ítems</div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {isLoadingProducts ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-white/10 gap-2">
                  <PackageSearch className="w-12 h-12" />
                  <p className="font-headline font-black uppercase tracking-widest text-[10px]">Sin productos</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="relative">
                      <ProductCard 
                        product={product} 
                        onClick={() => openEditProductModal(product)} 
                        className={cn(!product.isAvailable && "opacity-50 grayscale-[0.5]")}
                      />
                      {!product.isAvailable && (
                        <div className="absolute top-0 right-0 z-20 pointer-events-none">
                           <span className="bg-red-600 text-white text-[6px] font-black uppercase px-1 py-0.5 rounded-bl-[2px]">PAUSADO</span>
                        </div>
                      )}
                      <div className="absolute top-0 left-0 z-20 pointer-events-none">
                         <span className="bg-black/60 text-white/40 text-[6px] font-black uppercase px-1 py-0.5 rounded-br-[2px] border-r border-b border-white/10">${Number(product.price).toFixed(2)}</span>
                      </div>
                    </div>
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
              <button key={category.id} onClick={() => openEditCategoryModal(category)} className="w-full p-2.5 flex items-center justify-between border-b border-white/5 hover:bg-white/5 text-left">
                <div>
                  <div className="text-[10px] font-black uppercase text-white/90">{category.name}</div>
                  <div className="text-[7px] font-bold uppercase tracking-widest text-white/30">Orden {category.displayOrder ?? 0}</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-black text-white/90">{category._count?.products ?? 0}</div>
                  <div className="text-[7px] font-bold uppercase tracking-widest text-primary/60">{category.isActive ? 'Visible' : 'Oculta'}</div>
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
              <button key={redeemable.id} onClick={() => openEditRedeemableModal(redeemable)} className="w-full p-2.5 flex items-center justify-between border-b border-white/5 hover:bg-white/5 text-left">
                <div>
                  <div className="text-[10px] font-black uppercase text-white/90">{redeemable.product.name}</div>
                  <div className="text-[7px] font-bold uppercase tracking-widest text-white/30">{redeemable.product.category?.name || 'S/C'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-black text-primary">{redeemable.pointsCost} pts</div>
                  <div className="text-[7px] font-bold uppercase tracking-widest text-white/30">{redeemable.isActive ? 'Activo' : 'Pausado'}</div>
                </div>
              </button>
            ))}
          />
        )}
      </div>

      {productModalId !== null && (
        <CompactModal title={typeof productModalId === 'number' ? 'Editar producto' : 'Nuevo producto'} onClose={() => setProductModalId(null)} className="max-w-2xl" bodyClassName="max-h-[85vh] p-3" footer={
          <>
            {typeof productModalId === 'number' && (
              <button onClick={() => deleteProductMutation.mutate(productModalId)} className="px-4 py-2 bg-red-600/10 text-red-500 border border-red-600/20 text-[9px] font-black uppercase tracking-widest hover:bg-red-600/20 transition-all">
                {deleteProductMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => setProductModalId(null)} className="px-5 py-2 bg-white/5 text-white/40 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">Cancelar</button>
            <button onClick={submitProduct} className="px-8 py-2 bg-primary text-black text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_20px_rgba(255,215,0,0.2)]">
              {saveProductMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </>
        }>
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="space-y-3">
              <ProductVisual
                imageUrl={productForm.imageUrl}
                icon={productForm.icon}
                alt={productForm.name || 'Producto'}
                className="h-[140px] border border-white/10 bg-black/40 rounded-[2px]"
                imageClassName="opacity-85"
                emojiClassName="text-5xl"
              />
              <Field label="Icono">
                <select
                  value={productForm.icon}
                  onChange={(e) => setProductForm((current) => ({ ...current, icon: e.target.value }))}
                  className={fieldClassName}
                >
                  {PRODUCT_ICON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.emoji} {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <button onClick={() => setProductForm((c) => ({ ...c, isAvailable: !c.isAvailable }))} className="w-full flex justify-between items-center rounded-[2px] bg-white/[0.03] border border-white/10 px-3 py-2 hover:bg-white/[0.05] transition-all">
                <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Activo</span>
                {productForm.isAvailable ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-white/10" />}
              </button>
            </div>

            <div className="grid gap-3 grid-cols-4">
              <Field label="Nombre" className="col-span-4">
                <input value={productForm.name} onChange={(e) => setProductForm((c) => ({ ...c, name: e.target.value }))} className={fieldClassName} />
              </Field>
              <Field label="Precio" className="col-span-2">
                <input type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm((c) => ({ ...c, price: e.target.value }))} className={fieldClassName} />
              </Field>
              <Field label="Categoría" className="col-span-2">
                <select value={productForm.categoryId} onChange={(e) => setProductForm((c) => ({ ...c, categoryId: e.target.value }))} className={fieldClassName}>
                  <option value="">Seleccione...</option>
                  {orderedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </Field>
              <Field label="URL de imagen" className="col-span-4">
                <input value={productForm.imageUrl} onChange={(e) => setProductForm((c) => ({ ...c, imageUrl: e.target.value }))} className={fieldClassName} placeholder="https://..." />
              </Field>
              <Field label="Descripción" className="col-span-4">
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm((c) => ({ ...c, description: e.target.value }))}
                  className={cn(fieldClassName, 'min-h-[60px] resize-none')}
                  placeholder="Opcional"
                />
              </Field>
            </div>
          </div>
        </CompactModal>
      )}

      {categoryModalId !== null && (
        <CompactModal title={typeof categoryModalId === 'number' ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setCategoryModalId(null)} footer={
          <>
            {typeof categoryModalId === 'number' && (
              <button onClick={() => deleteCategoryMutation.mutate(categoryModalId)} className="px-4 py-2 bg-red-600/10 text-red-500 border border-red-600/20 text-[9px] font-black uppercase tracking-widest hover:bg-red-600/20">
                {deleteCategoryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => setCategoryModalId(null)} className="px-5 py-2 bg-white/5 text-white/40 border border-white/10 text-[9px] font-black uppercase tracking-widest">Cancelar</button>
            <button onClick={submitCategory} className="px-8 py-2 bg-primary text-black text-[9px] font-black uppercase tracking-widest">
              {saveCategoryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </>
        }>
          <div className="space-y-4">
            <Field label="Nombre"><input value={categoryForm.name} onChange={(e) => setCategoryForm((c) => ({ ...c, name: e.target.value }))} className={cn(fieldClassName, "border-white/10 bg-black/40")} /></Field>
            <Field label="Orden"><input type="number" min="0" step="1" value={categoryForm.displayOrder} onChange={(e) => setCategoryForm((c) => ({ ...c, displayOrder: e.target.value }))} className={cn(fieldClassName, "border-white/10 bg-black/40")} /></Field>
            <button onClick={() => setCategoryForm((c) => ({ ...c, isActive: !c.isActive }))} className="w-full flex justify-between items-center bg-white/[0.03] border border-white/10 px-3 py-2.5 transition-all hover:bg-white/[0.05]">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Visible en el menú</span>
              {categoryForm.isActive ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-white/20" />}
            </button>
          </div>
        </CompactModal>
      )}

      {redeemableModalId !== null && (
        <CompactModal title={typeof redeemableModalId === 'number' ? 'Editar canje' : 'Nuevo canje'} onClose={() => setRedeemableModalId(null)} footer={
          <>
            {typeof redeemableModalId === 'number' && (
              <button onClick={() => deleteRedeemableMutation.mutate(redeemableModalId)} className="px-4 py-2 bg-red-600/10 text-red-500 border border-red-600/20 text-[9px] font-black uppercase tracking-widest hover:bg-red-600/20">
                {deleteRedeemableMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => setRedeemableModalId(null)} className="px-5 py-2 bg-white/5 text-white/40 border border-white/10 text-[9px] font-black uppercase tracking-widest">Cancelar</button>
            <button onClick={submitRedeemable} className="px-8 py-2 bg-primary text-black text-[9px] font-black uppercase tracking-widest">
              {saveRedeemableMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </>
        }>
          <div className="space-y-4">
            <Field label="Producto base">
              <select value={redeemableForm.productId} onChange={(e) => setRedeemableForm((c) => ({ ...c, productId: e.target.value }))} className={cn(fieldClassName, "border-white/10 bg-black/40")}>
                <option value="">Seleccione...</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Puntos"><input type="number" min="1" step="1" value={redeemableForm.pointsCost} onChange={(e) => setRedeemableForm((c) => ({ ...c, pointsCost: e.target.value }))} className={cn(fieldClassName, "border-white/10 bg-black/40")} /></Field>
            <button onClick={() => setRedeemableForm((c) => ({ ...c, isActive: !c.isActive }))} className="w-full flex justify-between items-center bg-white/[0.03] border border-white/10 px-3 py-2.5 transition-all hover:bg-white/[0.05]">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Disponible para canje</span>
              {redeemableForm.isActive ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-white/20" />}
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
      <div className="p-2 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="text-[9px] font-black uppercase tracking-widest text-white/40">{title}</div>
        <div className="text-[8px] font-black uppercase tracking-widest text-primary/60">{rows.length} REG.</div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/10 gap-2">
            <Tag className="w-12 h-12" />
            <p className="font-headline font-black uppercase tracking-widest text-[10px]">{emptyMessage}</p>
          </div>
        ) : rows}
      </div>
    </>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block mb-1 text-[8px] font-black uppercase tracking-widest text-white/30">{label}</label>
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
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.96, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} className={cn("relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 shadow-2xl overflow-hidden rounded-[2px]", className)}>
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0f0f0f] px-4 py-3">
          <h3 className="text-[12px] font-headline font-black uppercase tracking-widest text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 bg-white/5 text-white/40 hover:text-white transition-all active:scale-95 border border-white/10 rounded-[2px]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={cn("max-h-[75vh] overflow-y-auto custom-scrollbar p-3", bodyClassName)}>{children}</div>
        <div className="flex justify-end gap-2 border-t border-white/10 bg-[#0f0f0f] px-4 py-3">{footer}</div>
      </motion.div>
    </div>
  );
}
