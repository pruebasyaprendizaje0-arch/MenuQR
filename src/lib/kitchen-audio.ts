// src/lib/kitchen-audio.ts
// Motor de audio profesional para Módulo Cocina y Mesero (Web Audio API + Audio WAV/MP3)

class KitchenAudioManager {
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;
  private audioElements: { [key: string]: HTMLAudioElement } = {};
  private autoUnlockAttached: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initAudioElements();
      this.setupAutoUnlock();
    }
  }

  private initAudioElements() {
    if (typeof window === "undefined") return;
    try {
      this.audioElements = {
        nuevo: new Audio("/sounds/nuevo-pedido.wav"),
        cocina: new Audio("/sounds/en-cocina.wav"),
        listo: new Audio("/sounds/listo-servir.wav"),
      };

      // Precargar y configurar volumen
      Object.values(this.audioElements).forEach((audio) => {
        audio.preload = "auto";
        audio.volume = 1.0;
      });
    } catch (e) {
      console.warn("[KitchenAudio] Error inicializando elementos de audio:", e);
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    return this.ctx;
  }

  /**
   * Listener global para desbloquear audio en el primer clic o toque del usuario
   */
  public setupAutoUnlock() {
    if (typeof window === "undefined" || this.autoUnlockAttached) return;
    this.autoUnlockAttached = true;

    const unlockHandler = async () => {
      await this.unlock();
      if (this.isUnlocked) {
        window.removeEventListener("click", unlockHandler);
        window.removeEventListener("touchstart", unlockHandler);
        window.removeEventListener("keydown", unlockHandler);
      }
    };

    window.addEventListener("click", unlockHandler, { once: false, passive: true });
    window.addEventListener("touchstart", unlockHandler, { once: false, passive: true });
    window.addEventListener("keydown", unlockHandler, { once: false, passive: true });
  }

  /**
   * Desbloquea el contexto de audio tras una interacción del usuario
   */
  public async unlock(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // 1. Desbloquear Web Audio API
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }
    } catch (e) {
      console.warn("[KitchenAudio] Resume AudioContext warn:", e);
    }

    // 2. Desbloquear elementos HTML5 Audio
    try {
      if (!this.audioElements.nuevo) {
        this.initAudioElements();
      }

      // Reproducir y pausar instantáneamente para obtener permiso en Safari/Chrome
      const silentAudio = this.audioElements.nuevo;
      if (silentAudio) {
        const origVol = silentAudio.volume;
        silentAudio.volume = 0.01;
        await silentAudio.play();
        silentAudio.pause();
        silentAudio.currentTime = 0;
        silentAudio.volume = origVol;
      }
      this.isUnlocked = true;
      return true;
    } catch (err) {
      // Si falla autoplay estricto, seguimos intentando en próximos clics
      return false;
    }
  }

  public getUnlocked(): boolean {
    return this.isUnlocked;
  }

  // Reproducir archivo de audio o fallback sintético
  private async playSoundFile(key: "nuevo" | "cocina" | "listo", fallbackToneFn: () => void) {
    let played = false;

    try {
      let audio = this.audioElements[key];
      if (!audio) {
        this.initAudioElements();
        audio = this.audioElements[key];
      }

      if (audio) {
        audio.currentTime = 0;
        audio.volume = 1.0;
        await audio.play();
        played = true;
      }
    } catch (err) {
      // Fallback a síntesis con Web Audio API si HTML5 Audio no pudo reproducirse
      played = false;
    }

    // Si falló el archivo o si queremos máxima presencia sonora, ejecutar Web Audio API
    if (!played) {
      fallbackToneFn();
    }
  }

  // Web Audio API sintetizador de osciladores
  private playTone(
    frequencies: number[],
    duration: number = 0.5,
    type: OscillatorType = "sine",
    volume: number = 0.35
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gainNode.connect(ctx.destination);

    frequencies.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + duration);
    });
  }

  /**
   * 1. ALERTA DE NUEVO PEDIDO:
   * Timbre de campana doble ascendente de alta energía (C6 -> G6 -> C7)
   */
  public playNuevoPedido(): void {
    // 1. Archivo WAV de alta fidelidad
    this.playSoundFile("nuevo", () => {
      // Síntesis Web Audio API
      this.playTone([1046.5, 1318.5], 0.35, "sine", 0.4);
      setTimeout(() => this.playTone([1567.98, 2093.0], 0.45, "triangle", 0.5), 200);
      setTimeout(() => this.playTone([2093.0, 2637.0], 0.7, "sine", 0.5), 450);
    });

    // 2. Vibración háptica en móviles/tablets
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([250, 100, 250]);
      }
    } catch {}
  }

  /**
   * 2. ALERTA DE EN COCINA:
   * Tono de confirmación / marcha a cocina (A5 -> E6)
   */
  public playEnCocina(): void {
    this.playSoundFile("cocina", () => {
      this.playTone([880.0, 1108.7], 0.35, "sine", 0.35);
      setTimeout(() => this.playTone([1318.5, 1661.2], 0.55, "sine", 0.4), 160);
    });

    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(150);
      }
    } catch {}
  }

  /**
   * 3. ALERTA DE LISTO PARA SERVIR:
   * Timbre clásico de mostrador de restaurante (🛎️ "Ding!" de campana de servicio)
   */
  public playListoParaServir(): void {
    this.playSoundFile("listo", () => {
      this.playTone([1046.5, 2093.0, 3135.9], 1.2, "sine", 0.5);
      setTimeout(() => this.playTone([2093.0], 0.9, "triangle", 0.35), 100);
    });

    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 80, 200, 80, 400]);
      }
    } catch {}
  }

  /**
   * 4. ALERTA DE LLAMADA DE MESERO / CLIENTE EN MESA:
   * Timbre de campana de mesa triple insistente y vibración háptica
   */
  public playLlamarMesero(): void {
    this.playTone([880, 1320, 1760], 0.35, "sine", 0.45);
    setTimeout(() => this.playTone([987.77, 1479.98, 1975.5], 0.35, "sine", 0.45), 220);
    setTimeout(() => this.playTone([1174.66, 1760.0, 2349.3], 0.55, "triangle", 0.5), 440);

    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
    } catch {}
  }

  /**
   * 5. ALERTA DE CANCELACIÓN DE PLATO O PEDIDO:
   * Timbre de atención descendente de alerta (880Hz -> 659Hz -> 523Hz) y vibración de advertencia
   */
  public playCancelacion(): void {
    this.playTone([880.0, 659.25], 0.28, "sawtooth", 0.35);
    setTimeout(() => this.playTone([587.33, 440.0], 0.45, "triangle", 0.4), 200);

    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([250, 100, 250]);
      }
    } catch {}
  }
}

export const kitchenAudio = new KitchenAudioManager();
