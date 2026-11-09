package net.xion.client.feature;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.xion.client.XionConfig;
import net.xion.client.compat.Ids;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Applies the skin chosen in Xion Launcher to your own player. For offline accounts this is the only
 * way to have a skin; it's visible to you (other players see what their server/Mojang provides).
 */
public final class SkinOverride {
	private static boolean loaded;
	private static boolean available;

	private SkinOverride() {}

	public static boolean active() {
		if (!XionConfig.data.customSkin) return false;
		if (!loaded) load();
		return available;
	}

	public static boolean slim() {
		return XionConfig.launcher.slim;
	}

	private static void load() {
		loaded = true;
		String file = XionConfig.launcher.skin;
		if (file == null || file.isEmpty()) return;
		Path p = Path.of(file);
		if (!Files.isRegularFile(p)) return;
		try (InputStream in = Files.newInputStream(p)) {
			NativeImage img = NativeImage.read(in);
			if (img.getWidth() != 64 || (img.getHeight() != 64 && img.getHeight() != 32)) {
				img.close();
				return;
			}
			//#if MC >= 12105
			DynamicTexture tex = new DynamicTexture(() -> "xion_custom_skin", img);
			//#else
			DynamicTexture tex = new DynamicTexture(img);
			//#endif
			Minecraft.getInstance().getTextureManager().register(Ids.cast(Ids.SKIN_OVERRIDE), tex);
			available = true;
		} catch (Exception e) {
			available = false;
		}
	}
}
