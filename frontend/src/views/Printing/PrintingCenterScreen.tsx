import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Printer, RefreshCw, Save, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '../../components/ui/ActionButton';
import Switch from '../../components/ui/Switch';
import {
  activatePrintTemplate,
  createPrintTemplate,
  duplicatePrintTemplate,
  getPrintTemplates,
  previewPrintTemplate,
  restoreDefaultPrintTemplate,
  testPrintDocument,
  updatePrintTemplate,
  type PrintTemplateResponse,
  type PrintTemplateSectionResponse,
} from '../../services/api';
import { cn } from '../../lib/utils';

const fieldClass =
  'admin-input';

const fieldClassCompact =
  'w-full rounded-[0.75rem] border border-white/8 bg-black/18 px-2 py-1.5 text-[10px] font-semibold text-on-surface outline-none transition-all focus:border-primary/40';

const SAMPLE_SECTION_CONTENT: Record<string, string> = {
  business_header: 'FATBOY POS DINER',
  branch_info: 'Sucursal Centro · Tel. (664) 123-4567',
  order_info: 'COMANDA #A-1024 · MESA 12 · 07:48 PM',
  cashier_info: 'Cajero: Admin · Mesero: Carlos',
  customer_info: 'Cliente: Mostrador',
  items: '2x TACO ASADA        120.00\n1x REFRESCO            35.00',
  item_modifiers: '  + Sin cebolla\n  + Salsa aparte',
  subtotal: 'Subtotal             155.00',
  discount: 'Descuento             -0.00',
  tax: 'IVA                   24.80',
  total: 'TOTAL                179.80',
  payment_detail: 'Pago: Efectivo        200.00',
  received_amount: 'Recibido             200.00',
  change_amount: 'Cambio                20.20',
  footer: 'Gracias por su compra',
  notes: 'Observaciones: llevar a cocina',
  kitchen_header: 'COMANDA COCINA',
  kitchen_items: '1x BURGER DOBLE\n1x PAPAS GRANDES',
  kitchen_notes: 'SIN TOMATE · EXTRA QUESO',
  shift_header: 'CORTE DE TURNO',
  shift_totals: 'Ventas totales      12,480.00',
  cash_movement_header: 'MOVIMIENTO DE CAJA',
  cash_movement_detail: 'Retiro de efectivo    500.00',
};

const KITCHEN_KEYWORDS = ['KITCHEN', 'COMANDA', 'PREP', 'PRODUCTION'];

const FONT_SIZE_CLASS: Record<NonNullable<PrintTemplateSectionResponse['fontSize']>, string> = {
  small: 'text-[9px] leading-[1.2]',
  normal: 'text-[11px] leading-[1.35]',
  large: 'text-[14px] leading-[1.35]',
  xlarge: 'text-[18px] leading-[1.25]',
};

const ALIGN_CLASS: Record<NonNullable<PrintTemplateSectionResponse['alignment']>, string> = {
  left: 'text-left items-start',
  center: 'text-center items-center',
  right: 'text-right items-end',
};

function getSampleLines(section: PrintTemplateSectionResponse) {
  const key = section.key.toLowerCase();
  const rawBlock =
    SAMPLE_SECTION_CONTENT[key] ??
    section.customLabel ??
    key.replaceAll('_', ' ').toUpperCase();

  return rawBlock.split('\n');
}

function isKitchenDocument(documentType: string) {
  return KITCHEN_KEYWORDS.some((keyword) => documentType.toUpperCase().includes(keyword));
}

function getKitchenSampleLines(section: PrintTemplateSectionResponse) {
  const key = section.key.toLowerCase();

  if (key.includes('header')) {
    return ['MESA 12', 'ORDEN #A-1024'];
  }

  if (key.includes('branch')) {
    return ['MESA: 12'];
  }

  if (key.includes('order')) {
    return ['MESA: 12', 'HORA: 07:48 PM'];
  }

  if (key.includes('cashier') || key.includes('waiter')) {
    return ['CAPTURA: ANA', 'IMPRIMIO: CAJA 1'];
  }

  if (key.includes('customer')) {
    return [];
  }

  if (key === 'items' || key.includes('kitchen_items') || key.includes('product')) {
    return [
      '2X TACO ASADA',
      '  + SIN CEBOLLA',
      '  + SALSA APARTE',
      '1X QUESADILLA HARINA',
      '  + EXTRA QUESO',
      '1X REFRESCO',
    ];
  }

  if (key.includes('modifier')) {
    return [];
  }

  if (key.includes('note')) {
    return [];
  }

  if (key.includes('footer')) {
    return ['CAPTURA: ANA', 'IMPRIMIO: CAJA 1'];
  }

  if (
    key.includes('subtotal') ||
    key.includes('discount') ||
    key.includes('tax') ||
    key.includes('total') ||
    key.includes('payment') ||
    key.includes('received') ||
    key.includes('change')
  ) {
    return [];
  }

  return getSampleLines(section);
}

export function PrintingCenterScreen() {
  const queryClient = useQueryClient();
  const paperWidth: '80' = '80';
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PrintTemplateResponse | null>(null);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<PrintTemplateResponse[]>({
    queryKey: ['print-templates', paperWidth],
    queryFn: () => getPrintTemplates({ paperWidth }),
  });

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplateId(null);
      setDraft(null);
      return;
    }

    const activeTemplate =
      templates.find((template) => template.isActive) ??
      templates[0];

    const nextSelected =
      templates.some((template) => template.id === selectedTemplateId)
        ? selectedTemplateId
        : activeTemplate.id;

    setSelectedTemplateId(nextSelected ?? null);
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setDraft(null);
      return;
    }

    const template = templates.find((entry) => entry.id === selectedTemplateId) ?? null;
    setDraft(template ? JSON.parse(JSON.stringify(template)) : null);
  }, [selectedTemplateId, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const currentDocumentType =
    draft?.documentType ??
    selectedTemplate?.documentType ??
    templates[0]?.documentType ??
    'FAST_FOOD_RECEIPT';

  const previewQuery = useQuery({
    queryKey: ['print-preview', draft?.id, currentDocumentType, paperWidth, JSON.stringify(draft?.sections), JSON.stringify(draft?.fixedTexts), JSON.stringify(draft?.metadata)],
    queryFn: () =>
      previewPrintTemplate({
        documentType: currentDocumentType,
        paperWidth,
        templateId: draft?.id,
        sections: draft?.sections,
        fixedTexts: draft?.fixedTexts,
        metadata: draft?.metadata,
      }),
    enabled: !!draft,
    staleTime: 5000,
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No hay plantilla seleccionada');

      const payload = {
        name: draft.name,
        sections: draft.sections,
        fixedTexts: draft.fixedTexts,
        metadata: draft.metadata,
        printerRouting: draft.printerRouting,
      };

      if (draft.id) {
        return updatePrintTemplate(draft.id, payload);
      }

      return createPrintTemplate({
        ...payload,
        documentType: currentDocumentType,
        paperWidth,
      });
    },
    onSuccess: () => {
      toast.success('Plantilla guardada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
      queryClient.invalidateQueries({ queryKey: ['print-preview'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar'),
  });

  const activateTemplate = useMutation({
    mutationFn: (id: number) => activatePrintTemplate(id),
    onSuccess: () => {
      toast.success('Plantilla activada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'No se pudo activar la plantilla'),
  });

  const duplicateTemplate = useMutation({
    mutationFn: (id: number) => duplicatePrintTemplate(id),
    onSuccess: () => {
      toast.success('Plantilla duplicada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'No se pudo duplicar la plantilla'),
  });

  const restoreTemplate = useMutation({
    mutationFn: () => restoreDefaultPrintTemplate({ documentType: currentDocumentType, paperWidth }),
    onSuccess: () => {
      toast.success('Plantilla por defecto restaurada');
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'No se pudo restaurar la plantilla'),
  });

  const printTest = useMutation({
    mutationFn: () =>
      testPrintDocument({
        documentType: currentDocumentType,
        paperWidth,
        message: `Prueba ${currentDocumentType} ${paperWidth}mm`,
      }),
    onSuccess: () => toast.success('Prueba de impresión enviada'),
    onError: (error: any) => toast.error(error?.message || 'No se pudo imprimir la prueba'),
  });

  const updateSection = (
    sectionId: string,
    patch: Partial<PrintTemplateSectionResponse>,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.key === sectionId ? { ...section, ...patch } : section,
        ),
      };
    });
  };

  const orderedSections = [...(draft?.sections ?? [])].sort((a, b) => a.order - b.order);
  const visualPreviewSections = useMemo(
    () => orderedSections.filter((section) => section.enabled),
    [orderedSections],
  );
  const kitchenPreview = isKitchenDocument(currentDocumentType);
  return (
    <div className="admin-shell h-full p-4">
      <div className="grid h-full grid-cols-[minmax(170px,210px)_minmax(0,1fr)_minmax(280px,340px)] gap-3 overflow-hidden">
        <div className="admin-panel min-h-0 overflow-hidden">
          <div className="admin-section-header">
            <div>
              <p className="admin-eyebrow">Impresión</p>
              <p className="admin-title">Plantillas</p>
            </div>
          </div>
          <div className="max-h-[calc(100%-72px)] overflow-y-auto custom-scrollbar px-3 py-3">
            {loadingTemplates ? (
              <div className="px-3 py-8 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-outline">Cargando plantillas...</div>
            ) : templates.length === 0 ? (
              <div className="px-3 py-8 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-outline">No hay plantillas para este filtro.</div>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    'mb-2 w-full rounded-[0.95rem] border px-3 py-3 text-left transition-all',
                    selectedTemplateId === template.id
                      ? 'border-primary/30 bg-primary/10 shadow-[0_16px_32px_rgba(255,215,0,0.08)]'
                      : 'border-white/8 bg-white/[0.035] hover:border-primary/18 hover:bg-white/[0.05]',
                  )}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-primary">{template.documentType}</p>
                  <p className="mt-1 text-[11px] font-bold text-on-surface">{template.name}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-outline">
                    v{template.version} · {template.isActive ? 'activa' : 'inactiva'} · 80mm
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="admin-panel min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <p className="admin-eyebrow">Editor</p>
              <p className="admin-title !mt-0 text-[0.9rem]">{draft?.name || selectedTemplate?.name || 'Plantilla'}</p>
            </div>
            <div className="flex flex-wrap gap-1 shrink-0">
              <ActionButton variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['print-preview'] })}>
                <RefreshCw className="w-3 h-3" />
                Preview
              </ActionButton>
              <ActionButton variant="secondary" size="sm" onClick={() => draft && duplicateTemplate.mutate(draft.id)} disabled={!draft?.id || duplicateTemplate.isPending}>
                <Copy className="w-3 h-3" />
                Duplicar
              </ActionButton>
              <ActionButton variant="secondary" size="sm" onClick={() => draft && activateTemplate.mutate(draft.id)} disabled={!draft?.id || activateTemplate.isPending || draft?.isActive}>
                <Sparkles className="w-3 h-3" />
                Activar
              </ActionButton>
              <ActionButton variant="secondary" size="sm" onClick={() => restoreTemplate.mutate()} disabled={restoreTemplate.isPending || !draft}>
                <RefreshCw className="w-3 h-3" />
                Restaurar
              </ActionButton>
              <ActionButton variant="primary" size="sm" onClick={() => saveTemplate.mutate()} disabled={!draft || saveTemplate.isPending}>
                {saveTemplate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </ActionButton>
            </div>
          </div>
          {draft ? (
            <div className="h-[calc(100%-76px)] min-h-0 overflow-auto p-2 custom-scrollbar">
              <div className="min-w-[520px]">
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_56px_84px_84px_56px_56px] gap-1.5 px-1 text-[8px] font-black uppercase tracking-[0.14em] text-outline">
                  <span>Bloque</span>
                  <span>Etiqueta</span>
                  <span className="text-center">Orden</span>
                  <span>Alineación</span>
                  <span>Tamaño</span>
                  <span className="text-center">On</span>
                  <span className="text-center">Bold</span>
                </div>

                <div className="space-y-1.5">
                  {orderedSections.map((section) => (
                    <div
                      key={section.key}
                      className={cn(
                        'grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_56px_84px_84px_56px_56px] items-center gap-1.5 rounded-[0.85rem] border border-white/8 bg-white/[0.03] px-2.5 py-1.5',
                        !section.enabled && 'opacity-55 grayscale-[0.35]',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.06em] text-on-surface/80">{section.key}</p>
                      </div>
                      <input
                        className={fieldClassCompact}
                        value={section.customLabel ?? ''}
                        placeholder={section.key}
                        onChange={(e) => updateSection(section.key, { customLabel: e.target.value })}
                      />
                      <input
                        className={cn(fieldClassCompact, 'text-center')}
                        type="number"
                        value={section.order}
                        onChange={(e) => updateSection(section.key, { order: Number(e.target.value) })}
                      />
                      <select className={fieldClassCompact} value={section.alignment} onChange={(e) => updateSection(section.key, { alignment: e.target.value as any })}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                      <select className={fieldClassCompact} value={section.fontSize} onChange={(e) => updateSection(section.key, { fontSize: e.target.value as any })}>
                        <option value="small">Small</option>
                        <option value="normal">Normal</option>
                        <option value="large">Large</option>
                        <option value="xlarge">XLarge</option>
                      </select>
                      <div className="flex justify-center">
                        <Switch checked={section.enabled} onChange={(checked) => updateSection(section.key, { enabled: checked })} ariaLabel={`Habilitar ${section.key}`} className="scale-[0.62] origin-center" />
                      </div>
                      <div className="flex justify-center">
                        <Switch checked={section.bold} onChange={(checked) => updateSection(section.key, { bold: checked })} ariaLabel={`Negritas ${section.key}`} className="scale-[0.62] origin-center" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[calc(100%-76px)] items-center justify-center text-[11px] font-bold uppercase tracking-[0.12em] text-outline">
              Selecciona una plantilla para editar.
            </div>
          )}
        </div>

        <div className="admin-panel min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
            <p className="admin-title !mt-0 text-[0.88rem] leading-none">Vista previa</p>
            <ActionButton variant="secondary" size="sm" className="min-h-[2.15rem] px-2.5 !text-[9px]" onClick={() => printTest.mutate()} disabled={printTest.isPending}>
              {printTest.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
              Prueba impresión
            </ActionButton>
          </div>
          <div className="h-[calc(100%-88px)] p-3">
              <div className="h-full min-h-0 overflow-hidden rounded-[1rem] border border-white/8 bg-white/[0.03]">
                <div className="border-b border-white/8 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-outline flex justify-between items-center">
                  <span>{previewQuery.isLoading ? 'Generando preview...' : 'Vista previa'}</span>
                  <span className="text-primary/70">{paperWidth}mm</span>
                </div>
                <div className="h-[calc(100%-43px)] overflow-y-auto bg-[#f6f2ea] px-4 py-6 shadow-inner custom-scrollbar border-t border-gray-200/70">
                  <div className="mx-auto border-x border-dashed border-gray-200 bg-white p-5 font-mono text-[#141414] shadow-[0_0_40px_rgba(0,0,0,0.05)]" style={{ width: paperWidth === '80' ? '320px' : '240px' }}>
                    {visualPreviewSections.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {visualPreviewSections.map((section) => {
                          const spacing = Math.max(0, Math.min(section.spacing ?? 0, 3));
                          const lines = kitchenPreview ? getKitchenSampleLines(section) : getSampleLines(section);

                          if (lines.length === 0) {
                            return null;
                          }

                          return (
                            <React.Fragment key={section.key}>
                              {section.dividerBefore ? <div className="border-t border-dashed border-black/55 pt-2" /> : null}
                              <div
                                className={cn(
                                  'flex flex-col whitespace-pre-wrap',
                                  FONT_SIZE_CLASS[section.fontSize],
                                  ALIGN_CLASS[section.alignment],
                                  section.bold && 'font-bold',
                                )}
                                style={{ marginBottom: `${spacing * 6}px` }}
                              >
                                {lines.map((line, index) => (
                                  <div key={`${section.key}-${index}`} className="w-full">
                                    {line}
                                  </div>
                                ))}
                              </div>
                              {section.dividerAfter ? <div className="border-t border-dashed border-black/55 pt-2" /> : null}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">
                        Seleccione una plantilla del catálogo para visualizar la simulación.
                      </div>
                    )}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
