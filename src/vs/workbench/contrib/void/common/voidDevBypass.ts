/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IEncryptionService } from '../../../../platform/encryption/common/encryptionService.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { VOID_SETTINGS_STORAGE_KEY } from './storageKeys.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export interface IVoidDevBypassService {
    readonly _serviceBrand: undefined;
    bypassOnboarding(): Promise<void>;
}

export const IVoidDevBypassService = createDecorator<IVoidDevBypassService>('VoidDevBypassService');

class VoidDevBypassService extends Disposable implements IVoidDevBypassService {
    _serviceBrand: undefined;

    constructor(
        @IStorageService private readonly _storageService: IStorageService,
        @IEncryptionService private readonly _encryptionService: IEncryptionService,
        @ILogService private readonly _logService: ILogService
    ) {
        super();
        
        this._logService.info('VoidDevBypassService: Initializing...');
        
        // Check for development mode in multiple ways
        const isDev = process.env['VSCODE_DEV'] === '1';
        const devArg = process.argv.includes('--dev');
        
        this._logService.info(`VoidDevBypassService: Dev environment check - VSCODE_DEV=${process.env['VSCODE_DEV']}, --dev argument=${devArg}`);
        
        if (isDev || devArg) {
            this._logService.info('VoidDevBypassService: Development mode detected, bypassing onboarding...');
            // Execute immediately
            this.bypassOnboarding();
            
            // Also set up a timer to ensure settings are applied after a delay
            // This helps in case the settings are overwritten during initialization
            setTimeout(() => {
                this._logService.info('VoidDevBypassService: Running delayed bypass check...');
                this.bypassOnboarding();
            }, 3000);
        }
    }

    async bypassOnboarding(): Promise<void> {
        try {
            this._logService.info('VoidDevBypassService: Attempting to bypass onboarding');
            
            // Get current settings
            const encryptedState = this._storageService.get(VOID_SETTINGS_STORAGE_KEY, StorageScope.APPLICATION);
            
            if (!encryptedState) {
                this._logService.info('VoidDevBypassService: No existing settings found');
                // No settings yet, we'll create a new one with onboarding completed
                const defaultSettings = {
                    globalSettings: {
                        isOnboardingComplete: true
                    }
                };
                
                const encryptedNewState = await this._encryptionService.encrypt(JSON.stringify(defaultSettings));
                this._storageService.store(VOID_SETTINGS_STORAGE_KEY, encryptedNewState, StorageScope.APPLICATION, StorageTarget.USER);
                this._logService.info('VoidDevBypassService: Created new settings with onboarding bypassed');
                return;
            }
            
            // Decrypt existing settings
            const stateStr = await this._encryptionService.decrypt(encryptedState);
            const state = JSON.parse(stateStr);
            
            // Set onboarding complete
            if (state.globalSettings) {
                state.globalSettings.isOnboardingComplete = true;
            } else if (state.settings && state.settings.globalSettings) {
                state.settings.globalSettings.isOnboardingComplete = true;
            } else {
                state.globalSettings = { isOnboardingComplete: true };
            }
            
            // Encrypt and store
            const newEncryptedState = await this._encryptionService.encrypt(JSON.stringify(state));
            this._storageService.store(VOID_SETTINGS_STORAGE_KEY, newEncryptedState, StorageScope.APPLICATION, StorageTarget.USER);
            
            this._logService.info('VoidDevBypassService: Successfully bypassed onboarding');
        } catch (error) {
            this._logService.error('VoidDevBypassService: Error bypassing onboarding', error);
        }
    }
}

registerSingleton(IVoidDevBypassService, VoidDevBypassService, InstantiationType.Eager);
