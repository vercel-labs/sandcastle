/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "xpra-html5-client" {
  export class XpraKeyboard {
    constructor();
    getKey(event: KeyboardEvent): { name: string; key: string; code: string; group: number };
    getModifiers(event: KeyboardEvent): string[];
  }

  export class XpraDecodeNullWorker {
    constructor();
  }

  export interface XpraWindow {
    id: number;
    wid: number;
    position: [number, number];
    dimension: [number, number];
    x: number;
    y: number;
    w: number;
    h: number;
    metadata: Record<string, unknown>;
    overrideRedirect?: boolean;
    "override-redirect"?: boolean;
    "client-properties"?: Record<string, unknown>;
  }

  export interface XpraWindowMoveResize {
    wid: number;
    x: number;
    y: number;
    w: number;
    h: number;
    position?: [number, number];
    dimension?: [number, number];
  }

  export interface XpraWindowMetadataUpdate {
    wid: number;
    metadata: Record<string, unknown>;
  }

  export interface XpraWindowIcon {
    wid: number;
    width: number;
    height: number;
    encoding: string;
    data: string;
  }

  export interface XpraDraw {
    wid: number;
    x: number;
    y: number;
    w: number;
    h: number;
    position: [number, number];
    dimension: [number, number];
    packetSequence: number;
    encoding: string;
    data: Uint8Array;
    image?: ImageBitmap | HTMLImageElement | null;
  }

  export interface XpraNotification {
    id: number;
    replacesId: number;
    summary: string;
    body: string;
    expires: number;
    icon: string | null;
    actions: string[];
    hints: string[];
  }

  export interface XpraCursor {
    width: number;
    height: number;
    xhot: number;
    yhot: number;
    data: string;
  }

  export interface XpraSendFile {
    filename: string;
    mimetype: string;
    size: number;
    data: Uint8Array;
    print?: boolean;
  }

  export interface XpraConnectionStats {
    pingLatency: number;
    serverLatency: number;
  }

  export interface XpraClientOptions {
    decoder?: XpraDecodeNullWorker;
  }

  export class XpraClipboard {
    on(event: 'token', callback: (data: string) => void): void;
    on(event: 'send', callback: (
      requestId: number,
      selection: string,
      buffer: string,
      dataType?: string,
      dataFormat?: number,
      encoding?: string
    ) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
    poll(): Promise<void>;
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
  }

  export class XpraClient {
    readonly clipboard: XpraClipboard;
    constructor(options?: XpraClientOptions);
    init(): Promise<void>;
    connect(url: string, options?: Record<string, unknown>): void;
    disconnect(): void;
    sendKeyAction(wid: number, keyname: string, pressed: boolean, modifiers: string[], key: string, code: string, group: number): void;
    sendPointerPosition(wid: number, x: number, y: number, modifiers: string[]): void;
    sendPointerButton(wid: number, button: number, pressed: boolean, x: number, y: number, modifiers: string[]): void;
    sendScroll(wid: number, x: number, y: number, deltaX: number, deltaY: number, modifiers: string[]): void;
    sendBufferRefresh(wid: number): void;
    sendMouseMove(wid: number, position: [number, number], modifiers: string[]): void;
    sendMouseButton(wid: number, position: [number, number], button: number, pressed: boolean, modifiers: string[]): void;
    sendMouseWheel(wid: number, button: number, distance: number, position: [number, number], modifiers: string[]): void;
    sendMapWindow(window: XpraWindow): void;
    sendDamageSequence(packetSequence: number, wid: number, dimension: [number, number], status: number): void;
    sendWindowRaise(wid: number, windows: XpraWindow[]): void;
    sendGeometryWindow(wid: number, position: [number, number], dimension: [number, number]): void;
    sendWindowClose(wid: number): void;
    sendNotificationClose(nid: number): void;
    sendFile(name: string, mime: string, size: number, buffer: Uint8Array): void;
    focusWindow(wid: number): void;
    moveWindow(wid: number, x: number, y: number): void;
    resizeWindow(wid: number, w: number, h: number): void;
    moveResizeWindow(wid: number, x: number, y: number, w: number, h: number): void;
    closeWindow(wid: number): void;
    minimizeWindow(wid: number): void;
    maximizeWindow(wid: number): void;
    unmaximizeWindow(wid: number): void;
    sendStartCommand(name: string, command: string, ignorable: boolean): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, callback: (...args: any[]) => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    off(event: string, callback: (...args: any[]) => void): void;
  }
}
