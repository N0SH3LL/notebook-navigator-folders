/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { App, TFile } from 'obsidian';

/**
 * Multi-location notes feature.
 *
 * Obsidian normally treats two notes that share a basename but live in different
 * folders as separate files, distinguished by their path. This fork lets a single
 * logical note appear in multiple places in the Notebook Navigator pane: you create
 * additional notes with the same name in the folders where you want the note to
 * appear, and every duplicate opens the original ("first created") note instead.
 *
 * The duplicates are only special inside the navigator pane. On disk and in
 * Obsidian's own file explorer they remain ordinary, independent files.
 *
 * Only markdown notes participate in this redirection.
 */

/**
 * Returns true when two files share the same basename and only differ by path.
 */
function sharesBasename(a: TFile, b: TFile): boolean {
    return a.basename === b.basename;
}

/**
 * Determines whether `candidate` is "more canonical" than `current`.
 *
 * The canonical note is the earliest created one (lowest ctime). Creation
 * timestamps can collide, so ties are broken by path to keep the choice stable
 * and deterministic regardless of vault iteration order.
 */
function isMoreCanonical(candidate: TFile, current: TFile): boolean {
    const candidateCtime = candidate.stat.ctime;
    const currentCtime = current.stat.ctime;

    if (candidateCtime !== currentCtime) {
        return candidateCtime < currentCtime;
    }

    return candidate.path < current.path;
}

/**
 * Resolves the canonical note for a given file.
 *
 * If the file is a markdown note that shares its basename with one or more other
 * markdown notes, the earliest created note among them is returned. Otherwise the
 * file itself is returned unchanged. This is what makes a secondary (duplicate)
 * note open the original when clicked in the navigator.
 *
 * @param app - Obsidian app instance
 * @param file - The file the user interacted with
 * @returns The note that should actually be opened
 */
export function getCanonicalNote(app: App, file: TFile): TFile {
    // Only markdown notes participate in duplicate-name redirection.
    if (file.extension !== 'md') {
        return file;
    }

    let canonical = file;

    for (const candidate of app.vault.getMarkdownFiles()) {
        if (candidate === canonical || !sharesBasename(candidate, file)) {
            continue;
        }

        if (isMoreCanonical(candidate, canonical)) {
            canonical = candidate;
        }
    }

    return canonical;
}

/**
 * Returns true when `file` is a secondary (duplicate) note: a markdown note that
 * shares its basename with an earlier created note. Secondary notes redirect to
 * the canonical note when opened.
 *
 * @param app - Obsidian app instance
 * @param file - The file to test
 */
export function isSecondaryNote(app: App, file: TFile): boolean {
    if (file.extension !== 'md') {
        return false;
    }

    return getCanonicalNote(app, file).path !== file.path;
}
