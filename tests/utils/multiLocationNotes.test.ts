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
import { describe, expect, it } from 'vitest';
import { getCanonicalNote, isSecondaryNote } from '../../src/utils/multiLocationNotes';
import { createTestTFile } from './createTestTFile';

/**
 * Builds a TFile with a specific creation time so tests can control which note
 * counts as the "first created" canonical note.
 */
function createNote(path: string, ctime: number): TFile {
    const file = createTestTFile(path);
    file.stat = { ctime, mtime: ctime };
    return file;
}

/**
 * Creates a minimal App whose vault returns the provided markdown notes. Only the
 * vault methods used by the multi-location helpers are implemented.
 */
function createApp(notes: TFile[]): App {
    return {
        vault: {
            getMarkdownFiles: () => notes,
            getFileByPath: (path: string) => notes.find(note => note.path === path) ?? null
        }
    } as unknown as App;
}

describe('getCanonicalNote', () => {
    it('returns the same note when no duplicate basename exists', () => {
        const note = createNote('Projects/Roadmap.md', 100);
        const app = createApp([note, createNote('Notes/Other.md', 50)]);

        expect(getCanonicalNote(app, note)).toBe(note);
    });

    it('redirects a secondary note to the earliest created duplicate', () => {
        const original = createNote('Inbox/Idea.md', 100);
        const secondary = createNote('Archive/Idea.md', 200);
        const app = createApp([secondary, original]);

        expect(getCanonicalNote(app, secondary)).toBe(original);
        expect(getCanonicalNote(app, original)).toBe(original);
    });

    it('resolves every duplicate to the single canonical note', () => {
        const original = createNote('A/Note.md', 10);
        const second = createNote('B/Note.md', 20);
        const third = createNote('C/Note.md', 30);
        const app = createApp([third, second, original]);

        for (const note of [original, second, third]) {
            expect(getCanonicalNote(app, note)).toBe(original);
        }
    });

    it('breaks ctime ties deterministically by path', () => {
        const a = createNote('A/Note.md', 100);
        const b = createNote('B/Note.md', 100);
        const app = createApp([b, a]);

        expect(getCanonicalNote(app, a)).toBe(a);
        expect(getCanonicalNote(app, b)).toBe(a);
    });

    it('ignores non-markdown files even when names collide', () => {
        const note = createNote('Folder/Asset.md', 100);
        const image = createTestTFile('Other/Asset.png');
        image.stat = { ctime: 10, mtime: 10 };
        const app = createApp([note]);

        // Non-markdown files are returned unchanged and never act as a canonical target.
        expect(getCanonicalNote(app, image)).toBe(image);
        expect(getCanonicalNote(app, note)).toBe(note);
    });
});

describe('isSecondaryNote', () => {
    it('is true only for the non-canonical duplicates', () => {
        const original = createNote('A/Note.md', 10);
        const secondary = createNote('B/Note.md', 20);
        const app = createApp([secondary, original]);

        expect(isSecondaryNote(app, original)).toBe(false);
        expect(isSecondaryNote(app, secondary)).toBe(true);
    });

    it('is false for a uniquely named note', () => {
        const note = createNote('A/Unique.md', 10);
        const app = createApp([note]);

        expect(isSecondaryNote(app, note)).toBe(false);
    });
});
