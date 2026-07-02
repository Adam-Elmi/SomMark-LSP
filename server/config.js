import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * Parses a per-file LSP directive from the first line of a .smark file.
 * Syntax: # @lsp format: html mapper: ./path/to/mapper.js
 * Both keys are optional and can appear in any order.
 *
 * @param {string} text - Full file content
 * @param {string} fileDir - Directory of the file, used to resolve relative mapper paths
 * @returns {{ format?: string, mapperFile?: string }}
 */
export function parseFileDirective(text, fileDir) {
    const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n")).trim();
    if (!firstLine.startsWith("#") || !firstLine.includes("@lsp")) return {};

    const directive = firstLine.slice(firstLine.indexOf("@lsp") + 4).trim();
    const result = {};

    const formatMatch = directive.match(/\bformat:\s*([^,\s]+)/);
    if (formatMatch) result.format = formatMatch[1];

    const mapperMatch = directive.match(/\bmapper:\s*([^,\s]+)/);
    if (mapperMatch) {
        const raw = mapperMatch[1];
        result.mapperFile = path.isAbsolute(raw) ? raw : path.resolve(fileDir, raw);
    }

    return result;
}

const CONFIG_FILE_NAME = "smark.config.js";

async function loadConfigFileFresh(configPath) {
    if (!configPath) return null;
    try {
        // Append timestamp to bypass ESM module cache, while preserving file:// context for relative imports
        const configURL = `${pathToFileURL(configPath).href}?t=${Date.now()}`;
        const loadedModule = await import(configURL);
        return loadedModule.default || loadedModule;
    } catch (error) {
        return null;
    }
}

export async function findAndLoadConfigFresh(targetPath) {
    const cwd = process.cwd();
	let configPath = null;
	let startDir = cwd;

	// 1. Resolve Target Directory
	if (targetPath) {
		try {
			const absoluteTarget = path.resolve(cwd, targetPath);
			const stats = await fs.stat(absoluteTarget);
			
			if (stats.isFile() && absoluteTarget.endsWith(".js") && !absoluteTarget.endsWith(CONFIG_FILE_NAME)) {
				configPath = absoluteTarget;
			} else {
				startDir = stats.isDirectory() ? absoluteTarget : path.dirname(absoluteTarget);
			}
		} catch {
			// Path doesn't exist
		}
	}

	// 2. Check the Target Directory and its parents
	if (!configPath && startDir) {
		let currentDir = startDir;
		while (currentDir) {
			const targetConfig = path.join(currentDir, CONFIG_FILE_NAME);
			try {
				await fs.access(targetConfig);
				configPath = targetConfig;
				break; // Found it!
			} catch {
				// Go up one level
				const parentDir = path.dirname(currentDir);
				if (parentDir === currentDir) break; // Reached root
				currentDir = parentDir;
			}
		}
	}

	// 3. Check the Current Working Directory (Fallback)
	if (!configPath && startDir !== cwd) {
		const cwdConfig = path.join(cwd, CONFIG_FILE_NAME);
		try {
			await fs.access(cwdConfig);
			configPath = cwdConfig;
		} catch {
		}
	}
	
	const defaultConfig = {
		outputFile: "output",
		outputDir: startDir,
		mapperFile: null,
		removeComments: true,
		placeholders: {},
		customProps: [],
	};

	if (configPath) {
		const loadedConfig = await loadConfigFileFresh(configPath);
		if (loadedConfig) {
			const finalMapper = loadedConfig.mapperFile || loadedConfig.mappingFile || defaultConfig.mapperFile;
			
			const finalConfig = { 
				...defaultConfig, 
				...loadedConfig, 
				mapperFile: finalMapper,
				resolvedConfigPath: configPath 
			};
			if (loadedConfig.outputDir) {
				const configDir = path.dirname(configPath);
				finalConfig.outputDir = path.resolve(configDir, loadedConfig.outputDir);
			}
			return finalConfig;
		}
	}

	return { ...defaultConfig, resolvedConfigPath: null };
}
