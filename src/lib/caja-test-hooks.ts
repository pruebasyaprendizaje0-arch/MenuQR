/**
 * Módulo de apoyo exclusivo de servidor para hooks de pruebas de concurrencia e intercalado.
 * Totalmente compatible con Next.js (no incluye directiva "use server").
 * 
 * Todos los hooks permanecen inactivos fuera de process.env.NODE_ENV === "test".
 */

export interface TestCajaHooks {
  beforeCloseShiftLock: null | ((shiftId: string, clientPid?: number) => Promise<void>);
  afterCloseShiftLock: null | ((shiftId: string, clientPid?: number) => Promise<void>);
  beforeSettleOrderLock: null | ((orderId: string, shiftIdOrRestId: string, clientPid?: number) => Promise<void>);
  afterSettleOrderLock: null | ((orderId: string, shiftId: string, clientPid?: number) => Promise<void>);
  beforePosSaleLock: null | ((restaurantId: string, clientPid?: number) => Promise<void>);
  afterPosSaleLock: null | ((shiftId: string, clientPid?: number) => Promise<void>);
  beforePosSaleCommit: null | ((orderId: string, shiftId: string) => Promise<void>);
  beforeCashMovementLock: null | ((shiftId: string, clientPid?: number) => Promise<void>);
  afterCashMovementLock: null | ((shiftId: string, clientPid?: number) => Promise<void>);
  beforeConfirmPrepagoLock: null | ((orderId: string, shiftIdOrRestId: string, clientPid?: number) => Promise<void>);
  afterConfirmPrepagoLock: null | ((orderId: string, shiftId: string, clientPid?: number) => Promise<void>);
  reset(): void;
}

export const __testCajaHooks: TestCajaHooks = {
  beforeCloseShiftLock: null,
  afterCloseShiftLock: null,
  beforeSettleOrderLock: null,
  afterSettleOrderLock: null,
  beforePosSaleLock: null,
  afterPosSaleLock: null,
  beforePosSaleCommit: null,
  beforeCashMovementLock: null,
  afterCashMovementLock: null,
  beforeConfirmPrepagoLock: null,
  afterConfirmPrepagoLock: null,
  reset() {
    this.beforeCloseShiftLock = null;
    this.afterCloseShiftLock = null;
    this.beforeSettleOrderLock = null;
    this.afterSettleOrderLock = null;
    this.beforePosSaleLock = null;
    this.afterPosSaleLock = null;
    this.beforePosSaleCommit = null;
    this.beforeCashMovementLock = null;
    this.afterCashMovementLock = null;
    this.beforeConfirmPrepagoLock = null;
    this.afterConfirmPrepagoLock = null;
  },
};

export interface TestDispatchHooks {
  beforeItemInsert: null | ((itemIndex: number, orderItemId?: string) => Promise<void>);
  afterItemInsert: null | ((itemIndex: number, orderItemId?: string, pedidoItemId?: string) => Promise<void>);
  beforeDispatchCommit: null | ((orderId: string) => Promise<void>);
  reset(): void;
}

export const __testDispatchHooks: TestDispatchHooks = {
  beforeItemInsert: null,
  afterItemInsert: null,
  beforeDispatchCommit: null,
  reset() {
    this.beforeItemInsert = null;
    this.afterItemInsert = null;
    this.beforeDispatchCommit = null;
  },
};
