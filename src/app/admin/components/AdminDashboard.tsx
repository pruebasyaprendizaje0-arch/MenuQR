"use client";

import { useState } from "react";
import { 
  logoutUserAction, 
  updateRestaurantAction, 
  createCategoryAction, 
  updateCategoryAction, 
  deleteCategoryAction,
  createDishAction,
  updateDishAction,
  deleteDishAction,
  toggleDishAvailabilityAction
} from "@/lib/actions";
import { 
  Store, 
  FolderHeart, 
  Soup, 
  QrCode, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  ExternalLink,
  Check,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
};

type Category = {
  id: string;
  name: string;
  order: number;
  dishes: Dish[];
};

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  paymentQrUrl: string | null;
  whatsappNumber: string;
  themeColor: string;
  password: string;
  trialEndsAt: string | Date;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  address: string | null;
  description: string | null;
  locality: string | null;
  schedule: string | null;
  specialty: string | null;
  services: string | null;
  contactNumbers: string | null;
  ubicameUrl: string | null;
  categories: Category[];
};

export function AdminDashboard({ restaurant }: { restaurant: Restaurant }) {
  const [activeTab, setActiveTab] = useState<"restaurant" | "categories" | "dishes" | "qr">("restaurant");
  const [copied, setCopied] = useState(false);
  
  const downloadQR = () => {
    const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR-${restaurant.slug}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };
  
  // States for Category Dialogs
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOrder, setNewCatOrder] = useState("0");

  // States for Dish Dialogs
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishPrice, setDishPrice] = useState("0");
  const [dishCatId, setDishCatId] = useState("");
  const [dishAvailable, setDishAvailable] = useState(true);
  const [dishImageUrl, setDishImageUrl] = useState("");

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/${restaurant.slug}` : `/${restaurant.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleDish = async (dishId: string, currentStatus: boolean) => {
    await toggleDishAvailabilityAction(dishId, !currentStatus);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-10 w-10 rounded-xl object-cover border border-slate-700" />
            ) : (
              <div className="h-10 w-10 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center font-bold text-white">
                {restaurant.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white line-clamp-1">{restaurant.name}</h1>
              <p className="text-xs text-slate-400">Panel Admin</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab("restaurant")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "restaurant" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Store className="h-4 w-4" />
              Restaurante
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "categories" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FolderHeart className="h-4 w-4" />
              Categorías
            </button>
            <button
              onClick={() => setActiveTab("dishes")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "dishes" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Soup className="h-4 w-4" />
              Platos
            </button>
            <button
              onClick={() => setActiveTab("qr")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "qr" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <QrCode className="h-4 w-4" />
              Código QR
            </button>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800">
          <a
            href={`/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-3 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-all"
          >
            Ver Menú Público
            <ExternalLink className="h-3 w-3" />
          </a>
          <form action={logoutUserAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-red-950/40 text-red-400 hover:bg-red-900/30 border border-red-900/40 transition-all"
            >
              <LogOut className="h-4.5 w-4.5" />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-5xl overflow-y-auto space-y-6">
        {/* Trial Period Banner */}
        {(() => {
          const trialEnds = new Date(restaurant.trialEndsAt);
          const now = new Date();
          const isExpired = trialEnds < now;
          const daysRemaining = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

          return (
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-sm ${
              isExpired 
                ? "bg-red-500/10 border-red-500/30 text-red-400" 
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              <div>
                <span className="font-bold">{isExpired ? "Demo Expirada" : "Demo Activa (Prueba de 30 días)"}</span>
                <p className="text-xs text-slate-400 mt-1">
                  {isExpired 
                    ? "Tu período de prueba ha terminado. Ponte en contacto para renovar." 
                    : `Tu período de prueba finaliza el ${trialEnds.toLocaleDateString()}. Te quedan ${daysRemaining} días.`}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isExpired ? "bg-red-500/20" : "bg-amber-500/20"
              }`}>
                {isExpired ? "Inactivo" : `${daysRemaining} días`}
              </span>
            </div>
          );
        })()}

        {/* Restaurante Tab */}
        {activeTab === "restaurant" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Configuración del Restaurante</h2>
              <p className="text-slate-400 text-sm">Edita la información de tu marca, colores del tema y WhatsApp para pedidos.</p>
            </div>
            
            <form 
              action={async (formData) => {
                await updateRestaurantAction(restaurant.id, formData);
                alert("Restaurante actualizado correctamente.");
              }}
              className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-md"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Restaurante</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={restaurant.name}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Slug único (Ruta web)</label>
                  <input
                    type="text"
                    name="slug"
                    defaultValue={restaurant.slug}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">WhatsApp para pedidos (Código país + número)</label>
                  <input
                    type="text"
                    name="whatsappNumber"
                    defaultValue={restaurant.whatsappNumber}
                    placeholder="ej: 5491123456789"
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Usa código de país sin el signo &quot;+&quot;. Ejemplo: 5491123456789</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Color del tema (Código Hexadecimal)</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      name="themeColor"
                      defaultValue={restaurant.themeColor}
                      className="h-12 w-12 rounded-xl bg-transparent border-0 cursor-pointer overflow-hidden shrink-0"
                    />
                    <input
                      type="text"
                      name="themeColorText"
                      disabled
                      value={restaurant.themeColor}
                      className="w-full bg-slate-950/60 border border-slate-850 block px-4 py-3 rounded-xl text-slate-400 focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Descripción del Negocio / Slogan</label>
                  <textarea
                    name="description"
                    defaultValue={restaurant.description || ""}
                    rows={3}
                    placeholder="ej: Auténtica pizza napolitana al horno de leña, pastas artesanales y el mejor ambiente familiar de Manta."
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Dirección Física</label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={restaurant.address || ""}
                    placeholder="ej: Av. Barbasquillo y Calle 24, Manta, Ecuador"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Localidad / Ciudad / Provincia</label>
                  <input
                    type="text"
                    name="locality"
                    list="localidades-sug"
                    defaultValue={restaurant.locality || ""}
                    placeholder="Escribe o selecciona tu localidad..."
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <datalist id="localidades-sug">
                    <option value="Salinas, Santa Elena" />
                    <option value="La Libertad, Santa Elena" />
                    <option value="Santa Elena (Centro), Santa Elena" />
                    <option value="Montañita, Santa Elena" />
                    <option value="Olón, Santa Elena" />
                    <option value="Manglaralto, Santa Elena" />
                    <option value="Ballenita, Santa Elena" />
                    <option value="Ayangue, Santa Elena" />
                    <option value="Manta, Manabí" />
                    <option value="Portoviejo, Manabí" />
                    <option value="Guayaquil, Guayas" />
                    <option value="Quito, Pichincha" />
                    <option value="Cuenca, Azuay" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Horario de Atención</label>
                  <input
                    type="text"
                    name="schedule"
                    defaultValue={restaurant.schedule || ""}
                    placeholder="ej: Lunes a Domingo: 12:00 PM - 11:00 PM"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Especialidad de la Casa</label>
                  <input
                    type="text"
                    name="specialty"
                    defaultValue={restaurant.specialty || ""}
                    placeholder="ej: Pizza Napolitana & Pastas Artesanales"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Servicios y Facilidades (Separados por comas)</label>
                  <input
                    type="text"
                    name="services"
                    defaultValue={restaurant.services || ""}
                    placeholder="ej: Wi-Fi, Estacionamiento, Pet Friendly, Delivery"
                    className="w-full bg-slate-950 border border-slate-850 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Números de Contacto Adicionales (Separados por comas)</label>
                  <input
                    type="text"
                    name="contactNumbers"
                    defaultValue={restaurant.contactNumbers || ""}
                    placeholder="ej: +593 99 999 9999, +593 5 262 1234"
                    className="w-full bg-slate-950 border border-slate-850 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Instagram (URL o usuario)</label>
                  <input
                    type="text"
                    name="instagram"
                    defaultValue={restaurant.instagram || ""}
                    placeholder="ej: https://instagram.com/mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Facebook (URL)</label>
                  <input
                    type="text"
                    name="facebook"
                    defaultValue={restaurant.facebook || ""}
                    placeholder="ej: https://facebook.com/mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">TikTok (URL)</label>
                  <input
                    type="text"
                    name="tiktok"
                    defaultValue={restaurant.tiktok || ""}
                    placeholder="ej: https://tiktok.com/@mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ubicame.info (URL)</label>
                  <input
                    type="text"
                    name="ubicameUrl"
                    defaultValue={restaurant.ubicameUrl || ""}
                    placeholder="ej: https://ubicame.info/mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Imagen de Logo (Subir archivo)</label>
                  <input
                    type="file"
                    name="logoFile"
                    accept="image/*"
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-850 file:text-white hover:file:bg-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">O pegar URL de logo existente</label>
                  <input
                    type="text"
                    name="logoUrl"
                    defaultValue={restaurant.logoUrl || ""}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">QR de Cobro - Deuna / Transferencia (Subir archivo)</label>
                  <input
                    type="file"
                    name="paymentQrFile"
                    accept="image/*"
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-850 file:text-white hover:file:bg-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">O pegar URL de QR de Cobro</label>
                  <input
                    type="text"
                    name="paymentQrUrl"
                    defaultValue={restaurant.paymentQrUrl || ""}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6">
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña del Panel Admin</label>
                  <input
                    type="password"
                    name="password"
                    defaultValue={restaurant.password}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-lg shadow-red-950/20 transition-all duration-200"
                >
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Categorías Tab */}
        {activeTab === "categories" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Categorías</h2>
                <p className="text-slate-400 text-sm">Organiza tu menú por secciones como Entradas, Pizzas, Bebidas.</p>
              </div>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setNewCatName("");
                  setNewCatOrder("0");
                  setIsCategoryModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nueva Categoría
              </button>
            </div>

            {/* List of categories */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/60">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Orden</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Cantidad Platos</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {restaurant.categories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                        No hay categorías creadas aún.
                      </td>
                    </tr>
                  ) : (
                    restaurant.categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{cat.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{cat.order}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{cat.dishes.length} platos</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setNewCatName(cat.name);
                              setNewCatOrder(cat.order.toString());
                              setIsCategoryModalOpen(true);
                            }}
                            className="inline-flex p-2 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <Edit2 className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Estás seguro de eliminar la categoría "${cat.name}"? Se borrarán todos sus platos.`)) {
                                await deleteCategoryAction(cat.id);
                              }
                            }}
                            className="inline-flex p-2 text-red-500/80 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 rounded-lg border border-red-900/20 transition-all"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Category Add/Edit Modal */}
            {isCategoryModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
                  <h3 className="text-lg font-bold text-white mb-4">
                    {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
                  </h3>
                  <form
                    action={async (formData) => {
                      if (editingCategory) {
                        await updateCategoryAction(editingCategory.id, formData);
                      } else {
                        await createCategoryAction(restaurant.id, formData);
                      }
                      setIsCategoryModalOpen(false);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de la Categoría</label>
                      <input
                        type="text"
                        name="name"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="ej: Pizzas, Pastas, Postres"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Orden de visualización</label>
                      <input
                        type="number"
                        name="order"
                        value={newCatOrder}
                        onChange={(e) => setNewCatOrder(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-500 hover:to-amber-500 transition"
                      >
                        {editingCategory ? "Guardar Cambios" : "Crear"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Platos Tab */}
        {activeTab === "dishes" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Platos del Menú</h2>
                <p className="text-slate-400 text-sm">Gestiona la carta completa: precios, imágenes y disponibilidad.</p>
              </div>
              <button
                disabled={restaurant.categories.length === 0}
                onClick={() => {
                  setEditingDish(null);
                  setDishName("");
                  setDishDescription("");
                  setDishPrice("0");
                  setDishImageUrl("");
                  setDishAvailable(true);
                  setDishCatId(restaurant.categories[0]?.id || "");
                  setIsDishModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nuevo Plato
              </button>
            </div>

            {restaurant.categories.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-300">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                Debes crear al menos una categoría antes de agregar platos.
              </div>
            ) : (
              <div className="space-y-8">
                {restaurant.categories.map((cat) => (
                  <div key={cat.id} className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <span className="text-red-500">#</span> {cat.name}
                    </h3>
                    
                    {cat.dishes.length === 0 ? (
                      <p className="text-slate-500 text-xs italic">No hay platos en esta categoría.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cat.dishes.map((dish) => (
                          <div 
                            key={dish.id} 
                            className={`bg-slate-900/40 border rounded-2xl p-4 flex gap-4 transition-all ${
                              dish.isAvailable ? "border-slate-800/80" : "border-slate-900 opacity-60"
                            }`}
                          >
                            {/* Image */}
                            <div className="h-20 w-20 rounded-xl bg-slate-950 overflow-hidden shrink-0 border border-slate-800 relative">
                              {dish.imageUrl ? (
                                <img src={dish.imageUrl} alt={dish.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-xs text-slate-600">Sin foto</div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className="font-bold text-white text-sm line-clamp-1">{dish.name}</h4>
                                  <span className="text-red-400 font-bold text-sm shrink-0">${dish.price.toFixed(2)}</span>
                                </div>
                                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{dish.description || "Sin descripción."}</p>
                              </div>

                              <div className="flex justify-between items-center pt-2">
                                {/* Availability toggle */}
                                <button
                                  onClick={() => handleToggleDish(dish.id, dish.isAvailable)}
                                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                    dish.isAvailable 
                                      ? "bg-green-500/10 text-green-400 border-green-500/30" 
                                      : "bg-red-500/10 text-red-400 border-red-500/30"
                                  }`}
                                >
                                  {dish.isAvailable ? (
                                    <>
                                      <Eye className="h-3 w-3" /> Disponible
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="h-3 w-3" /> Agotado
                                    </>
                                  )}
                                </button>

                                {/* Edit / Delete Actions */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingDish(dish);
                                      setDishName(dish.name);
                                      setDishDescription(dish.description || "");
                                      setDishPrice(dish.price.toString());
                                      setDishImageUrl(dish.imageUrl || "");
                                      setDishAvailable(dish.isAvailable);
                                      setDishCatId(dish.categoryId);
                                      setIsDishModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 transition"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`¿Estás seguro de eliminar el plato "${dish.name}"?`)) {
                                        await deleteDishAction(dish.id);
                                      }
                                    }}
                                    className="p-1.5 text-red-400/80 hover:text-red-400 bg-red-950/20 border border-red-900/20 rounded-lg hover:bg-red-950/40 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dish Add/Edit Modal */}
            {isDishModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-y-auto max-h-[90vh]">
                  <h3 className="text-lg font-bold text-white mb-4">
                    {editingDish ? "Editar Plato" : "Nuevo Plato"}
                  </h3>
                  <form
                    action={async (formData) => {
                      // Append explicitly isAvailable since toggle has client state
                      formData.append("isAvailable", dishAvailable.toString());
                      
                      if (editingDish) {
                        await updateDishAction(editingDish.id, formData);
                      } else {
                        await createDishAction(dishCatId, formData);
                      }
                      setIsDishModalOpen(false);
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Plato</label>
                        <input
                          type="text"
                          name="name"
                          value={dishName}
                          onChange={(e) => setDishName(e.target.value)}
                          required
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Categoría</label>
                        <select
                          name="categoryId"
                          value={dishCatId}
                          onChange={(e) => setDishCatId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                        >
                          {restaurant.categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Precio ($)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                          <input
                            type="number"
                            name="price"
                            step="0.01"
                            value={dishPrice}
                            onChange={(e) => setDishPrice(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-850 block pl-8 pr-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
                      <textarea
                        name="description"
                        rows={2}
                        value={dishDescription}
                        onChange={(e) => setDishDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                        placeholder="ej: Mozzarella, albahaca y orégano..."
                      />
                    </div>

                    <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Imagen de Plato (Subir archivo)</label>
                        <input
                          type="file"
                          name="dishFile"
                          accept="image/*"
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-850 file:text-white hover:file:bg-slate-800 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">O pegar URL de imagen</label>
                        <input
                          type="text"
                          name="imageUrl"
                          value={dishImageUrl}
                          onChange={(e) => setDishImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2 rounded-xl text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center">
                      <input
                        type="checkbox"
                        id="isAvailable"
                        checked={dishAvailable}
                        onChange={(e) => setDishAvailable(e.target.checked)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-800 rounded bg-slate-950"
                      />
                      <label htmlFor="isAvailable" className="ml-2 block text-sm text-slate-300 font-medium">
                        Disponible para ordenar inmediatamente
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsDishModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-500 hover:to-amber-500 transition"
                      >
                        {editingDish ? "Guardar Cambios" : "Crear Plato"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Código QR Tab */}
        {activeTab === "qr" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Generador de Código QR</h2>
              <p className="text-slate-400 text-sm">Descarga e imprime este código QR para colocar en las mesas. Al escanearlo, tus clientes verán el menú digital.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* QR display card */}
              <div className="md:col-span-1 bg-white p-6 rounded-3xl flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group">
                <div className="bg-white p-2 rounded-2xl border border-slate-200">
                  <QRCodeCanvas
                    id="qr-canvas"
                    value={publicUrl}
                    size={256}
                    level={"H"}
                    includeMargin={true}
                  />
                </div>
                <button
                  onClick={downloadQR}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-850 transition-all text-center"
                >
                  Descargar QR para imprimir
                </button>
              </div>

              {/* QR instructions and details */}
              <div className="md:col-span-2 space-y-6 bg-slate-900/50 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md">
                <div>
                  <h3 className="font-bold text-white text-lg">Enlace del Menú</h3>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="w-full bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-slate-300 text-sm focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-3 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 transition flex items-center gap-1.5 shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-green-400" />
                          Copiado
                        </>
                      ) : (
                        "Copiar Enlace"
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-6 space-y-4 text-sm text-slate-300">
                  <h4 className="font-bold text-white">¿Cómo funciona?</h4>
                  <ul className="list-disc pl-5 space-y-2 text-slate-400">
                    <li>Coloca el código QR en un portarretratos, sticker o en las mesas de tu restaurante.</li>
                    <li>Los comensales lo escanean con su teléfono celular sin descargar aplicaciones.</li>
                    <li>Arman su pedido directamente en la web seleccionando los platos de tu carta.</li>
                    <li>El pedido se envía formateado a tu WhatsApp de forma instantánea.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
