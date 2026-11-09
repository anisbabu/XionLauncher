package net.xion.client.feature;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mods switched on or off from the Xion menu. A running game can't load or unload mods, so the
 * choices are written to config/xion-mod-toggles.json and Xion Launcher applies them (renaming
 * jars to/from .jar.disabled) on the next launch, then clears the file.
 */
public final class ModToggles {
	public static final class Data {
		/** mod id -> wanted state (true = enabled). Only mods whose state differs from now. */
		public Map<String, Boolean> mods = new LinkedHashMap<>();
	}

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("xion-mod-toggles.json");
	private static Data data;

	private ModToggles() {}

	private static Data data() {
		if (data != null) return data;
		data = new Data();
		try {
			if (Files.isRegularFile(FILE)) {
				Data d = GSON.fromJson(Files.readString(FILE), Data.class);
				if (d != null && d.mods != null) data = d;
			}
		} catch (Exception ignored) {
		}
		return data;
	}

	/** State the mod will have after the next launch. */
	public static boolean wanted(String id, boolean loadedNow) {
		Boolean b = data().mods.get(id);
		return b == null ? loadedNow : b;
	}

	/** True when the mod's state changes on the next launch. */
	public static boolean pending(String id, boolean loadedNow) {
		return wanted(id, loadedNow) != loadedNow;
	}

	public static int pendingCount() {
		return data().mods.size();
	}

	public static void set(String id, boolean enabled, boolean loadedNow) {
		if (enabled == loadedNow) data().mods.remove(id);
		else data().mods.put(id, enabled);
		save();
	}

	private static void save() {
		try {
			Files.createDirectories(FILE.getParent());
			if (data().mods.isEmpty()) Files.deleteIfExists(FILE);
			else Files.writeString(FILE, GSON.toJson(data()));
		} catch (Exception e) {
			System.out.println("[Xion] Could not save mod toggles: " + e);
		}
	}
}
