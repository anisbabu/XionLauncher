package net.xion.client.feature;

import com.google.gson.Gson;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.xion.client.XionConfig;
import net.xion.client.compat.Ids;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Xion capes. The set (capes.json + 256x128 PNGs, 8 frames for animated ones) ships with Xion Launcher,
 * which tells us its folder. Capes are shown on your own player and used for your elytra wings; like the
 * custom skin, only you see them. Free capes work for everyone, the rest need Xion+.
 */
public final class Cosmetics {
	public static final class Cape {
		public String id = "";
		public String name = "";
		public String cat = "";
		public String tier = "free";
		public int frames = 1;

		public boolean pro() {
			return "pro".equals(tier);
		}

		public boolean usable() {
			return !pro() || Premium.active();
		}
	}

	/** Texture size and where the outer face sits in it (4x the vanilla 64x32 layout). */
	public static final int TEX_W = 256, TEX_H = 128, FACE_U = 4, FACE_V = 4, FACE_W = 40, FACE_H = 64;
	private static final long FRAME_MS = 110;
	private static final Object MISSING = new Object();

	private static List<Cape> capes;
	private static final Map<String, Object> textures = new HashMap<>();

	private Cosmetics() {}

	public static List<Cape> capes() {
		if (capes == null) {
			capes = new ArrayList<>();
			try {
				Path f = dir().resolve("capes.json");
				if (Files.isRegularFile(f)) capes.addAll(Arrays.asList(new Gson().fromJson(Files.readString(f), Cape[].class)));
			} catch (Exception e) {
				System.out.println("[Xion] Could not read capes: " + e);
			}
		}
		return capes;
	}

	private static Path dir() {
		String d = XionConfig.launcher.capesDir;
		return Path.of(d == null ? "" : d);
	}

	/** Id of the picked cape; a newer pick in the launcher replaces the in-game one. */
	public static String selectedId() {
		if (XionConfig.launcher.capeRev != XionConfig.data.capeRev) {
			XionConfig.data.cape = XionConfig.launcher.cape == null ? "" : XionConfig.launcher.cape;
			XionConfig.data.capeRev = XionConfig.launcher.capeRev;
			XionConfig.save();
		}
		return XionConfig.data.cape == null ? "" : XionConfig.data.cape;
	}

	public static void select(String id) {
		XionConfig.data.cape = id;
		XionConfig.save();
	}

	public static Cape find(String id) {
		for (Cape c : capes()) if (c.id.equals(id)) return c;
		return null;
	}

	/** The cape to wear right now (null when none, or a Xion+ cape without Xion+). */
	public static Cape worn() {
		Cape c = find(selectedId());
		return c != null && c.usable() ? c : null;
	}

	/** Texture of the worn cape for this moment (animated capes cycle their frames), or null. */
	public static Object capeTexture() {
		Cape c = worn();
		return c == null ? null : texture(c);
	}

	public static Object texture(Cape c) {
		String file = c.frames > 1 ? c.id + "_" + (System.currentTimeMillis() / FRAME_MS) % c.frames : c.id;
		Object t = textures.computeIfAbsent(file, Cosmetics::load);
		return t == MISSING ? null : t;
	}

	private static Object load(String file) {
		Path p = dir().resolve(file + ".png");
		if (!Files.isRegularFile(p)) return MISSING;
		try (InputStream in = Files.newInputStream(p)) {
			NativeImage img = NativeImage.read(in);
			//#if MC >= 12105
			DynamicTexture tex = new DynamicTexture(() -> "xion_cape_" + file, img);
			//#else
			DynamicTexture tex = new DynamicTexture(img);
			//#endif
			Object id = Ids.of("xionclient", "dynamic/cape/" + file);
			Minecraft.getInstance().getTextureManager().register(Ids.cast(id), tex);
			return id;
		} catch (Exception e) {
			return MISSING;
		}
	}
}
