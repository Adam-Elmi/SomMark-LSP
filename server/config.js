import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const CONFIG_FILE_NAME = "smark.config.js";

async function loadConfigFileFresh(configPath) {
    if (!configPath) return null;
    try {
        const content = await fs.readFile(configPath, "utf-8");
        // Using a data URL ensures Bun/Node doesn't cache the module
        const base64 = Buffer.from(content).toString("base64");
        const dataURL = `data:text/javascript;base64,${base64}`;
        const loadedModule = await import(dataURL);
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

	// 2. Check the Target Directory (Highest Priority)
	if (!configPath) {
		const targetConfig = path.join(startDir, CONFIG_FILE_NAME);
		try {
			await fs.access(targetConfig);
			configPath = targetConfig;
		} catch {
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
