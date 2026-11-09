package net.xion.client.feature;

import net.minecraft.client.Minecraft;
import net.xion.client.XionConfig;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;

/** Xion Premium custom crosshair, drawn with plain fills so it looks identical on every version. */
public final class Crosshair {
	public static final String[] STYLES = {"Vanilla", "Dot", "Plus", "Gap plus", "Circle", "Cross"};

	private Crosshair() {}

	public static boolean replacesVanilla() {
		return XionConfig.data.crosshairStyle > 0 && Premium.active();
	}

	/** Called from the HUD pass; draws nothing unless a custom style is active and the view is first person. */
	public static void render(Gfx g) {
		Minecraft mc = g.mc;
		if (!replacesVanilla() || mc.player == null || !Compat.firstPerson() || Compat.screen() != null) return;
		draw(g, g.width() / 2, g.height() / 2, XionConfig.data.crosshairStyle, XionConfig.data.crosshairColor,
			XionConfig.data.crosshairSize, XionConfig.data.crosshairOutline);
	}

	/** Also used for the live preview in the Xion menu. */
	public static void draw(Gfx g, int cx, int cy, int style, int color, float size, boolean outline) {
		int s = Math.max(1, Math.round(4 * size));
		if (outline) shape(g, cx, cy, style, s, 0xC0000000, 1);
		shape(g, cx, cy, style, s, color, 0);
	}

	/** grow > 0 draws a 1px-larger copy used as a dark outline. */
	private static void shape(Gfx g, int cx, int cy, int style, int s, int c, int grow) {
		int o = grow;
		switch (style) {
			case 1 -> g.fill(cx - 1 - o, cy - 1 - o, cx + 1 + o, cy + 1 + o, c);
			case 2 -> {
				g.fill(cx - s - o, cy - o, cx + s + 1 + o, cy + 1 + o, c);
				g.fill(cx - o, cy - s - o, cx + 1 + o, cy + s + 1 + o, c);
			}
			case 3 -> {
				int gap = 2;
				g.fill(cx - gap - s - o, cy - o, cx - gap + o, cy + 1 + o, c);
				g.fill(cx + gap + 1 - o, cy - o, cx + gap + s + 1 + o, cy + 1 + o, c);
				g.fill(cx - o, cy - gap - s - o, cx + 1 + o, cy - gap + o, c);
				g.fill(cx - o, cy + gap + 1 - o, cx + 1 + o, cy + gap + s + 1 + o, c);
				g.fill(cx - o, cy - o, cx + 1 + o, cy + 1 + o, c);
			}
			case 4 -> {
				int r = s + 1;
				for (int a = 0; a < 48; a++) {
					double t = a * Math.PI * 2 / 48;
					int x = cx + (int) Math.round(Math.cos(t) * r), y = cy + (int) Math.round(Math.sin(t) * r);
					g.fill(x - o, y - o, x + 1 + o, y + 1 + o, c);
				}
				g.fill(cx - o, cy - o, cx + 1 + o, cy + 1 + o, c);
			}
			case 5 -> {
				for (int i = -s; i <= s; i++) {
					g.fill(cx + i - o, cy + i - o, cx + i + 1 + o, cy + i + 1 + o, c);
					g.fill(cx + i - o, cy - i - o, cx + i + 1 + o, cy - i + 1 + o, c);
				}
			}
			default -> { }
		}
	}

	/** Colour swatches offered in the crosshair and HUD settings. */
	public static final int[] SWATCHES = {0xFFFFFFFF, 0xFFE8ECF2, 0xFFFF5D73, 0xFFFFB86B, 0xFFF5E06B, 0xFF6EE7A8, 0xFF5EC8FF, 0xFFC9A2FF, 0xFFFF7AD9};

	public static int accent() {
		return Colors.ACCENT;
	}
}
