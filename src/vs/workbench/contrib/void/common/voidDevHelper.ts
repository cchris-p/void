/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See License.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProviderName } from './voidSettingsTypes.js';

/**
 * Interface for the development configuration file
 */
export interface IVoidDevConfig {
	enabled: boolean;
	globalSettings: Record<string, any>;
	providers: {
		[key in ProviderName]?: {
			apiKey?: string;
			endpoint?: string;
			enabled?: boolean;
		}
	};
	featureModelSelections: Record<string, any>;
}
