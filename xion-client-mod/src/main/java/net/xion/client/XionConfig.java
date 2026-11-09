package net.xion.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Persists Xion settings to config/xion-client.json and reads launcher hand-off data. */
public final class XionConfig {
	public static class ModuleState {
		public boolean enabled;
		/** Position as a fraction of the scaled screen size, so layouts survive resizes. */
		public float x;
		public float y;

		/** Per-module style, edited from the module's settings in the Xion menu. */
		public float scale = 1f;
		public int color = 0xFFE8ECF2;
		public boolean chroma = false;
		public boolean background = true;

		/** Used by Gson, so fields added in newer versions keep their defaults for old configs. */
		public ModuleState() {}

		public ModuleState(boolean enabled, float x, float y) {
			this.enabled = enabled;
			this.x = x;
			this.y = y;
		}
	}

	public static class Data {
		public boolean customMenu = true;
		public boolean hudBackground = true;
		public boolean badge = true;
		public boolean autoSprint = false;
		public boolean fullbright = false;
		public boolean customSkin = true;
		/** Premium crosshair: style 0 = vanilla, 1 dot, 2 plus, 3 gap plus, 4 circle, 5 x. */
		public int crosshairStyle = 0;
		public int crosshairColor = 0xFFFFFFFF;
		public float crosshairSize = 1f;
		public boolean crosshairOutline = true;
		/** Performance preset last applied to the game options ("" = never). */
		public String perfApplied = "";
		/** Cape picked in the Cosmetics tab ("" = none) and the launcher pick it last took over. */
		public String cape = "";
		public int capeRev = 0;
		/** PvP mode: set once the PvP HUD layout has been applied to this game folder. */
		public boolean pvpSetup = false;
		public Map<String, ModuleState> modules = new LinkedHashMap<>();
	}

	/** Written by Xion Launcher before each launch (config/xion-launcher.json). */
	public static class Launcher {
		public String skin;
		public boolean slim;
		public String account = "offline";
		public String launcherVersion = "";
		public Theme theme = new Theme();
		public String licenseKey = "";
		/** off, boost (free) or turbo (Xion+). */
		public String perfMode = "boost";
		/** Folder with the cape set (capes.json + PNGs), and the cape picked in the launcher. */
		public String capesDir = "";
		public String cape = "";
		/** Bumped by the launcher on every pick, so its choice wins over an older in-game one. */
		public int capeRev = 0;
		/** Xion PvP mode: its own HUD, menu look and mod pack. */
		public boolean pvp = false;
	}

	public static class Theme {
		public String id = "nightfall";
		public String accent = "#c9d6ff";
		public String accent2 = "#8fb3ff";
	}

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path DIR = FabricLoader.getInstance().getConfigDir();
	private static final Path FILE = DIR.resolve("xion-client.json");
	public static Data data = new Data();
	public static Launcher launcher = new Launcher();

	private XionConfig() {}

	public static void load() {
		try {
			if (Files.exists(FILE)) {
				Data d = GSON.fromJson(Files.readString(FILE), Data.class);
				if (d != null) data = d;
			}
		} catch (Exception e) {
			data = new Data();
		}
		if (data.modules == null) data.modules = new LinkedHashMap<>();
		try {
			Path lf = DIR.resolve("xion-launcher.json");
			if (Files.exists(lf)) {
				Launcher l = GSON.fromJson(Files.readString(lf), Launcher.class);
				if (l != null) launcher = l;
			}
		} catch (Exception ignored) {
		}
	}

	public static void save() {
		try {
			Files.createDirectories(DIR);
			Files.writeString(FILE, GSON.toJson(data));
		} catch (Exception ignored) {
		}
	}

	public static ModuleState module(String id, boolean on, float x, float y) {
		return data.modules.computeIfAbsent(id, k -> new ModuleState(on, x, y));
	}
}
