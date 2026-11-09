package net.xion.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Persists HUD module state to config/xion-client.json. */
public final class XionConfig {
	public static class ModuleState {
		public boolean enabled;
		/** Position as a fraction of the scaled screen size, so layouts survive resizes. */
		public float x;
		public float y;

		public ModuleState(boolean enabled, float x, float y) {
			this.enabled = enabled;
			this.x = x;
			this.y = y;
		}
	}

	public static class Data {
		public boolean customMenu = true;
		public boolean hudBackground = true;
		public Map<String, ModuleState> modules = new LinkedHashMap<>();
	}

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("xion-client.json");
	public static Data data = new Data();

	private XionConfig() {}

	public static void load() {
		try {
			if (Files.exists(FILE)) {
				Data d = GSON.fromJson(Files.readString(FILE), Data.class);
				if (d != null) data = d;
			}
		} catch (Exception ignored) {
			data = new Data();
		}
		if (data.modules == null) data.modules = new LinkedHashMap<>();
	}

	public static void save() {
		try {
			Files.createDirectories(FILE.getParent());
			Files.writeString(FILE, GSON.toJson(data));
		} catch (IOException ignored) {
		}
	}

	public static ModuleState module(String id, boolean defEnabled, float defX, float defY) {
		return data.modules.computeIfAbsent(id, k -> new ModuleState(defEnabled, defX, defY));
	}
}
