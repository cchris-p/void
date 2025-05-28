/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * This module bridges development mode settings between main and renderer processes
 */

import { BrowserWindow } from 'electron';

/**
 * Expose development status to the renderer process
 * @param win The browser window
 */
export function setupDevModeBridge(win: BrowserWindow): void {
    // Add development status to the preload script
    win.webContents.executeJavaScript(`
        window.__DEVELOPMENT__ = ${process.env['VSCODE_DEV'] === '1'};
    `).catch(err => {
        console.error('Failed to set development flag:', err);
    });
}
