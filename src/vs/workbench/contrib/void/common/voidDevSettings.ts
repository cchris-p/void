/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See License.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { VoidSettingsState } from './voidSettingsService.js';
import { GlobalSettings, ProviderName, ModelSelectionOfFeature } from './voidSettingsTypes.js';
import { join } from '../../../../base/common/path.js';

/**
 * Interface for the development configuration file
 */
export interface IVoidDevConfig {
	enabled: boolean;
	globalSettings: Partial<GlobalSettings>;
	providers: {
		[key in ProviderName]?: {
			apiKey?: string;
			endpoint?: string;
			enabled?: boolean;
		}
	};
	featureModelSelections: Partial<ModelSelectionOfFeature>;
}

/**
 * Checks if running in development mode
 */
export function isDevMode(): boolean {
	return process.env['VSCODE_DEV'] === '1';
}

/**
 * Loads the development configuration from the root directory
 * @param fileService File service to read the config file
 * @param environmentService Environment service to get the root path
 * @param logService Log service for logging errors
 * @returns A promise that resolves to the development configuration or undefined if not found
 */
export async function loadDevConfig(
	fileService: IFileService,
	environmentService: INativeEnvironmentService,
	logService: ILogService
): Promise<IVoidDevConfig | undefined> {
	try {
		// Get the application root directory
		const appRoot = URI.file(
			typeof environmentService.appRoot === 'string'
				? environmentService.appRoot
				: join(environmentService.userDataPath, '../..')
		);

		// Path to the dev config file
		const devConfigPath = URI.joinPath(appRoot, 'void-dev-config.json');

		// Check if the file exists
		const exists = await fileService.exists(devConfigPath);
		if (!exists) {
			logService.debug('Development configuration file not found at', devConfigPath.fsPath);
			return undefined;
		}

		// Read the file
		const content = await fileService.readFile(devConfigPath);
		const config = JSON.parse(content.value.toString()) as IVoidDevConfig;

		if (!config.enabled) {
			logService.debug('Development configuration is disabled');
			return undefined;
		}

		logService.info('Loaded development configuration from', devConfigPath.fsPath);
		return config;
	} catch (error) {
		logService.error('Failed to load development configuration:', error);
		return undefined;
	}
}

/**
 * Applies the development configuration to the settings state
 * @param state Current settings state
 * @param devConfig Development configuration
 * @returns Updated settings state
 */
export function applyDevConfig(state: VoidSettingsState, devConfig: IVoidDevConfig): VoidSettingsState {
	// Create a new state object incorporating changes from devConfig
	const newState: VoidSettingsState = {
		// Spread existing state for properties not being directly modified or that are deeply cloned
		...JSON.parse(JSON.stringify(state)), // For deep clone of other potentially nested properties

		// Apply global settings
		globalSettings: devConfig.globalSettings
			? {
				...state.globalSettings, // Start with original globalSettings from the input state
				...devConfig.globalSettings // Override with devConfig globalSettings
			}
			: state.globalSettings, // If no devConfig.globalSettings, use original

		// Apply feature model selections
		modelSelectionOfFeature: devConfig.featureModelSelections
			? {
				...state.modelSelectionOfFeature, // Start with original modelSelectionOfFeature
				...devConfig.featureModelSelections // Override with devConfig featureModelSelections
			}
			: state.modelSelectionOfFeature, // If no devConfig.featureModelSelections, use original
	};

	// Apply provider settings (this part mutates properties of objects within newState.settingsOfProvider)
	if (devConfig.providers) {
		for (const [providerName, providerConfig] of Object.entries(devConfig.providers)) {
			if (!providerConfig || !newState.settingsOfProvider[providerName as ProviderName]) {
				continue;
			}

			const typedProviderName = providerName as ProviderName;
			// Get the provider settings from the *newState* object
			const currentProviderSettings = newState.settingsOfProvider[typedProviderName];

			// Apply API key if provided
			if (providerConfig.apiKey !== undefined) {
				if ('apiKey' in currentProviderSettings) {
					(currentProviderSettings as any).apiKey = providerConfig.apiKey;
				}
			}

			// Apply endpoint if provided
			if (providerConfig.endpoint !== undefined) {
				if ('endpoint' in currentProviderSettings) {
					(currentProviderSettings as any).endpoint = providerConfig.endpoint;
				}
			}

			// Apply enabled status if provided
			if (providerConfig.enabled !== undefined) {
				// Assuming isEnabled is not readonly within the ProviderSetting object itself
				if ('isEnabled' in currentProviderSettings) {
					(currentProviderSettings as { isEnabled?: boolean }).isEnabled = providerConfig.enabled;
				}
			}
		}
	}

	// The _modelOptions property is readonly and derived. If it needs to be re-calculated
	// based on the new globalSettings or modelSelectionOfFeature, that logic would need to be
	// invoked here, and _modelOptions would also need to be part of the initial newState construction.
	// For now, assuming it's either correctly handled by the deep clone or re-calculated elsewhere.

	return newState;
}
