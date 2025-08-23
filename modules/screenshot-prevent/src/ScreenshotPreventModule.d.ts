/**
 * Screenshot Prevention Native Module
 * Provides JavaScript interface to control Android FLAG_SECURE
 */
export interface IScreenshotPreventModule {
    enableSecure(): Promise<boolean>;
    disableSecure(): Promise<boolean>;
    isSecureEnabled(): Promise<boolean>;
    setSecureMode(enabled: boolean): Promise<boolean>;
}
declare let ScreenshotPreventModule: IScreenshotPreventModule;
export default ScreenshotPreventModule;
export declare const enableScreenshotPrevention: () => Promise<boolean>;
export declare const disableScreenshotPrevention: () => Promise<boolean>;
export declare const isScreenshotPreventionEnabled: () => Promise<boolean>;
export declare const setScreenshotPrevention: (enabled: boolean) => Promise<boolean>;
//# sourceMappingURL=ScreenshotPreventModule.d.ts.map