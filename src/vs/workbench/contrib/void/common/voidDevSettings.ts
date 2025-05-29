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
 * Provider configuration in the development config file
 * Note: API keys should be stored in .env file, not here
 */
export interface IProviderDevConfig {
	// API key field is intentionally omitted - should come from .env
	apiKey?: string;
	endpoint?: string;
	enabled?: boolean;
}

/**
 * Interface for the development configuration file
 */
export interface IVoidDevConfig {
	enabled: boolean;
	globalSettings: Partial<GlobalSettings>;
	providers: {
		[key in ProviderName]?: IProviderDevConfig;
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
 * Loads environment variables from .env file
 * @param fileService File service to read the .env file
 * @param environmentService Environment service to get the root path
 * @param logService Log service for logging errors
 */
async function loadEnvironmentVariables(
	fileService: IFileService,
	environmentService: INativeEnvironmentService,
	logService: ILogService
): Promise<void> {
	try {
		const appRoot = URI.file(
			typeof environmentService.appRoot === 'string'
				? environmentService.appRoot
				: join(environmentService.userDataPath, '../..')
		);
		const envPath = URI.joinPath(appRoot, '.env').fsPath;

		// Check if .env file exists
		const exists = await fileService.exists(URI.file(envPath));
		if (exists) {
			// Read and parse .env file
			const envContent = await fileService.readFile(URI.file(envPath));
			const loaded: Record<string, string> = {};

			envContent.value.toString().split('\n').forEach(line => {
				// Skip comments and empty lines
				if (!line || line.startsWith('#')) return;

				const [key, ...valueParts] = line.split('=');
				if (key && valueParts.length) {
					const value = valueParts.join('=').trim();
					const trimmedKey = key.trim();
					loaded[trimmedKey] = value;

					// Only set the environment variable if it's not already set
					if (!process.env[trimmedKey]) {
						process.env[trimmedKey] = value;
					}
				}
			});

			logService.info('Loaded environment variables from .env file');

			// Log loaded API keys (not their values, just which ones were loaded)
			const apiKeys = Object.keys(loaded).filter(key => key.includes('API_KEY'));
			if (apiKeys.length > 0) {
				logService.info(`Loaded API keys from .env file: ${apiKeys.join(', ')}`);
			}
		} else {
			logService.debug('.env file not found at', envPath);
		}
	} catch (error) {
		logService.error('Failed to load environment variables from .env file:', error);
	}
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
	// First load environment variables from .env file
	await loadEnvironmentVariables(fileService, environmentService, logService);

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

		// Apply API keys from environment variables to the config
		applyEnvironmentVariablesToConfig(config, logService);

		logService.info('Loaded development configuration from', devConfigPath.fsPath);
		return config;
	} catch (error) {
		logService.error('Failed to load development configuration:', error);
		return undefined;
	}
}

/**
 * Applies environment variables to the configuration
 * @param config The configuration to update with environment variables
 * @param logService Log service for logging
 */
function applyEnvironmentVariablesToConfig(config: IVoidDevConfig, logService: ILogService): void {
	// Define mappings for provider-specific environment variables
	const providerEnvVarMap: Record<string, Record<string, string>> = {
		anthropic: {
			apiKey: 'ANTHROPIC_API_KEY'
		},
		openAI: {
			apiKey: 'OPENAI_API_KEY'
		},
		gemini: {
			apiKey: 'GEMINI_API_KEY'
		},
		googleVertex: {
			apiKey: 'GOOGLE_VERTEX_API_KEY'
		},
		microsoftAzure: {
			apiKey: 'AZURE_API_KEY',
			endpoint: 'AZURE_ENDPOINT'
		},
		openRouter: {
			apiKey: 'OPENROUTER_API_KEY'
		},
		liteLLM: {
			apiKey: 'LITELLM_API_KEY',
			endpoint: 'LITELLM_ENDPOINT'
		},
		openAICompatible: {
			apiKey: 'OPENAI_COMPATIBLE_API_KEY',
			endpoint: 'OPENAI_COMPATIBLE_ENDPOINT'
		}
	};

	// Apply environment variables to each provider's settings
	for (const [providerName, envVarMap] of Object.entries(providerEnvVarMap)) {
		// If provider doesn't exist in config, create it
		if (!config.providers[providerName as ProviderName]) {
			config.providers[providerName as ProviderName] = {};
		}

		const provider = config.providers[providerName as ProviderName];

		for (const [configKey, envVarName] of Object.entries(envVarMap)) {
			// For API keys, we always set them from env vars if available
			if (process.env[envVarName]) {
				// Add the property if it doesn't exist
				(provider as any)[configKey] = process.env[envVarName];
				logService.info(`Using ${providerName} ${configKey} from environment variable ${envVarName}`);
			}
		}
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

			// API Key from devConfig (which should have been populated from .env by applyEnvironmentVariablesToConfig)
			if (providerConfig.apiKey !== undefined) {
				// Runtime check to ensure the property exists on the specific provider type we're dealing with.
				// defaultProviderSettings defines which providers have apiKey.
				if ('apiKey' in currentProviderSettings) {
					currentProviderSettings.apiKey = providerConfig.apiKey;
				}
			}

			// Endpoint from devConfig
			if (providerConfig.endpoint !== undefined) {
				// Runtime check, similar to apiKey.
				if ('endpoint' in currentProviderSettings) {
					currentProviderSettings.endpoint = providerConfig.endpoint;
				}
			}

			// Enabled status from devConfig, map to _didFillInProviderSettings
			// This property exists on CommonProviderSettings, so it's on all SettingsAtProvider types.
			if (providerConfig.enabled !== undefined) {
				currentProviderSettings._didFillInProviderSettings = providerConfig.enabled;
			}
		}
	}

	// The _modelOptions property is readonly and derived. If it needs to be re-calculated
	// based on the new globalSettings or modelSelectionOfFeature, that logic would need to be
	// invoked here, and _modelOptions would also need to be part of the initial newState construction.
	// For now, assuming it's either correctly handled by the deep clone or re-calculated elsewhere.

	return newState;
}
