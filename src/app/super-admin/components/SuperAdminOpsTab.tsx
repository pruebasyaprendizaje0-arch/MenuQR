"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Activity,
  Database,
  Radio,
  Mail,
  HardDrive,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { checkInfrastructureHealthAction } from "@/lib/superadmin-extra-actions";

export interface OpsTabProps {
  restaurants: any[];
  manualPayments: any[];
  leads: any[];
}

export function SuperAdminOpsTab({ restaurants, manualPayments, leads }: OpsTabProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [healthData, setHealthData] = useState<{
    db: { status: "OK" | "WARNING" | "ERROR"; latencyMs: number; message: string };
    evolution: { status: "OK" | "WARNING" | "ERROR"; latencyMs: number; url: string; message: string };
    email: { status: "OK" | "WARNING" | "ERROR"; provider: string; message: string };
    timestamp: string;
  } | null>(null);

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const res = await checkInfrastructureHealthAction();
      if (res?.success && res.health) {
        setHealthData(res.health);
      }
    } catch (err) {
      console.error("Error running health check:", err);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  // Función genérica para descargar CSV con UTF-8 BOM para compatibilidad total con Excel
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent =
      "\uFEFF" + // BOM UTF-8
      headers.map(escapeCsv).join(",") +
      "\n" +
      rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Directorio de Clientes
  const handleExportClients = () => {
    const headers = [
      "ID",
      "Nombre Comercio",
      "Slug",
      "Vertical",
      "Dueño / Contacto",
      "Email",
      "WhatsApp",
      "Plan",
      "Ciudad",
      "Provincia",
      "Total Platos",
      "Total Pedidos",
      "Suspendido",
      "Vencimiento Prueba",
      "Fecha Registro",
    ];

    const rows = restaurants.map((r) => [
      r.id,
      r.name,
      r.slug,
      r.businessType || "RESTAURANT",
      r.userName || "",
      r.email || "",
      r.whatsappNumber || r.whatsapp || "",
      r.plan || "FREE",
      r.city || "",
      r.province || "",
      r.health?.totalDishes || 0,
      r.health?.totalOrders || 0,
      r.isSuspended ? "SÍ" : "NO",
      r.trialEndsAt ? r.trialEndsAt.split("T")[0] : "",
      r.createdAt ? r.createdAt.split("T")[0] : "",
    ]);

    downloadCsv("directorio_clientes_menuqr", headers, rows);
  };

  // Exportar Reporte Contable de Pagos
  const handleExportPayments = () => {
    const headers = [
      "ID Pago",
      "Comercio",
      "Plan",
      "Monto ($)",
      "Moneda",
      "Método",
      "Referencia",
      "Estado",
      "Aprobado Por",
      "Fecha Creación",
      "Fecha Aprobación",
    ];

    const rows = manualPayments.map((p) => [
      p.id,
      p.restaurant?.name || "Sin Asignar",
      p.plan || "PRO",
      p.amount || 0,
      p.currency || "USD",
      p.method || "",
      p.reference || "",
      p.status || "",
      p.approvedBy || "",
      p.createdAt ? p.createdAt.split("T")[0] : "",
      p.approvedAt ? p.approvedAt.split("T")[0] : "",
    ]);

    downloadCsv("reporte_contable_pagos", headers, rows);
  };

  // Exportar Prospectos / Leads
  const handleExportLeads = () => {
    const headers = [
      "ID",
      "Nombre Negocio",
      "Contacto",
      "Teléfono",
      "Email",
      "Ciudad",
      "Estado CRM",
      "Próximo Seguimiento",
      "Notas",
      "Fecha Registro",
    ];

    const rows = leads.map((l) => [
      l.id,
      l.name,
      l.ownerName || "",
      l.phone || "",
      l.email || "",
      l.city || "",
      l.status || "NUEVO",
      l.nextFollowUpAt ? l.nextFollowUpAt.split("T")[0] : "",
      l.notes || "",
      l.createdAt ? l.createdAt.split("T")[0] : "",
    ]);

    downloadCsv("leads_prospectos_crm", headers, rows);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 text-blue-400 mb-2">
            <Server className="w-3.5 h-3.5" />
            <span>Infraestructura, DevOps & Exportaciones</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Salud del Servidor & Reportes Contables
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Monitoreo en tiempo real de servicios clave y descarga de reportes oficiales en formato Excel/CSV.
          </p>
        </div>

        <button
          onClick={runHealthCheck}
          disabled={isChecking}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-blue-400" : ""}`} />
          <span>{isChecking ? "Comprobando..." : "Comprobar Servicios"}</span>
        </button>
      </div>

      {/* Grid de Monitoreo de Infraestructura */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Estado de Infraestructura & Microservicios</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Base de Datos PostgreSQL */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    healthData?.db?.status === "OK"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : healthData?.db?.status === "WARNING"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}
                >
                  {healthData?.db?.status || "VERIFICANDO"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">Base de Datos PostgreSQL</h4>
              <p className="text-xs text-slate-400 mt-1">Motor de datos unificado & Multi-Tenant.</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 font-mono">
              {healthData?.db?.message || "Comprobando ping..."}
            </div>
          </div>

          {/* WhatsApp Evolution API */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Radio className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    healthData?.evolution?.status === "OK"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : healthData?.evolution?.status === "WARNING"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}
                >
                  {healthData?.evolution?.status || "VERIFICANDO"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">WhatsApp Evolution API</h4>
              <p className="text-xs text-slate-400 mt-1">Conectividad Baileys & Webhooks.</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 font-mono truncate">
              {healthData?.evolution?.message || "Verificando endpoint..."}
            </div>
          </div>

          {/* Servicio de Correo Electrónico */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Mail className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    healthData?.email?.status === "OK"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {healthData?.email?.status || "VERIFICANDO"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">Correos Transaccionales</h4>
              <p className="text-xs text-slate-400 mt-1">
                {healthData?.email?.provider || "Resend API / SMTP"}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 font-mono truncate">
              {healthData?.email?.message || "Comprobando..."}
            </div>
          </div>

          {/* Almacenamiento Persistente */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <HardDrive className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  PERSISTENTE
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">Volumen de Subidas</h4>
              <p className="text-xs text-slate-400 mt-1">Ruta física: /public/uploads</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 font-mono">
              Fotos y Logos protegidos
            </div>
          </div>
        </div>
      </div>

      {/* Centro de Descarga de Reportes CSV / Excel */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Exportación de Reportes Oficiales (.csv / Excel)</h3>
            <p className="text-xs text-slate-400">
              Archivos con codificación UTF-8 BOM para apertura perfecta en Excel sin errores de tildes o caracteres especiales.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tarjeta 1: Directorio de Clientes */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">
                Base de Datos Completa
              </span>
              <h4 className="text-base font-bold text-white">Directorio de Clientes</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Exporta la lista de los {restaurants.length} comercios registrados con datos de contacto, plan, ciudad y estado.
              </p>
            </div>
            <button
              onClick={handleExportClients}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Directorio (.csv)</span>
            </button>
          </div>

          {/* Tarjeta 2: Reporte Contable de Pagos */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                Contabilidad & Suscripciones
              </span>
              <h4 className="text-base font-bold text-white">Reporte de Pagos Manuales</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Exporta el histórico de {manualPayments.length} comprobantes con monto en $, banco, referencia y fecha de aprobación.
              </p>
            </div>
            <button
              onClick={handleExportPayments}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Pagos (.csv)</span>
            </button>
          </div>

          {/* Tarjeta 3: Prospectos / Leads */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                Fuerza de Ventas & Marketing
              </span>
              <h4 className="text-base font-bold text-white">Prospectos / Leads CRM</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Exporta la lista de {leads.length} prospectos comerciales para campañas de WhatsApp marketing o llamadas.
              </p>
            </div>
            <button
              onClick={handleExportLeads}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Leads (.csv)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
