package net.xion.client.compat;

import com.mojang.blaze3d.platform.NativeImage;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
//#if MC >= 260300
import com.mojang.renderpearl.api.textures.FilterMode;
//#elif MC >= 12111
import com.mojang.blaze3d.textures.FilterMode;
//#endif
//#if MC >= 12111
import com.mojang.blaze3d.systems.RenderSystem;
//#endif

/**
 * Backdrop layers of the theme chosen in Xion Launcher. The launcher copies them to
 * config/xion-theme/*.png; they are loaded once on the render thread and registered as smooth
 * (linear-filtered) textures. Missing files fall back to the bundled Nightfall art.
 */
public final class ThemeTextures {
	private static final Map<String, Object> CACHE = new HashMap<>();
	private static final Path DIR = FabricLoader.getInstance().getConfigDir().resolve("xion-theme");

	private ThemeTextures() {}

	/** Texture id for a layer (sky, far, mid, near, front, fog), or the bundled fallback. */
	public static Object layer(String name, Object fallback) {
		Object id = CACHE.get(name);
		if (id != null) return id;
		id = fallback;
		Path file = DIR.resolve(name + ".png");
		if (Files.isRegularFile(file)) {
			try (InputStream in = Files.newInputStream(file)) {
				NativeImage img = NativeImage.read(in);
				Object key = Ids.of("xionclient", "theme/" + name);
				Minecraft.getInstance().getTextureManager().register(Ids.cast(key), create(img, name));
				id = key;
			} catch (Exception | LinkageError e) {
				System.out.println("[Xion] Theme layer " + name + " not loaded: " + e);
			}
		}
		CACHE.put(name, id);
		return id;
	}

	private static DynamicTexture create(NativeImage img, String name) {
		//#if MC >= 12111
		return new DynamicTexture(() -> "xion-theme-" + name, img) {
			{
				this.sampler = RenderSystem.getSamplerCache().getClampToEdge(FilterMode.LINEAR);
			}
		};
		//#elif MC >= 12105
		DynamicTexture t = new DynamicTexture(() -> "xion-theme-" + name, img);
		t.setFilter(true, false);
		return t;
		//#else
		DynamicTexture t = new DynamicTexture(img);
		t.setFilter(true, false);
		return t;
		//#endif
	}

	/** Theme id written by the launcher, or nightfall. */
	public static String id() {
		try {
			Path f = DIR.resolve("theme.txt");
			if (Files.isRegularFile(f)) return Files.readString(f).trim();
		} catch (Exception ignored) {
		}
		return "nightfall";
	}
}
