package net.xion.client.feature;

//#if MC < 12002
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.server.packs.resources.ResourceManager;
import net.xion.client.compat.Ids;

import java.io.InputStream;
//#endif

/**
 * Minecraft 1.18–1.20.1 draw every button from one atlas (widgets.png) that also holds the hotbar.
 * Instead of shipping a modified copy, this repaints only the three button rows of the player's own
 * atlas in the Xion style and registers the result. Newer versions use the sprites in the resource pack.
 */
public final class WidgetSkin {
	private WidgetSkin() {}

	//#if MC < 12002
	/** The repainted atlas; TextureManagerMixin serves it whenever widgets.png is requested. */
	public static DynamicTexture texture;
	private static final Object WIDGETS = Ids.of("minecraft", "textures/gui/widgets.png");

	public static boolean isWidgets(Object location) {
		return WIDGETS.equals(location);
	}
	//#endif

	public static void apply() {
		//#if MC < 12002
		try {
			Minecraft mc = Minecraft.getInstance();
			var id = Ids.of("minecraft", "textures/gui/widgets.png");
			ResourceManager rm = mc.getResourceManager();
			//#if MC >= 11900
			InputStream in = rm.getResource(id).orElseThrow().open();
			//#else
			InputStream in = rm.getResource(id).getInputStream();
			//#endif
			NativeImage img = NativeImage.read(in);
			in.close();
			int s = Math.max(1, img.getWidth() / 256);
			paint(img, 46 * s, s, 0);
			paint(img, 66 * s, s, 1);
			paint(img, 86 * s, s, 2);
			DynamicTexture tex = new DynamicTexture(img);
			// Registered under Xion's own id so it stays alive; vanilla's widgets.png entry is left alone.
			mc.getTextureManager().register(Ids.cast(Ids.of("xionclient", "dynamic/widgets")), tex);
			texture = tex;
			System.out.println("[Xion] Skinned widgets.png (" + img.getWidth() + "px)");
		} catch (Exception e) {
			// Keep vanilla buttons if the atlas can't be read (e.g. an unusual resource pack).
			System.out.println("[Xion] Could not skin widgets.png: " + e);
		}
		//#endif
	}

	//#if MC < 12002
	/** state: 0 = disabled, 1 = normal, 2 = hovered. */
	private static void paint(NativeImage img, int y0, int s, int state) {
		int w = 200 * s, h = 20 * s;
		for (int y = 0; y < h; y++) {
			for (int x = 0; x < w; x++) {
				boolean edgeX = x < s || x >= w - s, edgeY = y < s || y >= h - s;
				boolean corner = edgeX && edgeY;
				int argb;
				if (corner) {
					argb = 0;
				} else if (edgeX || edgeY) {
					argb = switch (state) {
						case 2 -> 0x99E9EEF7;
						case 1 -> 0x26FFFFFF;
						default -> 0x12FFFFFF;
					};
					argb = over(base(state, y, h), argb);
				} else {
					argb = base(state, y, h);
					if (y < 2 * s && state > 0) argb = over(argb, state == 2 ? 0x14FFFFFF : 0x0AFFFFFF);
				}
				img.setPixelRGBA(x, y0 + y, toAbgr(argb));
			}
		}
	}

	private static int base(int state, int y, int h) {
		float t = y / (float) Math.max(1, h - 1);
		return switch (state) {
			case 2 -> lerp(0xE41E2432, 0xE4161A24, t);
			case 1 -> lerp(0xC80F1218, 0xC80A0C11, t);
			default -> 0x900B0D12;
		};
	}

	private static int lerp(int a, int b, float t) {
		int r = 0;
		for (int sh = 0; sh <= 24; sh += 8) {
			int ca = (a >>> sh) & 255, cb = (b >>> sh) & 255;
			r |= Math.round(ca + (cb - ca) * t) << sh;
		}
		return r;
	}

	/** Alpha-composites src over dst (both ARGB). */
	private static int over(int dst, int src) {
		float sa = (src >>> 24) / 255f, da = (dst >>> 24) / 255f;
		float oa = sa + da * (1 - sa);
		if (oa <= 0) return 0;
		int out = Math.round(oa * 255) << 24;
		for (int sh = 0; sh <= 16; sh += 8) {
			float c = (((src >>> sh) & 255) * sa + ((dst >>> sh) & 255) * da * (1 - sa)) / oa;
			out |= Math.round(c) << sh;
		}
		return out;
	}

	private static int toAbgr(int argb) {
		return (argb & 0xFF00FF00) | ((argb & 0xFF) << 16) | ((argb >> 16) & 0xFF);
	}
	//#endif
}
