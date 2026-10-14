"use client";

import React, { useState, useEffect } from "react";
import {
  Edit3,
  DollarSign,
  Truck,
  Package,
  TrendingUp,
  AlertTriangle,
  X,
  Plus,
  CheckCircle2,
  Barcode,
} from "lucide-react";
import { updateDishInventoryAction } from "@/lib/inventory-actions";
import { ResolvedBusinessLabels } from "@/lib/business-labels";

interface QuickEditDishInventoryModalProps {
  isOpen: boolean;
  dish: any | null;
  suppliers: any[];
  onClose: () => void;
  onSuccess: (updatedDish: any) => void;
  onOpenNewSupplier: () => void;
  restaurantId: string;
  bLabels: ResolvedBusinessLabels;
}

export default function QuickEditDishInventoryModal({
  isOpen,
  dish,
  suppliers,
  onClose,
  onSuccess,
  onOpenNewSupplier,
  restaurantId,
  bLabels,
}: QuickEditDishInventoryModalProps) {
  const [costPrice, setCostPrice] = useState("");
  const [price, setPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [trackStock, setTrackStock] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (dish) {
      setCostPrice(
        typeof dish.costPrice === "number" ? dish.costPrice.toString() : "0"
      );
      setPrice(typeof dish.price === "number" ? dish.price.toString() : "0");
      setSupplierId(dish.supplierId || dish.supplier?.id || "");
      setStock(typeof dish.stock === "number" ? dish.stock.toString() : "0");
      setMinStock(
        typeof dish.minStock === "number" ? dish.minStock.toString() : "0"
      );
      setTrackStock(Boolean(dish.trackStock));
      setBarcode(dish.barcode || dish.sku || "");
      setErrorMsg(null);
    }
  }, [dish]);

  if (!isOpen || !dish) return null;

  const numCost = parseFloat(costPrice) || 0;
  const numPrice = parseFloat(price) || 0;
  const profit = numPrice - numCost;
  const marginPct = numPrice > 0 ? (profit / numPrice) * 100 : 0;
  const isNegativeMargin = numPrice > 0 && numCost > numPrice;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await updateDishInventoryAction(restaurantId, dish.id, {
        costPrice: Math.max(0, numCost),
        price: Math.max(0, numPrice),
        supplierId: supplierId.trim() !== "" ? supplierId : null,
        stock: trackStock ? parseInt(stock, 10) || 0 : null,
        minStock: parseInt(minStock, 10) || 0,
        trackStock,
        barcode: barcode.trim() || null,
        sku: barcode.trim() || null,
      });

      setSaving(false);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.dish) {
        onSuccess(res.dish);
        onClose();
      }
    } catch (err: any) {
      setSaving(false);
      setErrorMsg(err.message || "Error al actualizar");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Edit3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Editar Costo & Proveedor
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {dish.name} {dish.category?.name ? `[${dish.category.name}]` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Costo de compra y Precio de venta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Costo de Compra ($)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 pl-7 pr-3 py-2.5 rounded-xl text-white text-xs font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Precio de Venta ($)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 pl-7 pr-3 py-2.5 rounded-xl text-white text-xs font-mono font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Indicador en vivo de Margen Comercial */}
          {numPrice > 0 && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isNegativeMargin
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : marginPct > 50
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold">
                  {isNegativeMargin
                    ? "⚠️ Alerta: Costo supera al precio de venta"
                    : "Margen Bruto Unitario:"}
                </span>
              </div>
              <div className="text-right font-mono font-black">
                <span>
                  {profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`}
                </span>
                <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-black/40">
                  {marginPct.toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* Proveedor Habitual */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-amber-400" />
                <span>Proveedor Habitual</span>
              </label>
              <button
                type="button"
                onClick={onOpenNewSupplier}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Registrar Proveedor</span>
              </button>
            </div>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3 py-2.5 rounded-xl text-white text-xs focus:outline-none"
            >
              <option value="">-- Sin proveedor habitual asignado --</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} {sup.contactName ? `(${sup.contactName})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Existencias y Stock Mínimo */}
          <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                <span>Control de Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                />
                <span className="text-[11px] text-slate-400">Activar conteo</span>
              </label>
            </div>

            {trackStock && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Stock Actual ({bLabels.stockUnitPlural})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 px-3 py-2 rounded-xl text-white text-xs font-mono font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Alerta Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 px-3 py-2 rounded-xl text-white text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Código de barras / SKU */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Barcode className="h-3.5 w-3.5 text-slate-400" />
              <span>Código de Barras / SKU</span>
              <span className="text-[10px] text-slate-500 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="ej: EMP-001 o 786123456789"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3 py-2.5 rounded-xl text-white text-xs font-mono focus:outline-none"
            />
          </div>

          {/* Footer botones */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg transition disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
