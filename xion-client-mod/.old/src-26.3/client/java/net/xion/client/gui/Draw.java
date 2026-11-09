package net.xion.client.gui;

import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;

/** Small drawing helpers shared by Xion screens and HUD. */
public final class Draw {
	public static final int ACCENT = 0xFFB56CFF;
	public static final int ACCENT_2 = 0xFF2FD8FF;
	public static final int TEXT = 0xFFF2F1FA;
	public static final int MUTED = 0xFF8F8DA8;

	private Draw() {}

	/** Filled rectangle with 1px-trimmed corners — reads as rounded at GUI scale. */
	public static void rounded(GuiGraphicsExtractor g, int x, int y, int w, int h, int color) {
		if (w <= 2 || h <= 2) {
			g.fill(x, y, x + w, y + h, color);
			return;
		}
		g.fill(x + 1, y, x + w - 1, y + h, color);
		g.fill(x, y + 1, x + 1, y + h - 1, color);
		g.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
	}

	public static void roundedOutline(GuiGraphicsExtractor g, int x, int y, int w, int h, int color) {
		g.fill(x + 1, y, x + w - 1, y + 1, color);
		g.fill(x + 1, y + h - 1, x + w - 1, y + h, color);
		g.fill(x, y + 1, x + 1, y + h - 1, color);
		g.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
	}

	/** Horizontal two-color gradient built from vertical strips. */
	public static void hGradient(GuiGraphicsExtractor g, int x, int y, int w, int h, int from, int to) {
		int steps = Math.max(1, Math.min(w, 48));
		for (int i = 0; i < steps; i++) {
			int x0 = x + w * i / steps;
			int x1 = x + w * (i + 1) / steps;
			g.fill(x0, y, x1, y + h, lerpColor(from, to, i / (float) Math.max(1, steps - 1)));
		}
	}

	public static int lerpColor(int a, int b, float t) {
		t = Math.max(0, Math.min(1, t));
		int aa = a >>> 24, ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
		int ba = b >>> 24, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
		return ((int) (aa + (ba - aa) * t) << 24) | ((int) (ar + (br - ar) * t) << 16) | ((int) (ag + (bg - ag) * t) << 8) | (int) (ab + (bb - ab) * t);
	}

	public static int withAlpha(int color, float alpha) {
		int a = (int) ((color >>> 24) * Math.max(0, Math.min(1, alpha)));
		return (a << 24) | (color & 0xFFFFFF);
	}

	public static void scaledText(GuiGraphicsExtractor g, Font font, String text, float x, float y, float scale, int color, boolean shadow) {
		g.pose().pushMatrix();
		g.pose().translate(x, y);
		g.pose().scale(scale, scale);
		g.text(font, text, 0, 0, color, shadow);
		g.pose().popMatrix();
	}

	public static void centeredScaledText(GuiGraphicsExtractor g, Font font, String text, float cx, float y, float scale, int color, boolean shadow) {
		scaledText(g, font, text, cx - font.width(text) * scale / 2f, y, scale, color, shadow);
	}
}
